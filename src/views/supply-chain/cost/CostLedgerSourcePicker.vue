<template>
  <el-dialog
    v-model="visible"
    title="选择关联单据"
    width="min(1320px, 94vw)"
    append-to-body
    destroy-on-close
    @open="reset"
  >
    <el-form class="source-filters" label-position="top" @submit.prevent="search">
      <el-form-item label="订单类型"
        ><el-select v-model="query.orderTypeCode" :disabled="!!orderTypeCode" @change="search"
          ><el-option
            v-for="t in types"
            :key="t.value"
            :label="t.label"
            :value="t.value" /></el-select
      ></el-form-item>
      <el-form-item
        :label="query.orderTypeCode === 'SALES_ORDER' ? '销售单号／订货宝单号' : '单据编号'"
        ><el-input v-model="query.documentNo" clearable @keyup.enter="search"
      /></el-form-item>
      <el-form-item v-if="query.orderTypeCode === 'SALES_ORDER'" label="业务员"
        ><el-input v-model="query.employeeName" clearable @keyup.enter="search"
      /></el-form-item>
      <el-form-item
        :label="query.orderTypeCode === 'TRANSFER_ORDER' ? '收货仓名称' : '客户 / 收货方名称'"
        ><el-input v-model="query.partyName" clearable @keyup.enter="search"
      /></el-form-item>
      <el-form-item v-if="query.orderTypeCode !== 'PURCHASE_ORDER'" label="发货仓库"
        ><CostLedgerPartySelect v-model="sourceWarehouse" logistics kind="WAREHOUSE"
      /></el-form-item>
      <el-form-item v-if="query.orderTypeCode === 'TRANSFER_ORDER'" label="收货仓库"
        ><CostLedgerPartySelect v-model="targetWarehouse" logistics kind="WAREHOUSE"
      /></el-form-item>
      <el-form-item label="单据日期"
        ><el-date-picker
          v-model="dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="截止日期"
      /></el-form-item>
    </el-form>
    <div class="picker-toolbar">
      <span>已选 {{ chosen.size }} 张单据</span>
      <div>
        <el-button @click="clearFilters">重置</el-button
        ><el-button type="primary" :loading="loading" @click="search">查询</el-button>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table
      v-loading="loading"
      :data="rows"
      border
      max-height="420"
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
            :disabled="existing.has(key(row as PickedLedgerSource)) || !!row.referenceIssue"
            :aria-label="`选择${row.documentNo}`"
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
      <el-table-column v-if="suggestedReceiver" label="推荐依据" min-width="150"
        ><template #default="{ row }">{{
          recommendation(row as PickedLedgerSource) || '请人工核对'
        }}</template></el-table-column
      >
      <el-table-column prop="senderName" label="发货方" min-width="190" /><el-table-column
        prop="receiverName"
        label="收货方"
        min-width="200"
      /><el-table-column label="来源状态" width="130"
        ><template #default="{ row }">{{ sourceStatus(row.statusCode) }}</template></el-table-column
      >
      <el-table-column
        v-if="query.orderTypeCode === 'SALES_ORDER'"
        label="关联检查"
        min-width="240"
      >
        <template #default="{ row }"
          ><span :class="{ 'reference-issue': row.referenceIssue }">{{
            row.referenceIssue || (row.senderCode ? '可关联' : '选择后补充发货仓库')
          }}</span></template
        >
      </el-table-column>
    </el-table>
    <div class="picker-toolbar">
      <span>已添加的单据不可重复选择。</span>
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
import { computed, ref } from 'vue'
import { getLedgerSources, type LedgerSourceQuery } from '@/api/core/cost-ledger'
import type { CostSource } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import { logisticsOrderTypes } from './cost-transport-types'
const visible = defineModel<boolean>({ required: true })
const props = defineProps<{
  selectedKeys: string[]
  orderTypeCode?: string
  suggestedDate?: string
  suggestedOrderNo?: string
  suggestedReceiver?: string
}>()
export type PickedLedgerSource = CostSource & { orderTypeCode: string }
const emit = defineEmits<{ selected: [rows: PickedLedgerSource[]] }>()
const sourceStatus = (status: string) =>
  ({
    CONFIRMED: '已确认',
    OUT_CONFIRMED: '已出库',
    IN_CONFIRMED: '已入库',
    SUBMITTED: '已提交',
    APPROVED: '已审核',
    COMPLETED: '已完成',
    DELIVERED: '已送达',
    SHIPPED: '已发货',
  })[status] || '可引用'
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
  rows.value.filter((r) => !existing.value.has(key(r)) && !r.referenceIssue),
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
    if (current === serial)
      rows.value = data
        .map((r) => ({ ...r, orderTypeCode: type }))
        .sort((a, b) => Number(!!recommendation(b)) - Number(!!recommendation(a)))
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
  if (existing.value.has(key(row)) || row.referenceIssue) return
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
function recommendation(row: PickedLedgerSource) {
  const normalize = (value: string) => value.replace(/[\s，,。；;\-]/g, '')
  const raw = normalize(props.suggestedReceiver || '')
  const matches = [
    ['联系电话', row.contactPhone],
    ['收货地址', row.destinationAddress],
    ['客户名称', row.receiverName],
    ['收货人', row.contactName],
  ]
    .filter(([, value]) => value && value.length >= 2 && raw.includes(normalize(value)))
    .map(([label]) => label)
  return matches.join('、')
}
</script>
<style scoped>
.source-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 20px;
}
.reference-issue {
  color: var(--el-color-warning-dark-2);
}
.source-filters :deep(.el-select),
.source-filters :deep(.el-date-editor) {
  width: 100%;
}
.picker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 12px 0;
  color: var(--el-text-color-secondary);
}
@media (max-width: 800px) {
  .source-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
