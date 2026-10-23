<template>
  <el-form label-position="top" :disabled="disabled">
    <el-alert
      title="整单付清后计提；销售与城市总分别计算，合计仅用于核对，不重复计入工资。"
      type="info"
      :closable="false"
    />
    <div class="scheme-grid">
      <el-form-item label="城市总归属时点"
        ><el-select v-model="form.commission.managerAttribution"
          ><el-option label="订单日期" value="ORDER_DATE" /><el-option
            label="整单付清日期"
            value="FULLY_PAID_DATE" /></el-select
      ></el-form-item>
      <el-form-item label="提成标准取值时点"
        ><el-select v-model="form.commission.standardDate"
          ><el-option label="订单日期" value="ORDER_DATE" /><el-option
            label="整单付清日期"
            value="FULLY_PAID_DATE" /></el-select
      ></el-form-item>
    </div>
    <div class="commission-toolbar">
      <el-button @click="addRow()">新增商品标准</el-button>
      <el-button @click="addPreset('方便面', 4, 1)">方便面 4%／1%</el-button>
      <el-button @click="addPreset('台球周边（排除台呢）', 10, 2)">台球周边 10%／2%</el-button>
      <el-button :disabled="!selected.length" @click="batchVisible = true">批量设置标准</el-button>
    </div>
    <p class="field-hint">
      分类标准与具体型号均从 ERP
      选择；型号标准优先于分类标准。比例按订单商品回款基数计算，数量提成必须与订单单位一致。商品价格在
      ERP 维护。
    </p>
    <el-table :data="rows" row-key="code" border @selection-change="selected = $event">
      <el-table-column type="selection" width="45" />
      <el-table-column label="商品分类／型号" min-width="240"
        ><template #default="{ row }">
          <strong>{{ row.name || '未命名商品标准' }}</strong>
          <div class="field-hint">{{ scopeLabel(row as PayrollCommissionRow) }}</div>
          <el-button
            link
            type="primary"
            :disabled="false"
            @click="scopeRow = row as PayrollCommissionRow"
            >{{ disabled ? '查看商品与排除项' : '选择商品与排除项' }}</el-button
          >
        </template></el-table-column
      >
      <el-table-column label="销售人员提成" min-width="240"
        ><template #default="{ row }"><PayrollCommissionRateEditor v-model="row.sales" /></template
      ></el-table-column>
      <el-table-column label="城市总提成" min-width="240"
        ><template #default="{ row }"
          ><PayrollCommissionRateEditor v-model="row.manager" /></template
      ></el-table-column>
      <el-table-column label="标准合计" min-width="135"
        ><template #default="{ row }">{{
          totalLabel(row as PayrollCommissionRow)
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="70"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="rows.splice($index, 1)">移除</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-empty
      v-if="!rows.length"
      description="尚未配置商品标准；如明确全部不计提，请保存空标准并填写原因"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-dialog
      :model-value="!!scopeRow"
      title="商品范围"
      width="760px"
      append-to-body
      @close="scopeRow = null"
    >
      <el-form v-if="scopeRow" label-position="top" :disabled="disabled">
        <el-form-item label="标准名称" required
          ><el-input
            v-model="scopeRow.name"
            placeholder="例如：澳洋华彩 A300"
            @input="scopeErrors.name = ''"
        /></el-form-item>
        <el-form-item
          label="适用商品分类"
          :required="!scopeRow.sales.categoryIds.length && !scopeRow.sales.variantIds.length"
          ><el-tree-select
            ref="categorySelect"
            v-model="categoryKeys"
            :data="tree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            multiple
            show-checkbox
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="3"
            filterable
            :render-after-expand="false"
            @check="(_, state) => updateCategorySelection(state)"
            @remove-tag="removeCategoryTag"
        /></el-form-item>
        <p class="field-hint">
          勾选父分类包含全部子分类；取消子分类即自动排除，无需重复设置。所选分类整体适用本行提成标准。
        </p>
        <el-alert v-if="scopeNotice" :title="scopeNotice" type="info" :closable="false" />
        <el-form-item
          label="指定商品型号／规格"
          :required="!scopeRow.sales.categoryIds.length && !scopeRow.sales.variantIds.length"
          ><el-select
            v-model="scopeRow.sales.variantIds"
            multiple
            filterable
            remote
            placeholder="搜索商品名称或规格"
            :remote-method="search"
            :loading="loading"
            @change="clearScopeRangeError"
            ><el-option
              v-for="p in productOptions(scopeRow.sales.variantIds)"
              :key="p.productVariantId"
              :value="String(p.productVariantId)"
              :disabled="!categoryScope.includes(p, scopeRow.sales)"
              :label="productLabel(p)" /></el-select
        ></el-form-item>
        <el-form-item label="排除商品型号／规格"
          ><el-select
            v-model="scopeRow.sales.excludedVariantIds"
            multiple
            filterable
            remote
            placeholder="选择当前分类中不参与计提的商品"
            :remote-method="search"
            :loading="loading"
            ><el-option
              v-for="p in productOptions(scopeRow.sales.excludedVariantIds)"
              :key="p.productVariantId"
              :value="String(p.productVariantId)"
              :disabled="!categoryScope.includes(p, scopeRow.sales)"
              :label="productLabel(p)" /></el-select
        ></el-form-item>
        <el-alert v-if="productError" :title="productError" type="error" :closable="false" />
        <el-alert
          v-if="hasOutsideProducts"
          title="已有商品不在当前分类范围内，仍保留历史设置，请移除或调整分类后核对。"
          type="warning"
          :closable="false"
        />
        <el-table
          v-if="excludedRows(scopeRow).length"
          :data="excludedRows(scopeRow)"
          border
          class="scope-exclusions"
        >
          <el-table-column prop="kind" label="排除范围" width="120" />
          <el-table-column prop="name" label="本行不参与计提的分类／商品" />
        </el-table>
        <el-alert
          v-if="scopeErrors.name || scopeErrors.range"
          :title="scopeErrors.name || scopeErrors.range"
          type="error"
          :closable="false"
        />
        <p class="field-hint">
          必填：标准名称，以及至少一种适用范围（商品分类或具体型号／规格）。排除项按需填写；商品候选限定在当前分类范围内，可输入名称继续查找。不同型号的金额不同，请分别建立标准行。
        </p>
      </el-form>
      <template #footer
        ><el-button type="primary" :disabled="false" @click="finishScope">完成</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="batchVisible" title="批量设置提成标准" width="640px" append-to-body>
      <el-form label-position="top"
        ><el-form-item label="销售人员提成"
          ><PayrollCommissionRateEditor v-model="batch.sales" /></el-form-item
        ><el-form-item label="城市总提成"
          ><PayrollCommissionRateEditor v-model="batch.manager" /></el-form-item
      ></el-form>
      <p>仅修改所选 {{ selected.length }} 行的计算方式、金额和单位，商品范围保持原值。</p>
      <template #footer
        ><el-button @click="batchVisible = false">取消</el-button
        ><el-button type="primary" @click="applyBatch">应用到所选行</el-button></template
      >
    </el-dialog>
  </el-form>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { TreeInstance } from 'element-plus'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import type { PayrollCommissionRow } from '@/api/core/payroll-scheme/models/PayrollCommissionRow'
import { getPayrollProducts, type PayrollCategory, type PayrollProduct } from '@/api/core/payroll'
import {
  commissionRows,
  newCommissionRow,
  flattenCommissionRows,
  commissionRowTotal,
} from '@/utils/payroll-commission-rows'
import { departmentTree } from '@/utils/hr-department-tree'
import { commissionCategoryScope } from '@/utils/payroll-commission-scope'
import { errorMessage } from '@/api/core/error'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
import PayrollCommissionRateEditor from './PayrollCommissionRateEditor.vue'
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const props = defineProps<{ categories: PayrollCategory[]; disabled?: boolean }>()
const tree = computed(() => departmentTree(props.categories))
const categoryScope = computed(() => commissionCategoryScope(props.categories))
const categorySelect = ref<{ treeRef: TreeInstance }>()
const categoryKeys = ref<number[]>([])
const scopeNotice = ref('')
const scopeErrors = ref({ name: '', range: '' })
const rows = ref<PayrollCommissionRow[]>(commissionRows(form.value.commission.rules))
const selected = ref<PayrollCommissionRow[]>([]),
  scopeRow = ref<PayrollCommissionRow | null>(null)
const products = ref<PayrollProduct[]>([]),
  productResults = ref<PayrollProduct[]>([]),
  productError = ref(''),
  loading = ref(false),
  error = ref('')
const batchVisible = ref(false),
  batch = ref(newCommissionRow())
const productLabel = (p: PayrollProduct) =>
  [p.productName, p.specification?.trim()].filter(Boolean).join(' / ')
function updateCategorySelection(state: { checkedKeys: number[]; halfCheckedKeys: number[] }) {
  if (!scopeRow.value || props.disabled) return
  const scope = scopeRow.value.sales
  Object.assign(scope, categoryScope.value.update(scope, state.checkedKeys, state.halfCheckedKeys))
  categoryKeys.value = categoryScope.value.checked(scope)
  clearScopeRangeError()
  let removed = 0
  for (const field of ['variantIds', 'excludedVariantIds'] as const) {
    scope[field] = scope[field].filter((id) => {
      const product = products.value.find((p) => String(p.productVariantId) === id)
      const keep =
        !!scope.categoryIds.length && !!product && categoryScope.value.includes(product, scope)
      if (!keep) removed++
      return keep
    })
  }
  scopeNotice.value = removed
    ? `分类范围已调整，已移除 ${removed} 项范围外或暂无法核对的商品选择，请核对后保存。`
    : ''
}
function clearScopeRangeError() {
  if (scopeRow.value?.sales.categoryIds.length || scopeRow.value?.sales.variantIds.length)
    scopeErrors.value.range = ''
}
function validateScopeRow(row: PayrollCommissionRow) {
  scopeErrors.value.name = row.name.trim() ? '' : '请填写标准名称'
  scopeErrors.value.range =
    row.sales.categoryIds.length || row.sales.variantIds.length
      ? ''
      : '请至少选择适用商品分类或指定商品型号／规格'
  return scopeErrors.value.name || scopeErrors.value.range
}
function finishScope() {
  if (!scopeRow.value || validateScopeRow(scopeRow.value)) return
  scopeRow.value = null
}
function validate() {
  for (const row of rows.value) {
    if (!row.name.trim() || (!row.sales.categoryIds.length && !row.sales.variantIds.length)) {
      scopeRow.value = row
      return validateScopeRow(row)
    }
  }
  return null
}
defineExpose({ validate })
async function removeCategoryTag(id: number) {
  if (!scopeRow.value || props.disabled) return
  // 原目录已不存在的历史分类也须允许通过标签明确移除。
  Object.assign(scopeRow.value.sales, categoryScope.value.remove(scopeRow.value.sales, id))
  categoryKeys.value = categoryScope.value.checked(scopeRow.value.sales)
  await nextTick()
  categorySelect.value?.treeRef.setCheckedKeys(categoryKeys.value)
  updateCategorySelection({
    checkedKeys: (categorySelect.value?.treeRef.getCheckedKeys() as number[]) ?? [],
    halfCheckedKeys: (categorySelect.value?.treeRef.getHalfCheckedKeys() as number[]) ?? [],
  })
}
watch([scopeRow, () => props.categories], () => {
  categoryKeys.value = scopeRow.value ? categoryScope.value.checked(scopeRow.value.sales) : []
  scopeNotice.value = ''
  scopeErrors.value = { name: '', range: '' }
})
const hasOutsideProducts = computed(() => {
  const scope = scopeRow.value?.sales
  return (
    !!scope &&
    [...scope.variantIds, ...scope.excludedVariantIds].some((id) => {
      const product = products.value.find((p) => String(p.productVariantId) === id)
      return product && !categoryScope.value.includes(product, scope)
    })
  )
})
function productOptions(selectedIds: string[]) {
  const scope = scopeRow.value?.sales
  if (!scope) return []
  const options = new Map(
    productResults.value
      .filter((p) => categoryScope.value.includes(p, scope))
      .map((p) => [String(p.productVariantId), p]),
  )
  // 历史已选值仅用于回显，不让其他行、旧搜索或其他分类的缓存混入候选。
  products.value
    .filter((p) => selectedIds.includes(String(p.productVariantId)))
    .forEach((p) => options.set(String(p.productVariantId), p))
  return [...options.values()]
}
// Only editing this form changes the API rules; opening an old snapshot does not write the server.
watch(
  rows,
  (value) => {
    form.value.commission.rules = flattenCommissionRows(value)
  },
  { deep: true, immediate: true },
)
function addRow(name = '') {
  const row = newCommissionRow(name)
  rows.value.push(row)
  scopeRow.value = rows.value[rows.value.length - 1]!
}
function addPreset(name: string, sales: number, manager: number) {
  addRow(name)
  scopeRow.value!.sales.value = sales
  scopeRow.value!.manager.value = manager
}
function scopeLabel(row: PayrollCommissionRow) {
  const scope = row.sales
  const names = [
    ...scope.categoryIds.map(
      (id) => props.categories.find((c) => c.id === id)?.name || `分类 ${id}`,
    ),
    ...scope.variantIds.map((id) => {
      const p = products.value.find((p) => String(p.productVariantId) === id)
      return p ? productLabel(p) : `规格 ${id}`
    }),
  ]
  const excluded = scope.excludedCategoryIds.length + scope.excludedVariantIds.length
  return (names.join('、') || '请选择 ERP 分类或规格') + (excluded ? `；排除 ${excluded} 项` : '')
}
function excludedRows(row: PayrollCommissionRow) {
  return [
    ...row.sales.excludedCategoryIds.map((id) => ({
      kind: '分类及子类',
      name: props.categories.find((c) => c.id === id)?.name || '历史分类暂不可用',
    })),
    ...row.sales.excludedVariantIds.map((id) => {
      const p = products.value.find((v) => String(v.productVariantId) === id)
      return { kind: '商品规格', name: p ? productLabel(p) : '历史商品暂不可用' }
    }),
  ]
}
function totalLabel(row: PayrollCommissionRow) {
  const total = commissionRowTotal(row)
  if (!total)
    return [row.sales, row.manager].some((r) => !r.excluded && r.value == null)
      ? '待填写'
      : '分别计算'
  return total.method === 'NONE'
    ? '不计提'
    : total.method === 'PERCENT'
      ? `${total.value}%`
      : `${total.value} 元／${payrollUnitName(total.unitCode)}`
}
function applyBatch() {
  for (const row of selected.value)
    for (const role of ['sales', 'manager'] as const) {
      const value = batch.value[role]
      Object.assign(row[role], {
        method: value.method,
        value: value.value,
        unitCode: value.unitCode,
        excluded: value.excluded,
      })
    }
  batchVisible.value = false
}
let searchVersion = 0
const scopeKey = () =>
  JSON.stringify([
    scopeRow.value?.code,
    scopeRow.value?.sales.categoryIds,
    scopeRow.value?.sales.excludedCategoryIds,
  ])
watch(scopeKey, () => {
  searchVersion++
  productResults.value = []
  productError.value = ''
  if (scopeRow.value) void search('')
  else loading.value = false
})
async function search(keyword: string) {
  const scope = scopeRow.value?.sales
  if (!scope) return
  const key = scopeKey()
  const version = ++searchVersion
  loading.value = true
  productResults.value = []
  productError.value = ''
  try {
    const categoryIds = categoryScope.value.compact(scope.categoryIds)
    const batches = await Promise.all(
      (categoryIds.length ? categoryIds : [null]).map((id) => getPayrollProducts(keyword, id)),
    )
    if (version !== searchVersion || key !== scopeKey()) return
    const found = batches.flat().filter((p) => categoryScope.value.includes(p, scope))
    productResults.value = found
    const merged = new Map(products.value.map((p) => [String(p.productVariantId), p]))
    found.forEach((p) => merged.set(String(p.productVariantId), p))
    products.value = [...merged.values()]
  } catch (e) {
    if (version === searchVersion && key === scopeKey())
      productError.value = errorMessage(e, '商品查询失败，请重新搜索')
  } finally {
    if (version === searchVersion) loading.value = false
  }
}
onMounted(async () => {
  const ids = [
    ...new Set(rows.value.flatMap((r) => [...r.sales.variantIds, ...r.sales.excludedVariantIds])),
  ]
  const results = await Promise.allSettled(ids.map((id) => getPayrollProducts('', null, id)))
  for (const result of results)
    if (result.status === 'fulfilled') products.value.push(...result.value)
    else error.value = '部分已选商品暂不可用，请核对商品目录'
})
onMounted(() => {
  void loadPayrollProductUnits()
})
</script>
<style scoped>
.commission-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.commission-toolbar .el-button {
  margin-left: 0;
}
.scope-exclusions {
  margin-top: 16px;
}
</style>
