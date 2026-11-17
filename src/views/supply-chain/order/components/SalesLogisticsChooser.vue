<template>
  <el-dialog
    v-model="visible"
    title="选择物流"
    width="min(1280px, 96vw)"
    top="3vh"
    class="sales-logistics-dialog"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <dl class="sales-context" aria-label="销售订单信息">
      <div class="context-main">
        <dt>销售订单号</dt>
        <dd>{{ context.salesOrder.documentNo }}</dd>
      </div>
      <div class="context-main">
        <dt>客户</dt>
        <dd>{{ context.salesOrder.receiverName || '-' }}</dd>
      </div>
      <div class="context-main">
        <dt>业务员／部门</dt>
        <dd>
          {{ context.salesOrder.employeeName || '-' }}／{{
            context.salesOrder.departmentName || '-'
          }}
        </dd>
      </div>
      <div class="context-contact">
        <dt>收货人</dt>
        <dd>
          <span>{{ context.salesOrder.contactName || '-' }}</span>
          <span class="contact-phone" aria-label="联系电话">{{
            context.salesOrder.contactPhone || '-'
          }}</span>
        </dd>
      </div>
      <div class="context-address">
        <dt>收货地址</dt>
        <dd>{{ context.salesOrder.destinationAddress || '-' }}</dd>
      </div>
    </dl>
    <section class="chooser-delivery" aria-label="配送信息">
      <el-form class="delivery-form" label-position="left" label-width="80px" @submit.prevent>
        <el-form-item label="配送方式" required
          ><el-select
            v-model="mode"
            aria-label="配送方式"
            placeholder="请选择配送方式"
            @change="selectionChanged"
            ><el-option
              v-for="o in modeOptions"
              :key="o.value"
              :label="o.label"
              :value="o.value" /></el-select
        ></el-form-item>
        <el-form-item v-if="mode !== 'SELF'" label="物流公司" required
          ><el-select
            v-model="carrier"
            aria-label="物流公司"
            placeholder="请选择物流公司"
            filterable
            @change="selectionChanged"
            ><el-option
              v-for="o in carrierOptions"
              :key="o.value"
              :label="o.label"
              :value="o.value" /></el-select
        ></el-form-item>
        <div v-if="mode === 'SELF' || (carrier && carrier !== 'HLL')" class="manual-entry">
          <el-button
            type="primary"
            :disabled="!context.canAssociate || !supportedMode"
            @click="manualOpen = true"
            >手工录入物流</el-button
          >
        </div>
      </el-form>
      <p v-if="(mode === 'SELF' || (carrier && carrier !== 'HLL')) && !supportedMode">
        该配送方式尚未配置运输处理规则。
      </p>
    </section>
    <section v-if="carrier === 'HLL' && mode !== 'SELF'" class="chooser-results">
      <h3>运输记录</h3>
      <OrderRegisterFilterCard
        class="order-register-filter--compact"
        :loading="loading"
        @search="load"
        @reset="resetFilters"
      >
        <template #primary>
          <div class="list-filter-field">
            <el-input
              v-model="query.platformOrderNo"
              placeholder="快递单号"
              aria-label="快递单号"
              clearable
            />
          </div>
          <div class="list-filter-field list-filter-field--employee">
            <el-input
              v-model="query.platformEmployeeName"
              placeholder="下单员工"
              aria-label="下单员工"
              clearable
            />
          </div>
          <div class="list-filter-field">
            <el-input
              v-model="query.receiverName"
              placeholder="收货地"
              aria-label="收货地"
              clearable
            />
          </div>
          <div class="list-filter-field list-filter-field--date-range">
            <el-date-picker
              v-model="dates"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="运输开始日期"
              end-placeholder="运输结束日期"
              aria-label="运输日期"
            />
          </div>
          <div class="list-filter-field list-filter-field--select">
            <el-select
              v-model="query.relationState"
              placeholder="销售关联状态"
              aria-label="销售关联状态"
              clearable
              ><el-option label="未关联销售单" value="UNLINKED" /><el-option
                label="已关联销售单"
                value="LINKED"
            /></el-select>
          </div>
        </template>
      </OrderRegisterFilterCard>
      <el-table
        v-loading="loading"
        :data="rows"
        border
        max-height="clamp(260px, calc(94dvh - 460px), 560px)"
        empty-text="暂无符合条件的已完成运输记录"
        row-key="record.id"
        @row-click="select"
      >
        <el-table-column label="选择" width="65" fixed="left"
          ><template #default="{ row }"
            ><el-radio
              :model-value="selected?.record.id"
              :value="row.record.id"
              :aria-label="`选择${no(row as TransportDetail)}`"
              :disabled="row.record.statusCode !== 'ACTIVE'"
              @change="select(row as TransportDetail)"
              ><span /></el-radio></template
        ></el-table-column>
        <el-table-column label="快递单号／费用单号" min-width="220"
          ><template #default="{ row }"
            >{{ no(row as TransportDetail) }}
            <div class="secondary">{{ row.record.documentNo }}</div></template
          ></el-table-column
        >
        <el-table-column label="下单时间" width="180"
          ><template #default="{ row }">{{
            orderedAt(row as TransportDetail) || '-'
          }}</template></el-table-column
        >
        <el-table-column label="车型" width="100"
          ><template #default="{ row }">{{ vehicleOf(row.platform) }}</template></el-table-column
        >
        <el-table-column label="行驶路段" min-width="230"
          ><template #default="{ row }"
            ><TransportRouteSummary :route="routeOf(row.record, row.platform)" /></template
        ></el-table-column>
        <el-table-column label="运输费用（元）" width="140" align="right"
          ><template #default="{ row }">{{
            money(amountOf(row.record, row.platform))
          }}</template></el-table-column
        >
        <el-table-column label="已关联销售单" min-width="180" fixed="right"
          ><template #default="{ row }">{{
            ordersOf(row.record, row.platform).join('、') || '-'
          }}</template></el-table-column
        >
      </el-table>
      <div class="chooser-pager">
        <el-button :disabled="offset === 0 || loading" @click="page(-1)">上一页</el-button
        ><el-button :disabled="!hasNext || loading" @click="page(1)">下一页</el-button>
      </div>
      <section v-if="selected" class="chooser-section selected-preview" aria-label="已选物流信息">
        <h3>已选物流信息</h3>
        <el-descriptions :column="2" border
          ><el-descriptions-item label="快递单号">{{ no(selected) }}</el-descriptions-item
          ><el-descriptions-item label="物流公司">货拉拉</el-descriptions-item
          ><el-descriptions-item label="运输费用">{{
            money(amountOf(selected.record, selected.platform))
          }}</el-descriptions-item
          ><el-descriptions-item label="下单时间">{{
            orderedAt(selected) || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="车型">{{
            vehicleOf(selected.platform)
          }}</el-descriptions-item>
          <el-descriptions-item label="行驶路段"
            ><TransportRouteSummary :route="routeOf(selected.record, selected.platform)"
          /></el-descriptions-item>
          <el-descriptions-item label="本次关联归属"
            >{{ context.salesOrder.employeeName || '-' }}／{{
              context.salesOrder.departmentName || '-'
            }}</el-descriptions-item
          ></el-descriptions
        >
        <h3 class="allocation-heading">关联后分摊预览</h3>
        <el-table :data="allocationPreview" border>
          <el-table-column prop="code" label="销售订单号" min-width="180" />
          <el-table-column label="分摊运输费用（元）" align="right" min-width="160">
            <template #default="{ row }">{{ money(row.amount) }}</template>
          </el-table-column>
        </el-table>
      </section>
    </section>
    <section v-if="automatic.length" class="chooser-section">
      <h3>已自动带入</h3>
      <el-table :data="automatic" border
        ><el-table-column prop="record.documentNo" label="费用单号" /><el-table-column
          label="物流公司"
          ><template #default="{ row }">{{
            carrierName(row as TransportDetail)
          }}</template></el-table-column
        ><el-table-column label="快递单号"
          ><template #default="{ row }">{{ no(row as TransportDetail) }}</template></el-table-column
        ><el-table-column label="操作" width="90"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="emit('view', row.record.id)"
              >查看</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </section>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">关闭</el-button
      ><el-button
        v-if="carrier === 'HLL' && mode !== 'SELF'"
        type="primary"
        :disabled="!selected || !context.canAssociate"
        :loading="saving"
        @click="save"
        >保存关联</el-button
      ></template
    >
    <TransportRecordEditor
      v-if="manualOpen"
      v-model="manualOpen"
      :detail="null"
      :readonly="false"
      :sales-order-id="orderId"
      :sales-source="context.salesOrder"
      :initial-carrier-code="mode === 'SELF' ? null : carrier"
      :initial-delivery-mode="mode"
      @saved="manualSaved"
    />
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { SalesLogisticsContext } from '@/api/core/sales-logistics'
import { linkSalesLogistics } from '@/api/core/sales-logistics'
import { getTransportRecords, type TransportDetail } from '@/api/core/transport-records'
import { costOptions, costLabel } from '../../cost/cost-dictionaries'
import {
  amountOf,
  frozenTransportSources,
  money,
  ordersOf,
  routeOf,
  transportTimeOf,
  vehicleOf,
} from '../../cost/transport-records'
import { savedTransportAllocations, transportAllocations } from '../../cost/transport-allocation'
import { currentSource } from '../../cost/huolala-source'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import TransportRecordEditor from '../../cost/TransportRecordEditor.vue'
import TransportRouteSummary from '../../cost/TransportRouteSummary.vue'
import { errorMessage } from '@/api/core/error'
const props = defineProps<{ orderId: string | number; context: SalesLogisticsContext }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: []; view: [id: string] }>()
const mode = ref('THIRD_PARTY'),
  carrier = ref<string | null>(null)
const manualOpen = ref(false),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  offset = ref(0),
  hasNext = ref(false)
const dates = ref<string[]>([]),
  query = ref({
    platformOrderNo: '',
    platformEmployeeName: '',
    receiverName: '',
    relationState: '',
  })
const rows = ref<TransportDetail[]>([]),
  selected = ref<TransportDetail | null>(null)
const allocationPreview = computed(() => {
  if (!selected.value) return []
  const record = selected.value
  const sources = frozenTransportSources(record.record)
  if (alreadyLinked(record)) return savedTransportAllocations(record, sources)
  const codes = [...ordersOf(record.record, record.platform), props.context.salesOrder.documentNo]
  const amount = amountOf(record.record, record.platform)
  return transportAllocations(amount == null ? null : Number(amount), codes, [
    ...sources,
    props.context.salesOrder,
  ])
})
const automatic = computed(() =>
  props.context.transports.filter((r) => r.record.statusCode === 'ACTIVE' && !!r.shipments?.length),
)
const modeOptions = computed(() => costOptions('COST_DELIVERY_MODE'))
const carrierOptions = computed(() => costOptions('COST_CARRIER'))
const supportedMode = computed(() =>
  modeOptions.value.some((option) => option.value === mode.value),
)
const no = (r: TransportDetail) =>
  r.platform
    ? currentSource(r.platform.source).orderNo
    : r.shipments?.[0]?.latest.trackingNumbers.join('、') ||
      r.record.data.ledger?.platformOrderNo ||
      '-'
const carrierName = (r: TransportDetail) =>
  r.platform
    ? '货拉拉'
    : r.shipments?.[0]?.latest.carrierName ||
      costLabel('COST_CARRIER', r.record.data.ledger?.carrierCode)
const orderedAt = (r: TransportDetail) => transportTimeOf(r.record, r.platform, r.shipments)
const alreadyLinked = (r: TransportDetail) =>
  ordersOf(r.record, r.platform).includes(props.context.salesOrder.documentNo)
function select(r: TransportDetail) {
  if (r.record.statusCode === 'ACTIVE') selected.value = r
}
function resetFilters() {
  query.value = {
    platformOrderNo: '',
    platformEmployeeName: '',
    receiverName: '',
    relationState: '',
  }
  dates.value = []
  offset.value = 0
  void load()
}
let serial = 0
async function load() {
  const run = ++serial
  loading.value = true
  error.value = ''
  selected.value = null
  try {
    const p = await getTransportRecords({
      ...query.value,
      dateFrom: dates.value?.[0],
      dateTo: dates.value?.[1],
      begin: offset.value,
      step: 50,
      sourceSystem: 'HUOLALA',
      carrierCode: 'HLL',
    })
    if (run === serial) {
      hasNext.value = offset.value + p.page.items.length < p.page.total
      rows.value = p.page.items
        .map((record) => ({ record, platform: p.platformRecords[record.id] || null }))
        .filter(
          (r) =>
            r.platform &&
            currentSource(r.platform.source).status === '已完成' &&
            r.record.statusCode === 'ACTIVE' &&
            (!r.record.data.typeCode || r.record.data.typeCode === 'DELIVERY'),
        )
    }
  } catch (e) {
    if (run === serial) {
      rows.value = []
      error.value = errorMessage(e, '运输列表加载失败，请重试')
    }
  } finally {
    if (run === serial) loading.value = false
  }
}
function selectionChanged() {
  selected.value = null
  offset.value = 0
  if (carrier.value === 'HLL' && mode.value !== 'SELF') void load()
}
function page(direction: number) {
  offset.value = Math.max(0, offset.value + direction * 50)
  void load()
}
async function save() {
  if (!selected.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await linkSalesLogistics(
      props.orderId,
      selected.value.record.id,
      selected.value.record.revision,
    )
    ElMessage.success('物流已关联')
    emit('saved')
    visible.value = false
  } catch (e) {
    error.value = errorMessage(e, '关联失败，请刷新后核对')
  } finally {
    saving.value = false
  }
}
function manualSaved() {
  emit('saved')
  visible.value = false
}
</script>
<style scoped>
:global(.sales-logistics-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 94dvh;
}
:global(.sales-logistics-dialog > .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
}
:global(.sales-logistics-dialog > .el-dialog__header),
:global(.sales-logistics-dialog > .el-dialog__footer) {
  flex-shrink: 0;
}
.sales-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
  padding: 16px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.sales-context > div {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.context-address {
  grid-column: span 2;
}
.sales-context dt {
  flex: 0 0 80px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.sales-context dd {
  min-width: 0;
  margin: 0;
  color: var(--el-text-color-primary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.context-contact dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.contact-phone {
  white-space: nowrap;
}
.chooser-delivery {
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.delivery-form {
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(280px, 340px) minmax(0, 1fr);
  align-items: center;
  gap: 16px 24px;
}
.delivery-form :deep(.el-form-item),
.delivery-form :deep(.el-form-item__content) {
  min-width: 0;
  margin: 0;
}
.delivery-form :deep(.el-select) {
  width: 100%;
}
.chooser-results {
  margin-top: 16px;
}
.chooser-results > .order-register-filter {
  margin-bottom: 16px;
}
.chooser-section {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
.allocation-heading {
  margin-top: 20px;
}
.secondary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}
.chooser-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .sales-context {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;
  }
  .context-address {
    grid-column: 1 / -1;
  }
  .delivery-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .manual-entry {
    grid-column: 1 / -1;
  }
}
@media (max-width: 600px) {
  .sales-context,
  .delivery-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .sales-context {
    padding: 12px;
  }
}
</style>
