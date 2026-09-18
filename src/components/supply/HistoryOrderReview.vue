<template>
  <el-button v-if="can('integration:dhb:read')" @click="open">门店历史关联与回款核对</el-button>
  <el-drawer v-model="visible" title="门店历史关联与回款核对" size="90%">
    <el-alert
      title="保留飞书原订单。按同一门店建立拆单/合单关联组；金额相等不能替代商品明细核对。"
      type="info"
      :closable="false"
    />
    <el-select
      v-model="customer"
      filterable
      placeholder="选择客户门店"
      style="width: 360px; margin: 16px 0"
      @change="load"
    >
      <el-option
        v-for="s in stores"
        :key="String(s.customer_id)"
        :value="String(s.customer_id)"
        :label="`${s.customer_name} · ${s.history_count}单 · ${s.history_amount}元`"
      />
    </el-select>
    <el-button :loading="busy" @click="load">刷新核对结果</el-button>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="data && customer" class="store-totals">
      <p v-for="s in data.stores" :key="String(s.customer_id)">
        飞书 {{ s.history_count }} 单 / {{ s.history_amount }} 元；订货宝
        {{ s.source_count || 0 }} 单 / {{ s.source_amount || 0 }} 元；来源已确认回款
        {{ s.receipt_amount || 0 }} 元（含期初覆盖，不能直接相加）。
      </p>
    </div>
    <el-tabs v-if="data && customer" v-model="tab">
      <el-tab-pane label="历史订单组" name="orders">
        <h3>飞书历史订单：{{ data.historyOrders.length }}单</h3>
        <el-table
          :data="data.historyOrders"
          row-key="id"
          max-height="240"
          @selection-change="selectedHistory = $event"
        >
          <el-table-column type="selection" :selectable="selectableHistory" /><el-table-column
            prop="order_no"
            label="平台订单"
          /><el-table-column prop="source_order_no" label="飞书单号" /><el-table-column
            prop="order_date"
            label="真实下单时间"
          /><el-table-column prop="owner_employee_name_snapshot" label="订单销售" /><el-table-column
            prop="payable_amount"
            label="应付"
          /><el-table-column prop="unpaid_amount" label="未收" /><el-table-column label="明细"
            ><template #default="{ row }"
              ><el-button link @click="showHistory(row)">查看商品</el-button></template
            ></el-table-column
          >
        </el-table>
        <h3>订货宝来源订单：{{ data.sourceOrders.length }}单</h3>
        <el-table
          :data="data.sourceOrders"
          max-height="240"
          @selection-change="selectedSource = $event"
        >
          <el-table-column
            type="selection"
            :selectable="(s) => !s.group_id && s.state !== 'NEW'"
          /><el-table-column prop="source_no" label="订货宝单号" /><el-table-column
            prop="source_date"
            label="来源录入时间"
          /><el-table-column prop="amount" label="金额" /><el-table-column label="关联状态"
            ><template #default="{ row }">{{ stateLabel(row) }}</template></el-table-column
          >
          <el-table-column label="核对"
            ><template #default="{ row }"
              ><el-button link @click="showSource(row)">查看明细</el-button
              ><el-button
                v-if="row.state === 'NEW_OR_HISTORY_REVIEW' && can('integration:dhb:write')"
                link
                @click="newOrder(row)"
                >确认为新订单</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <p>
          已选飞书{{ selectedHistory.length }}单，订货宝{{
            selectedSource.length
          }}单。支持一对多、多对一和多对多。
        </p>
        <el-form label-width="120px">
          <el-form-item label="余额截止时间"
            ><el-date-picker
              v-model="baseline"
              type="datetime"
              placeholder="必须按原始余额快照核实"
          /></el-form-item>
          <el-form-item v-for="o in selectedHistory" :key="String(o.id)" :label="String(o.order_no)"
            ><el-input v-model="opening[String(o.id)]" placeholder="该订单截止时点累计已收金额"
          /></el-form-item>
          <el-form-item label="核对依据"
            ><el-input
              v-model="evidence"
              type="textarea"
              placeholder="原订单引用、商品明细及期初余额核对依据"
          /></el-form-item>
        </el-form>
        <el-button
          v-if="can('integration:dhb:write')"
          type="primary"
          :loading="busy"
          :disabled="!selectedHistory.length || !selectedSource.length || !baseline"
          @click="bind"
          >确认关联组与期初</el-button
        >
        <p>关联后重新同步回款即可接续。一张来源单只属于一个有效组，缺失或冲突会由后台拒绝。</p>
      </el-tab-pane>
      <el-tab-pane label="回款与业绩归属" name="receipts">
        <el-alert
          title="回款业绩归实际回款时门店业务员；订单原销售保持不变。无历史依据时保留待确认。"
          type="info"
          :closable="false"
        />
        <el-table :data="data.receipts" max-height="500">
          <el-table-column prop="receipt_no" label="回款单" /><el-table-column
            prop="source_order_no"
            label="订货宝订单"
          /><el-table-column prop="occurred_at" label="实际回款时间" /><el-table-column
            prop="amount"
            label="金额"
          /><el-table-column label="核销状态"
            ><template #default="{ row }">{{ stateLabel(row) }}</template></el-table-column
          ><el-table-column prop="employee_name" label="回款业绩销售" />
          <el-table-column label="复核" width="260"
            ><template #default="{ row }"
              ><el-button
                v-if="
                  row.group_id && row.state === 'ALLOCATION_PENDING' && can('integration:dhb:write')
                "
                link
                @click="allocation(row)"
                >分配核销</el-button
              ><el-button
                v-if="
                  ['ALLOCATED', 'NEW'].includes(String(row.state)) &&
                  !row.product_allocated &&
                  !row.pending_payload &&
                  can('integration:dhb:write')
                "
                link
                @click="productAllocation(row)"
                >产品核销</el-button
              ><el-button
                v-if="!row.employee_code && can('integration:dhb:write')"
                link
                @click="owner(row)"
                >核实业绩销售</el-button
              ></template
            ></el-table-column
          >
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="月度业绩核对" name="performance">
        <el-date-picker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
        /><el-button :loading="busy" @click="loadPerformance">查询该月业绩</el-button>
        <el-alert
          title="交易按原订单日期及订单销售；回款按实际付款日期及回款销售。缺失归属、待核销与产品未分配金额须核清后再结算。"
          type="info"
          :closable="false"
        />
        <template v-if="performance">
          <p>
            待核实回款销售 {{ performance.pending.owner_pending_amount }} 元；待订单核销
            {{ performance.pending.allocation_pending_amount }} 元；来源变更待复核
            {{ performance.pending.changed_review_amount }} 元；尚未分到产品
            {{ performance.pending.product_pending_amount }} 元。
          </p>
          <h3>销售交易额</h3>
          <el-table :data="performance.sales"
            ><el-table-column prop="employee_code" label="员工编码" /><el-table-column
              prop="employee_name"
              label="订单销售" /><el-table-column
              prop="order_count"
              label="订单数" /><el-table-column prop="amount" label="交易额"
          /></el-table>
          <h3>销售回款额</h3>
          <el-table :data="performance.receipts"
            ><el-table-column prop="employee_code" label="员工编码" /><el-table-column
              label="回款销售"
              ><template #default="{ row }">{{
                row.employee_name || '归属待核实'
              }}</template></el-table-column
            ><el-table-column prop="amount" label="回款额"
          /></el-table>
          <h3>产品交易明细</h3>
          <p>
            按订单行金额；订单级优惠、运费等差额单列
            {{ performance.pending.order_level_adjustment }} 元，不自动摊入产品。
          </p>
          <el-table :data="performance.products"
            ><el-table-column prop="product_name" label="产品" /><el-table-column
              prop="specification"
              label="规格" /><el-table-column prop="amount" label="订单行交易额"
          /></el-table>
          <h3>已核实产品回款</h3>
          <el-table :data="performance.productReceipts"
            ><el-table-column prop="product_name" label="产品" /><el-table-column
              prop="specification"
              label="规格" /><el-table-column prop="amount" label="核销回款额"
          /></el-table>
        </template>
      </el-tab-pane>
    </el-tabs>
    <el-dialog v-model="detailVisible" title="订单商品明细" width="80%" append-to-body
      ><el-table :data="sourceLines"
        ><el-table-column prop="productNameSnapshot" label="商品" /><el-table-column
          prop="specificationSnapshot"
          label="规格" /><el-table-column prop="unitCode" label="单位" /><el-table-column
          prop="quantity"
          label="数量" /><el-table-column prop="unitPrice" label="单价" /></el-table
    ></el-dialog>
    <el-dialog v-model="allocationVisible" title="回款分配到原订单" width="650px" append-to-body>
      <p>本笔回款 {{ activeReceipt?.amount }} 元。必须根据核对依据填写，不默认按金额比例分摊。</p>
      <el-form
        ><el-form-item
          v-for="m in allocationMembers"
          :key="String(m.order_id)"
          :label="orderLabel(m.order_id)"
          ><el-input
            v-model="amounts[String(m.order_id)]"
            placeholder="核销金额，未分配填0" /></el-form-item
        ><el-form-item label="依据"
          ><el-input v-model="allocationEvidence" type="textarea" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button type="primary" :loading="busy" @click="saveAllocation"
          >确认核销</el-button
        ></template
      >
    </el-dialog>
    <el-dialog v-model="productVisible" title="核实产品回款分配" width="720px" append-to-body>
      <p>回款 {{ activeReceipt?.amount }} 元；每个订单的产品分配合计必须等于该订单已核销金额。</p>
      <el-form
        ><el-form-item
          v-for="l in productLines"
          :key="String(l.line_id)"
          :label="`${orderLabel(l.order_id)} / ${l.product_name_snapshot} ${l.specification_snapshot || ''}`"
          ><el-input
            v-model="productAmounts[String(l.line_id)]"
            placeholder="有依据的产品回款金额" /></el-form-item
        ><el-form-item label="分配依据"
          ><el-input v-model="productEvidence" type="textarea" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button type="primary" :loading="busy" @click="saveProducts"
          >确认产品核销</el-button
        ></template
      >
    </el-dialog>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  historyOverview,
  historyAction,
  historyPerformance,
  type HistoryPerformance,
  type HistoryOverview,
  type HistoryRow,
} from '@/api/core/order-history-sync'
const { can } = useSupplyPermissions()
const month = ref(
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7),
  ),
  performance = ref<HistoryPerformance | null>(null)
const productVisible = ref(false),
  productLines = ref<HistoryRow[]>([]),
  productAmounts = ref<Record<string, string>>({}),
  productEvidence = ref('')
const visible = ref(false),
  busy = ref(false),
  error = ref(''),
  customer = ref(''),
  tab = ref('orders')
const stores = ref<HistoryRow[]>([]),
  data = ref<HistoryOverview | null>(null)
const selectedHistory = ref<HistoryRow[]>([]),
  selectedSource = ref<HistoryRow[]>([])
const baseline = ref<Date | null>(null),
  opening = ref<Record<string, string>>({}),
  evidence = ref('')
const detailVisible = ref(false),
  sourceLines = ref<HistoryRow[]>([])
const allocationVisible = ref(false),
  activeReceipt = ref<HistoryRow | null>(null),
  amounts = ref<Record<string, string>>({}),
  allocationEvidence = ref('')
const allocationMembers = computed(
  () =>
    (data.value?.groups.find((g) => g.id === activeReceipt.value?.group_id)?.members as
      HistoryRow[] | undefined) ?? [],
)
function selectableHistory(row: HistoryRow) {
  return !data.value?.groups.some((g) =>
    (g.members as HistoryRow[]).some((m) => String(m.order_id) === String(row.id)),
  )
}
function orderLabel(id: unknown) {
  return String(data.value?.historyOrders.find((o) => String(o.id) === String(id))?.order_no ?? id)
}
async function open() {
  visible.value = true
  await load()
}
async function load() {
  busy.value = true
  error.value = ''
  try {
    const result = await historyOverview(customer.value || undefined)
    if (!customer.value) stores.value = result.stores
    data.value = result
    selectedHistory.value = []
    selectedSource.value = []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '门店对账读取失败'
  } finally {
    busy.value = false
  }
}
async function action(name: Parameters<typeof historyAction>[0], command: unknown) {
  busy.value = true
  error.value = ''
  try {
    await historyAction(name, command)
    ElMessage.success('已保存核对结果')
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，未完成变更'
  } finally {
    busy.value = false
  }
}
function sourceRef(row: HistoryRow) {
  return { connectorId: row.connector_id, sourceNo: row.source_no, revision: row.revision }
}
async function bind() {
  if (!baseline.value) return
  await action('groups', {
    customerId: customer.value,
    sources: selectedSource.value.map(sourceRef),
    orders: selectedHistory.value.map((o) => ({
      orderId: o.id,
      revision: o.revision,
      cutoff: baseline.value!.toISOString(),
      openingPaid: opening.value[String(o.id)],
    })),
    evidence: evidence.value,
  })
}
function showSource(row: HistoryRow) {
  try {
    sourceLines.value = JSON.parse(String(row.payload)).lines ?? []
    detailVisible.value = true
  } catch {
    error.value = '来源明细读取失败'
  }
}
async function newOrder(row: HistoryRow) {
  try {
    const { value } = await ElMessageBox.prompt(
      '确认这是真实新订单而非飞书历史补录，并填写核对依据。保存后再同步销售订单。',
      '新订单确认',
      { inputPattern: /.{5,1000}/, inputErrorMessage: '请填写至少5字核对依据' },
    )
    await action('new-order', { source: sourceRef(row), evidence: value })
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error.value = '新订单确认未完成'
  }
}
function allocation(row: HistoryRow) {
  activeReceipt.value = row
  amounts.value = {}
  allocationEvidence.value = ''
  allocationVisible.value = true
}
async function saveAllocation() {
  const row = activeReceipt.value
  if (!row) return
  await action('allocations', {
    connectorId: row.connector_id,
    receiptNo: row.receipt_no,
    revision: row.revision,
    allocations: allocationMembers.value
      .filter(
        (m) => amounts.value[String(m.order_id)] && Number(amounts.value[String(m.order_id)]) > 0,
      )
      .map((m) => ({ orderId: m.order_id, amount: amounts.value[String(m.order_id)] })),
    evidence: allocationEvidence.value,
  })
  if (!error.value) allocationVisible.value = false
}
async function owner(row: HistoryRow) {
  try {
    const code = await ElMessageBox.prompt(
      '填写已核实的、实际回款时门店业务员的员工编码。不能直接使用现在的负责人。',
      '回款业绩人员',
    )
    const name = await ElMessageBox.prompt('填写该员工姓名', '员工姓名')
    const proof = await ElMessageBox.prompt('填写门店转交生效记录或原回款归属证据', '归属依据', {
      inputPattern: /.{5,1000}/,
    })
    await action('receipt-owner', {
      connectorId: row.connector_id,
      receiptNo: row.receipt_no,
      revision: row.revision,
      employeeCode: code.value,
      employeeName: name.value,
      evidence: proof.value,
    })
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error.value = '业绩归属确认未完成'
  }
}
function stateLabel(row: HistoryRow) {
  if (row.pending_payload) return '来源变更待核对'
  const labels: Record<string, string> = {
    HISTORY_PENDING: '历史待关联',
    NEW_OR_HISTORY_REVIEW: '新旧订单待确认',
    NEW: '新订单',
    BOUND: '已关联',
    SOURCE_CHANGED_REVIEW: '来源变更待核对',
    MAPPING_PENDING: '门店/订单待关联',
    ALLOCATION_PENDING: '待订单核销',
    ALLOCATED: '已核销',
    BASELINE_COVERED: '已计入期初',
    CANCELLED: '已撤销',
    PAYMENT_TIME_REVIEW: '回款日期待核实',
    STATUS_REVIEW: '来源状态待核实',
  }
  return labels[String(row.state)] || '待核对'
}
function showHistory(row: HistoryRow) {
  sourceLines.value = ((row.lines as HistoryRow[]) || []).map((l) => ({
    productNameSnapshot: l.product_name_snapshot,
    specificationSnapshot: l.specification_snapshot,
    unitCode: l.unit_code,
    quantity: l.quantity,
  }))
  detailVisible.value = true
}
function productAllocation(row: HistoryRow) {
  activeReceipt.value = row
  productLines.value = (row.allocations as HistoryRow[]) || []
  productAmounts.value = {}
  productEvidence.value = ''
  productVisible.value = true
}
async function saveProducts() {
  const row = activeReceipt.value
  if (!row) return
  await action('product-allocations', {
    connectorId: row.connector_id,
    receiptNo: row.receipt_no,
    revision: row.revision,
    allocations: productLines.value
      .filter((l) => Number(productAmounts.value[String(l.line_id)]) > 0)
      .map((l) => ({
        orderId: l.order_id,
        lineId: l.line_id,
        amount: productAmounts.value[String(l.line_id)],
      })),
    evidence: productEvidence.value,
  })
  if (!error.value) productVisible.value = false
}
async function loadPerformance() {
  if (!month.value) return
  busy.value = true
  error.value = ''
  try {
    performance.value = await historyPerformance(month.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '业绩读取失败'
  } finally {
    busy.value = false
  }
}
</script>
