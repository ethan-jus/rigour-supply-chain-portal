<template>
  <el-dialog
    v-model="visible"
    title="选择关联单据"
    class="cost-source-picker"
    top="4vh"
    width="min(1320px, 94vw)"
    append-to-body
    destroy-on-close
    @open="reset"
  >
    <OrderRegisterFilterCard
      class="order-register-filter--compact"
      :loading="loading"
      @search="search"
      @reset="clearFilters"
    >
      <template #primary>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="query.orderTypeCode"
            aria-label="订单类型"
            :disabled="!!orderTypeCode"
            @change="search"
            ><el-option v-for="t in types" :key="t.value" :label="t.label" :value="t.value"
          /></el-select>
        </div>
        <div class="list-filter-field">
          <el-input
            v-model="query.documentNo"
            :placeholder="
              query.orderTypeCode === 'SALES_ORDER' ? '销售单号／订货宝单号' : '单据编号'
            "
            aria-label="单据编号"
            clearable
          />
        </div>
        <div
          v-if="query.orderTypeCode === 'SALES_ORDER'"
          class="list-filter-field list-filter-field--person"
        >
          <el-input
            v-model="query.employeeName"
            placeholder="业务员"
            aria-label="业务员"
            clearable
          />
        </div>
        <div
          v-if="query.orderTypeCode === 'SALES_ORDER'"
          class="list-filter-field list-filter-field--select"
        >
          <el-input
            v-model="query.departmentName"
            placeholder="归属部门"
            aria-label="归属部门"
            clearable
          />
        </div>
        <div class="list-filter-field">
          <el-input
            v-model="query.partyName"
            :placeholder="
              query.orderTypeCode === 'TRANSFER_ORDER' ? '收货仓名称' : '客户／收货方名称'
            "
            aria-label="客户或收货方"
            clearable
          />
        </div>
        <div
          v-if="query.orderTypeCode !== 'PURCHASE_ORDER'"
          class="list-filter-field list-filter-field--select"
        >
          <CostLedgerPartySelect
            v-model="sourceWarehouse"
            logistics
            kind="WAREHOUSE"
            placeholder="发货仓库"
          />
        </div>
        <div
          v-if="query.orderTypeCode === 'TRANSFER_ORDER'"
          class="list-filter-field list-filter-field--select"
        >
          <CostLedgerPartySelect
            v-model="targetWarehouse"
            logistics
            kind="WAREHOUSE"
            placeholder="收货仓库"
          />
        </div>
        <div class="list-filter-field list-filter-field--date-range">
          <el-date-picker
            v-model="dates"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
            aria-label="单据日期"
          />
        </div>
      </template>
    </OrderRegisterFilterCard>
    <div class="picker-toolbar">
      <span>已选 {{ chosen.size }} 张单据</span>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table
      v-loading="loading"
      :data="rows"
      border
      max-height="min(420px, 40vh)"
      row-key="documentNo"
      empty-text="暂无符合条件且可引用的单据"
    >
      <el-table-column width="55"
        ><template #header
          ><el-checkbox
            :model-value="allSelected"
            :indeterminate="someSelected && !allSelected"
            aria-label="勾选本页单据"
            @change="togglePage" /></template
        ><template #default="{ row }"
          ><el-checkbox
            :model-value="chosen.has(key(row as PickedLedgerSource))"
            :disabled="
              existing.has(key(row as PickedLedgerSource)) ||
              (!!row.referenceIssue && !allowIncomplete)
            "
            :aria-label="`选择${row.documentNo}`"
            :title="row.referenceIssue || undefined"
            @change="(value) => toggle(row as PickedLedgerSource, !!value)" /></template
      ></el-table-column>
      <el-table-column prop="documentNo" label="单据编号" min-width="220" /><el-table-column
        label="单据日期"
        width="130"
        ><template #default="{ row }">{{ row.documentDate || '—' }}</template></el-table-column
      >
      <el-table-column
        v-if="query.orderTypeCode === 'SALES_ORDER'"
        prop="originalNo"
        label="订货宝销售单号"
        min-width="190"
      />
      <el-table-column
        v-if="query.orderTypeCode === 'SALES_ORDER'"
        prop="employeeName"
        label="业务员"
        width="120"
      />
      <el-table-column
        v-if="query.orderTypeCode === 'SALES_ORDER'"
        prop="departmentName"
        label="部门"
        min-width="140"
      />
      <el-table-column label="业务单金额（元）" min-width="155" align="right"
        ><template #default="{ row }">{{ money(row.documentAmount) }}</template></el-table-column
      >
      <el-table-column label="已关联物流" width="130">
        <template #default="{ row }">{{
          row.linkedLogisticsCount == null ? '-' : `${row.linkedLogisticsCount}笔`
        }}</template>
      </el-table-column>
      <el-table-column prop="senderName" label="发货方" min-width="190" /><el-table-column
        prop="receiverName"
        label="收货方"
        min-width="200"
      />
    </el-table>
    <div class="picker-toolbar">
      <div>
        <el-button :disabled="loading || offset === 0" @click="page(-1)">上一页</el-button
        ><el-button :disabled="loading || rows.length < 50" @click="page(1)">下一页</el-button>
      </div>
    </div>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="!chosen.size || loading" @click="confirm"
        >确定带回（{{ chosen.size }}）</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import { computed, ref } from 'vue'
import { getLedgerSources, type LedgerSourceQuery } from '@/api/core/cost-ledger'
import type { CostSource } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import { logisticsOrderTypes } from './cost-transport-types'
import { money } from './transport-records'
const visible = defineModel<boolean>({ required: true })
const props = defineProps<{
  allowIncomplete?: boolean
  selectedKeys: string[]
  orderTypeCode?: string
  suggestedDate?: string
  suggestedOrderNo?: string
  suggestedEmployeeCode?: string
  suggestedReceiver?: string
}>()
export type PickedLedgerSource = CostSource & { orderTypeCode: string }
const emit = defineEmits<{ selected: [rows: PickedLedgerSource[]] }>()
const types = logisticsOrderTypes
const query = ref<LedgerSourceQuery>({ orderTypeCode: 'TRANSFER_ORDER', begin: 0 })
const rows = ref<PickedLedgerSource[]>([]),
  chosen = ref(new Map<string, PickedLedgerSource>())
const loading = ref(false),
  error = ref(''),
  offset = ref(0),
  dates = ref<string[]>([])
const sourceWarehouse = ref<string | null>(null),
  targetWarehouse = ref<string | null>(null)
const existing = computed(() => new Set(props.selectedKeys))
const key = (row: PickedLedgerSource) => `${row.orderTypeCode}:${row.documentNo}`
const selectable = computed(() =>
  rows.value.filter(
    (r) => !existing.value.has(key(r)) && (!r.referenceIssue || props.allowIncomplete),
  ),
)
const allSelected = computed(
  () => !!selectable.value.length && selectable.value.every((r) => chosen.value.has(key(r))),
)
const someSelected = computed(() => selectable.value.some((r) => chosen.value.has(key(r))))
let serial = 0
async function load() {
  const current = ++serial
  loading.value = true
  error.value = ''
  const type = query.value.orderTypeCode
  try {
    const data = await getLedgerSources({
      ...query.value,
      begin: offset.value,
      sourceWarehouseCode:
        type === 'PURCHASE_ORDER' ? undefined : sourceWarehouse.value || undefined,
      targetWarehouseCode: ['PURCHASE_ORDER', 'TRANSFER_ORDER'].includes(type)
        ? targetWarehouse.value || undefined
        : undefined,
      dateFrom: dates.value?.[0],
      dateTo: dates.value?.[1],
    })
    if (current === serial) rows.value = data.map((r) => ({ ...r, orderTypeCode: type }))
  } catch (e) {
    if (current === serial) {
      rows.value = []
      error.value = errorMessage(e, '单据加载失败')
    }
  } finally {
    if (current === serial) loading.value = false
  }
}
function search() {
  offset.value = 0
  void load()
}
function page(direction: number) {
  offset.value = Math.max(0, offset.value + direction * 50)
  void load()
}
function toggle(row: PickedLedgerSource, value: boolean) {
  if (existing.value.has(key(row)) || (row.referenceIssue && !props.allowIncomplete)) return
  if (value) chosen.value.set(key(row), row)
  else chosen.value.delete(key(row))
}
function togglePage(value: unknown) {
  selectable.value.forEach((r) => toggle(r, !!value))
}
function clearFilters() {
  query.value = { orderTypeCode: query.value.orderTypeCode, begin: 0 }
  dates.value = []
  sourceWarehouse.value = null
  targetWarehouse.value = null
  search()
}
function reset() {
  chosen.value = new Map()
  if (props.orderTypeCode) query.value.orderTypeCode = props.orderTypeCode
  query.value = { orderTypeCode: query.value.orderTypeCode, begin: 0 }
  dates.value = []
  sourceWarehouse.value = null
  targetWarehouse.value = null
  if (props.suggestedOrderNo) {
    query.value.documentNo = props.suggestedOrderNo
  } else if (props.suggestedDate) {
    const date = new Date(`${props.suggestedDate}T00:00:00Z`)
    dates.value = [
      new Date(date.getTime() - 7 * 86400000).toISOString().slice(0, 10),
      new Date(date.getTime() + 86400000).toISOString().slice(0, 10),
    ]
  }
  search()
}
function confirm() {
  emit('selected', [...chosen.value.values()])
  visible.value = false
}
</script>
<style scoped>
:global(.cost-source-picker) {
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
:global(.cost-source-picker .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
}
:global(.cost-source-picker .el-dialog__header),
:global(.cost-source-picker .el-dialog__footer) {
  flex-shrink: 0;
}

.picker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 12px 0;
  color: var(--el-text-color-secondary);
}
</style>
