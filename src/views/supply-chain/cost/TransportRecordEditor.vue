<template>
  <el-dialog
    v-model="visible"
    :title="readonly ? '运输记录详情' : detail ? '编辑运输记录' : '新增运输记录'"
    width="min(1360px, 96vw)"
    top="3vh"
    class="transport-dialog"
    :close-on-click-modal="false"
    :before-close="close"
  >
    <div v-loading="loading" class="transport-content">
      <div v-if="detail" class="record-heading">
        <div>
          <span class="heading-label">费用单号</span><strong>{{ detail.record.documentNo }}</strong
          ><el-tag
            :type="
              detail.record.statusCode === 'CONFIRMED'
                ? 'success'
                : detail.record.statusCode === 'VOID'
                  ? 'info'
                  : 'warning'
            "
            >{{ statusName(detail.record.statusCode) }}</el-tag
          >
        </div>
        <div v-if="readonly" class="heading-actions">
          <TransportRecordActions
            :record="detail.record"
            detail
            @edit="emit('edit', '')"
            @action="(action) => emit('action', action)"
          /><el-button v-if="platform && can('integration:huolala:sync')" @click="emit('sync')"
            >同步此单</el-button
          >
        </div>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert
        v-if="platform && order?.raw['详情状态'] === 'LIST'"
        title="详细信息暂未同步，请重新同步此单"
        type="warning"
        :closable="false"
      />
      <el-form label-position="top" :model="form" @submit.prevent>
        <section class="transport-section">
          <h3>基本信息</h3>
          <div class="form-grid">
            <el-form-item label="数据来源"
              ><span>{{ platform ? '货拉拉同步' : '手动录入' }}</span></el-form-item
            >
            <el-form-item label="运输类型" :required="!readonly"
              ><span v-if="readonly">{{ typeName(form.transportType) }}</span
              ><el-select
                v-else
                v-model="form.transportType"
                placeholder="请选择运输类型"
                @change="typeChanged"
                ><el-option
                  v-for="t in transportTypes"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value" /></el-select
            ></el-form-item>
            <el-form-item label="订单类型"
              ><span>{{ type?.orderLabel || '-' }}</span></el-form-item
            >
            <el-form-item label="运输日期" :required="!readonly && !platform"
              ><span v-if="readonly || platform">{{ form.date || '-' }}</span
              ><el-date-picker
                v-else
                v-model="form.date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择运输日期"
            /></el-form-item>
            <el-form-item label="物流公司" :required="!readonly && !platform"
              ><span v-if="platform">货拉拉</span
              ><span v-else-if="readonly">{{
                form.carrierCode
                  ? costLabel('COST_CARRIER', form.carrierCode)
                  : detail?.record.data.logistics?.carrierName || '-'
              }}</span
              ><el-select v-else v-model="form.carrierCode" placeholder="请选择物流公司"
                ><el-option
                  v-for="o in costOptions('COST_CARRIER')"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value" /></el-select
            ></el-form-item>
            <el-form-item label="运单号"
              ><span v-if="readonly || platform">{{ form.trackingNo || '-' }}</span
              ><el-input v-else v-model="form.trackingNo" maxlength="100" placeholder="填写运单号"
            /></el-form-item>
            <el-form-item v-if="platform || form.carrierCode === 'HLL'" label="货拉拉订单号"
              ><span v-if="readonly || platform">{{ form.platformOrderNo || '-' }}</span
              ><el-input
                v-else
                v-model="form.platformOrderNo"
                maxlength="80"
                placeholder="填写货拉拉订单号"
            /></el-form-item>
          </div>
        </section>
        <section class="transport-section">
          <div ref="ordersSection" class="section-heading">
            <h3>关联业务订单</h3>
            <el-button
              v-if="
                readonly &&
                detail?.record.statusCode === 'DRAFT' &&
                can('order:logistics-cost:write')
              "
              link
              type="primary"
              @click="emit('edit', 'orders')"
              >{{ selected.length ? '更改关联' : '关联订单' }}</el-button
            >
            <el-button
              v-if="!readonly && !advanced"
              type="primary"
              plain
              :disabled="!form.transportType"
              @click="picker = true"
              >选择{{ type?.orderLabel || '业务订单' }}</el-button
            >
          </div>
          <el-table :data="selected" border empty-text="暂未关联业务订单"
            ><el-table-column prop="documentNo" label="业务单号" min-width="205" /><el-table-column
              label="客户／收货仓库"
              min-width="180"
              ><template #default="{ row }">{{
                row.receiverName || '-'
              }}</template></el-table-column
            ><el-table-column label="业务员" width="110"
              ><template #default="{ row }">{{
                row.employeeName || '-'
              }}</template></el-table-column
            ><el-table-column label="部门" min-width="130"
              ><template #default="{ row }">{{
                row.departmentName || '-'
              }}</template></el-table-column
            ><el-table-column label="单据日期" width="125"
              ><template #default="{ row }">{{
                row.documentDate || '-'
              }}</template></el-table-column
            ><el-table-column label="业务订单金额（元）" align="right" min-width="160"
              ><template #default="{ row }">{{
                money(row.documentAmount)
              }}</template></el-table-column
            ><el-table-column v-if="readonly" label="关联时间" min-width="180"
              ><template #default="{ row }">{{
                row.linkedAt ? displayRecordDateTime(row.linkedAt) : '-'
              }}</template></el-table-column
            ><el-table-column v-if="!readonly && !advanced" label="操作" width="80"
              ><template #default="{ row }"
                ><el-button link type="danger" @click="removeOrder(row.documentNo)"
                  >移除</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </section>
        <section class="transport-section">
          <h3>发货信息</h3>
          <template v-if="platform"
            ><div v-for="(p, i) in platformSenders" :key="i" class="address-card">
              <strong>{{ p.name || '-' }}</strong>
              <div class="form-grid">
                <Info label="发货联系人" :value="p.contactName" /><Info
                  label="发货联系电话"
                  :value="p.contactPhone"
                /><Info class="wide" label="发货地址" :value="p.address" />
              </div>
            </div>
            <p v-if="!platformSenders.length" class="empty-text">暂无发货信息</p>
            <el-form-item v-if="!readonly" label="本系统发货仓库"
              ><CostLedgerPartySelect
                v-model="form.warehouseCode"
                logistics
                kind="WAREHOUSE"
                placeholder="按实际运输补选仓库"
            /></el-form-item>
          </template>
          <div v-else class="form-grid">
            <el-form-item label="发货仓库"
              ><span v-if="readonly">{{
                form.warehouseCode ? form.senderName || form.warehouseCode : '-'
              }}</span
              ><CostLedgerPartySelect
                v-else
                v-model="form.warehouseCode"
                logistics
                kind="WAREHOUSE"
                :name="form.senderName"
                placeholder="搜索并选择发货仓库"
                @selected="selectWarehouse" /></el-form-item
            ><el-form-item label="发货方"
              ><span v-if="readonly">{{ form.senderName || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderName"
                maxlength="100"
                placeholder="填写实际发货方"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item label="发货联系人"
              ><span v-if="readonly">{{ form.senderContact || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderContact"
                maxlength="100"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item label="发货联系电话"
              ><span v-if="readonly">{{ form.senderPhone || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderPhone"
                maxlength="50"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item class="wide" label="发货地址"
              ><span v-if="readonly">{{ form.senderAddress || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderAddress"
                maxlength="500"
                placeholder="填写本次运输的发货地址"
                @input="senderTouched = true"
            /></el-form-item>
          </div>
        </section>
        <section class="transport-section">
          <h3>收货信息</h3>
          <div v-for="(p, i) in receivers" :key="i" class="address-card">
            <strong>{{ p.name || '-' }}</strong>
            <div class="form-grid">
              <Info label="收货联系人" :value="p.contactName" /><Info
                label="收货联系电话"
                :value="p.contactPhone"
              /><Info class="wide" label="收货地址" :value="p.address" />
            </div>
          </div>
          <p v-if="!receivers.length" class="empty-text">
            {{ platform || readonly ? '暂无收货信息' : '选择业务订单后显示收货信息' }}
          </p>
        </section>
        <section class="transport-section">
          <h3>费用信息</h3>
          <el-button
            v-if="advanced && !readonly"
            class="advanced-button"
            @click="advancedOpen = true"
            >维护费用与分摊明细</el-button
          >
          <div class="form-grid">
            <el-form-item label="运输费用（元）"
              ><span v-if="readonly || platform || advanced" class="amount">{{
                money(form.amount)
              }}</span
              ><el-input-number
                v-else
                v-model="form.amount"
                :precision="2"
                :min="0"
                :max="999999999999"
                :controls="false"
                placeholder="填写运输费用" /></el-form-item
            ><el-form-item label="费用负责人"
              ><span v-if="readonly">{{ ownerName }}</span
              ><el-select
                v-else
                v-model="form.ownerEmployeeCode"
                clearable
                filterable
                placeholder="请选择费用负责人"
                ><el-option
                  v-for="e in employees"
                  :key="e.employeeCode"
                  :label="e.employeeName + (e.departmentName ? `（${e.departmentName}）` : '')"
                  :value="e.employeeCode" /></el-select></el-form-item
            ><el-form-item label="已确认运输成本（元）"
              ><strong>{{
                detail?.record.statusCode === 'CONFIRMED' ? money(detail.record.data.amount) : '-'
              }}</strong></el-form-item
            ><el-form-item v-if="!readonly && !form.cityCode" label="费用归属城市"
              ><CostCitySelect
                v-model="form.cityCode"
                :disabled="false"
                action="order:logistics-cost:write" /></el-form-item
            ><el-form-item
              v-if="!readonly && form.amount === 0"
              class="wide"
              label="零元原因"
              required
              ><el-input
                v-model="form.zeroReason"
                maxlength="500"
                placeholder="填写包邮或无需我方支付的原因"
            /></el-form-item>
          </div>
          <el-table v-if="!readonly && allocations.length" :data="allocations" border
            ><el-table-column prop="code" label="业务单号" /><el-table-column
              label="分摊运输费用（元）"
              align="right"
              ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
            ></el-table
          >
          <TransportPlatformBill
            v-if="platform && readonly"
            :record-id="detail!.record.id"
            :platform="platform"
            :confirmed="detail!.record.statusCode === 'CONFIRMED'"
            :confirmed-amount="detail!.record.data.amount"
          />
        </section>
        <section class="transport-section">
          <h3>备注</h3>
          <span v-if="readonly" class="remark">{{ form.remark || '-' }}</span
          ><el-input
            v-else
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="填写本次运输的业务备注"
          /><el-form-item
            v-if="!readonly && detail && hadLinks"
            label="变更原因"
            class="change-reason"
            ><el-input
              v-model="form.reason"
              maxlength="500"
              placeholder="更改或解除已有订单关联时填写原因"
          /></el-form-item>
        </section>
      </el-form>
      <section v-if="platform && readonly" class="transport-section">
        <h3>货拉拉订单信息</h3>
        <div class="form-grid">
          <Info label="货拉拉订单号" :value="order?.orderNo" /><Info
            label="货拉拉订单状态"
            :value="order?.status"
          /><Info label="下单时间" :value="order?.raw['下单时间']" /><Info
            label="用车时间"
            :value="order?.useTime"
          /><Info label="完成时间" :value="order?.facts?.completeTime" /><Info
            label="车型"
            :value="order?.raw['车型']"
          /><Info label="用车原因" :value="order?.raw['用车原由']" /><Info
            class="wide"
            label="货拉拉订单备注"
            :value="order?.raw['订单备注']"
          />
        </div>
        <h4>司机与车辆</h4>
        <div class="form-grid">
          <Info label="司机" :value="order?.raw['司机']" /><Info
            label="司机联系电话"
            :value="order?.raw['司机联系电话']"
          /><Info label="车牌号" :value="order?.raw['车牌号']" />
        </div>
        <div class="section-heading">
          <h4>人员关联</h4>
          <el-button
            v-if="can('integration:huolala:read')"
            link
            type="primary"
            @click="emit('associate-employee')"
            >{{ order?.facts?.mappedEmployeeCode ? '查看员工关联' : '关联员工' }}</el-button
          >
        </div>
        <div class="form-grid">
          <Info label="货拉拉下单员工" :value="order?.facts?.sourceEmployeeName" /><Info
            label="下单员工手机号"
            :value="order?.raw['下单员工手机号']"
          /><Info label="本系统关联员工" :value="mappedEmployee" /><Info
            label="本系统所属部门"
            :value="mappedDepartment"
          /><Info
            label="员工关联状态"
            :value="order?.facts?.mappedEmployeeCode ? '已关联' : '未关联'"
          />
        </div>
      </section>
      <section v-if="detail" class="transport-section">
        <CostAttachmentEditor
          v-if="!readonly"
          v-model="attachmentDrafts"
          category="logistics"
          title="运输附件"
          :row="detail.record"
          :disabled="saving"
        /><CostAttachments
          v-else
          title="运输附件"
          category="logistics"
          :row="detail.record"
          :editable="false"
        />
      </section>
      <section v-if="!detail && !readonly" class="transport-section">
        <CostAttachmentEditor
          v-model="attachmentDrafts"
          category="logistics"
          title="运输附件"
          :row="null"
          :disabled="saving"
        />
      </section>
      <section v-if="readonly && detail" class="transport-section">
        <h3>操作记录</h3>
        <el-table :data="history" border empty-text="暂无操作记录"
          ><el-table-column label="时间" min-width="190"
            ><template #default="{ row }">{{
              displayRecordDateTime(row.occurredTime)
            }}</template></el-table-column
          ><el-table-column label="操作" width="120"
            ><template #default="{ row }">{{ auditLabel(row.action) }}</template></el-table-column
          ><el-table-column label="操作人" min-width="120"
            ><template #default="{ row }">{{
              displayRecordActor(row.actorId)
            }}</template></el-table-column
          ><el-table-column prop="reason" label="说明" min-width="240"
        /></el-table>
      </section>
    </div>
    <template #footer
      ><el-button :disabled="saving" @click="close()">{{ readonly ? '关闭' : '取消' }}</el-button
      ><el-button
        v-if="!readonly"
        type="primary"
        :loading="saving"
        :disabled="loading"
        @click="save"
        >保存运输记录</el-button
      ></template
    >
    <el-dialog
      v-model="advancedOpen"
      title="费用与分摊明细"
      width="min(1250px, 94vw)"
      append-to-body
      :close-on-click-modal="false"
      ><CostLedgerEditor
        v-if="advancedData && advancedOpen"
        v-model="advancedData"
        logistics
        :cities="cities"
        :employees="employees"
      /><template #footer
        ><el-button type="primary" @click="applyAdvanced">完成</el-button></template
      ></el-dialog
    >
    <CostLedgerSourcePicker
      v-model="picker"
      :selected-keys="form.orderCodes.map((c) => `${type?.orderType}:${c}`)"
      :order-type-code="type?.orderType"
      :allow-incomplete="!!platform"
      :suggested-date="form.date"
      :suggested-receiver="order?.raw['收货人信息']"
      @selected="addOrders"
    />
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, toRaw, type PropType } from 'vue'
import { ElMessage } from 'element-plus'
import type { CostEmployee, CostSource, CostAudit, CostCommand } from '@/api/core/cost'
import { getCostEmployees, getCostHistory, getCostCities, saveCost } from '@/api/core/cost'
import {
  getLedgerParties,
  getLedgerSources,
  type LedgerPartyReference,
} from '@/api/core/cost-ledger'
import { saveTransport, type TransportDetail } from '@/api/core/transport-records'
import { currentSource } from './huolala-source'
import {
  transportDraft,
  transportTypes,
  money,
  typeName,
  statusName,
  allocationPreview,
  frozenTransportSources,
  frozenTransportReceivers,
} from './transport-records'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import CostLedgerSourcePicker, { type PickedLedgerSource } from './CostLedgerSourcePicker.vue'
import CostCitySelect from './CostCitySelect.vue'
import TransportPlatformBill from './TransportPlatformBill.vue'
import TransportRecordActions from './TransportRecordActions.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import CostLedgerEditor from './CostLedgerEditor.vue'
import { totalFees } from './cost-ledger'
import CostAttachmentEditor from './CostAttachmentEditor.vue'
import CostAttachments from './CostAttachments.vue'
import { saveCostAttachmentChanges, type CostAttachmentDraft } from './cost-attachment-draft'
import { costOptions, costLabel } from './cost-dictionaries'
import { errorMessage } from '@/api/core/error'
import { auditLabel } from './cost-audit'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
const props = defineProps<{
  detail: TransportDetail | null
  readonly: boolean
  initialSection?: string
}>()
const { can } = useSupplyPermissions()
const ordersSection = ref<HTMLElement>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  saved: []
  edit: [section: string]
  action: [action: 'confirm' | 'revoke' | 'void' | 'delete']
  sync: []
  'associate-employee': []
}>()
const detail = ref(props.detail),
  platform = computed(() => detail.value?.platform)
const order = computed(() => (platform.value ? currentSource(platform.value.source) : null))
const form = ref(transportDraft(detail.value?.record, platform.value))
const advancedData = ref<CostCommand | null>(
  detail.value ? structuredClone(toRaw(detail.value.record.data)) : null,
)
const advanced = computed(
  () =>
    !platform.value &&
    !!advancedData.value?.ledger &&
    (advancedData.value.ledger.feeItems.length !== 1 ||
      advancedData.value.ledger.feeItems.some(
        (f) => f.bearerCode !== 'COMPANY' || f.allocationMethodCode !== 'EQUAL',
      )),
)
const advancedOpen = ref(false),
  cities = ref<{ code: string; name: string }[]>([])
function applyAdvanced() {
  if (!advancedData.value?.ledger) return
  form.value.amount = totalFees(advancedData.value.ledger.feeItems)
  advancedOpen.value = false
}

const type = computed(() => transportTypes.find((t) => t.value === form.value.transportType))
const selected = ref<CostSource[]>([]),
  employees = ref<CostEmployee[]>([]),
  history = ref<CostAudit[]>([])
const picker = ref(false),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  senderTouched = ref(!!detail.value)
const hadLinks = !!form.value.orderCodes.length
const attachmentDrafts = ref<CostAttachmentDraft[]>([])
const allocations = computed(() => allocationPreview(form.value.amount, form.value.orderCodes))
const platformSenders = computed(() => order.value?.facts?.stops.slice(0, 1) || [])
const receivers = computed(() =>
  platform.value
    ? order.value?.facts?.stops.slice(1) || []
    : props.readonly && detail.value
      ? frozenTransportReceivers(detail.value.record)
      : selected.value.map((s) => ({
          name: s.receiverName,
          contactName: s.contactName,
          contactPhone: s.contactPhone,
          address: s.destinationAddress,
        })),
)
const ownerName = computed(
  () =>
    employees.value.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.employeeName ||
    detail.value?.record.ownerEmployeeName ||
    '-',
)
const mappedEmployee = computed(
  () =>
    employees.value.find((e) => e.employeeCode === order.value?.facts?.mappedEmployeeCode)
      ?.employeeName ||
    order.value?.facts?.mappedEmployeeCode ||
    '-',
)
const mappedDepartment = computed(
  () =>
    employees.value.find((e) => e.employeeCode === order.value?.facts?.mappedEmployeeCode)
      ?.departmentName || null,
)
const Info = defineComponent({
  props: {
    label: String,
    value: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  setup(p) {
    return () =>
      h('div', { class: 'info-field' }, [
        h('span', p.label),
        h('div', p.value == null || p.value === '' ? '-' : String(p.value)),
      ])
  },
})
function close(done?: () => void) {
  if (saving.value) return
  if (done) done()
  else visible.value = false
}
function typeChanged() {
  selected.value = []
  form.value.orderCodes = []
}
function removeOrder(code: string) {
  selected.value = selected.value.filter((s) => s.documentNo !== code)
  form.value.orderCodes = form.value.orderCodes.filter((c) => c !== code)
}
async function selectWarehouse(w: LedgerPartyReference | null) {
  senderTouched.value = true
  if (!w) return
  Object.assign(form.value, {
    warehouseCode: w.code,
    senderName: w.name,
    senderContact: w.contactName || '',
    senderPhone: w.phone || '',
    senderAddress: w.address || '',
    cityCode: form.value.cityCode || w.cityCode || '',
  })
}
async function addOrders(rows: PickedLedgerSource[]) {
  selected.value.push(...rows.filter((r) => !form.value.orderCodes.includes(r.documentNo)))
  form.value.orderCodes = selected.value.map((r) => r.documentNo)
  if (!form.value.cityCode) form.value.cityCode = selected.value[0]?.cityCode || ''
  if (!platform.value && !senderTouched.value) {
    const codes = new Set(selected.value.map((s) => s.senderCode))
    if (codes.size === 1 && selected.value.every((s) => !!s.senderCode)) {
      const code = selected.value[0]!.senderCode
      const found = await getLedgerParties(true, 'WAREHOUSE', { code })
      if (found[0]) {
        await selectWarehouse(found[0])
        senderTouched.value = false
      }
    }
  }
}
onMounted(async () => {
  loading.value = true
  const frozen = detail.value ? frozenTransportSources(detail.value.record) : []
  selected.value = frozen
  try {
    employees.value = await getCostEmployees('logistics')
    if (advanced.value) cities.value = await getCostCities()
    if (props.readonly && detail.value)
      history.value = await getCostHistory('logistics', detail.value.record.id)
    if (props.readonly) {
      // 旧台账未保存单据日期，只补查日期；归属、联系人及地址始终保留已存快照。
      for (const source of selected.value.filter((s) => !s.documentDate)) {
        try {
          const current = (
            await getLedgerSources(
              { orderTypeCode: source.sourceType, documentNo: source.documentNo, begin: 0 },
              true,
            )
          ).find((s) => s.documentNo === source.documentNo)
          source.documentDate = current?.documentDate || null
        } catch {
          /* 历史原单不可见时保留空日期，不能覆盖已存业务资料。 */
        }
      }
      return
    }
    const current: CostSource[] = []
    for (const code of form.value.orderCodes) {
      let found: CostSource | undefined
      try {
        found = (
          await getLedgerSources(
            { orderTypeCode: type.value?.orderType || 'SALES_ORDER', documentNo: code, begin: 0 },
            true,
          )
        ).find((s) => s.documentNo === code)
      } catch {
        /* 已确认历史资料仍从冻结快照展示。 */
      }
      found ||= frozen.find((s) => s.documentNo === code)
      if (found) current.push(found)
      else
        current.push({
          documentNo: code,
          sourceType: type.value?.orderType || '',
          id: code,
          cityCode: '',
          warehouseId: null,
          targetWarehouseId: null,
          senderCode: '',
          senderName: '',
          receiverCode: '',
          receiverName: '',
          statusCode: '',
        })
    }
    selected.value = current
  } catch (e) {
    error.value = errorMessage(e, '运输记录加载失败')
  } finally {
    loading.value = false
    if (props.initialSection === 'orders' && !props.readonly) {
      ordersSection.value?.scrollIntoView?.({ block: 'start' })
      picker.value = true
    }
  }
})
async function save() {
  if (saving.value || loading.value) return
  error.value = ''
  if (!form.value.transportType && !platform.value) {
    error.value = '请选择运输类型'
    return
  }
  if (!form.value.date || (!platform.value && !form.value.carrierCode)) {
    error.value = '请选择运输日期和物流公司'
    return
  }
  if (!platform.value && !form.value.orderCodes.length) {
    error.value = '请选择关联业务订单'
    return
  }
  if (form.value.amount === 0 && !form.value.zeroReason.trim()) {
    error.value = '请填写零元原因'
    return
  }
  saving.value = true
  try {
    const result =
      advanced.value && advancedData.value
        ? {
            record: await saveCost('logistics', detail.value!.record.id, {
              ...advancedData.value,
              revision: detail.value!.record.revision,
              costDate: form.value.date,
              ownerEmployeeCode: form.value.ownerEmployeeCode,
              remark: form.value.remark,
              reason: form.value.reason,
              amount: advancedData.value.ledger!.feeItems.some((f) => f.ourAmount == null)
                ? null
                : advancedData.value.ledger!.feeItems.reduce(
                    (sum, f) => sum + Number(f.ourAmount),
                    0,
                  ),
            }),
            platform: null,
          }
        : await saveTransport(detail.value?.record.id || null, {
            ...form.value,
            revision: detail.value?.record.revision ?? null,
          })
    detail.value = result
    form.value.revision = result.record.revision
    await saveCostAttachmentChanges(
      'logistics',
      detail.value.record,
      attachmentDrafts.value,
      (row) => {
        detail.value!.record = row
        form.value.revision = row.revision
      },
    )
    ElMessage.success('运输记录已保存')
    emit('saved')
    visible.value = false
  } catch (e) {
    error.value = errorMessage(e, '保存失败，请核对后重试')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.heading-label {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 5px;
}
.record-heading > div:first-child {
  display: grid;
  justify-items: start;
  gap: 5px;
}
.heading-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.transport-content {
  max-height: calc(88vh - 120px);
  overflow: auto;
  background: var(--el-fill-color-lighter);
  padding: 18px;
}
.record-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 18px;
}
.record-heading strong {
  font-size: 20px;
}
.transport-section {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 22px;
  margin-bottom: 16px;
}
h3 {
  margin: 0 0 22px;
  font-size: 16px;
}
h4 {
  margin: 20px 0 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-heading h3 {
  margin: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 24px;
}
.wide {
  grid-column: 1/-1;
}
.form-grid :deep(.el-select),
.form-grid :deep(.el-input-number),
.form-grid :deep(.el-date-editor) {
  width: 100%;
}
.address-card {
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.address-card:last-of-type {
  border-bottom: 0;
}
.address-card > .form-grid {
  margin-top: 18px;
}
:deep(.info-field) > span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
:deep(.info-field) > div {
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.empty-text {
  color: var(--el-text-color-secondary);
}
.remark {
  white-space: pre-wrap;
}
.change-reason {
  margin-top: 20px;
}
.amount {
  font-size: 20px;
  font-weight: 600;
}
@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .transport-content {
    padding: 8px;
  }
  .transport-section {
    padding: 16px;
  }
}
</style>
