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
          ><el-option
            v-for="option in commissionDateOptions"
            :key="option.value"
            v-bind="option" /></el-select
      ></el-form-item>
      <el-form-item label="提成标准取值时点"
        ><el-select v-model="form.commission.standardDate"
          ><el-option
            v-for="option in commissionDateOptions"
            :key="option.value"
            v-bind="option" /></el-select
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
      选择；选择分类会默认选中其全部型号，可再取消部分型号。同一型号可按不同订单单位分别设置数量提成，按型号和订单单位匹配标准。比例按订单商品回款基数计算。商品价格在
      ERP 维护。
    </p>
    <p class="field-hint">
      同一组型号按套、按床的金额不同时，点击“添加单位标准”分别填写；同一商品范围和单位不能重复配置。
    </p>
    <el-table
      :data="displayRows"
      row-key="code"
      border
      :span-method="unitSpan"
      @selection-change="selected = $event"
    >
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
          <el-button
            v-if="!disabled"
            link
            type="primary"
            @click="openUnit(row as PayrollCommissionRow)"
            >添加单位标准</el-button
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
      <el-table-column label="操作" width="85"
        ><template #default="{ row }"
          ><el-button link type="danger" @click="removeRow(row as PayrollCommissionRow)"
            >移除</el-button
          ></template
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
          选择分类后会选中该分类及子分类的全部型号，可再取消部分型号。分类范围变化时会重新全选；取消子分类会自动加入排除范围。
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
            :loading="loading || categoryLoading[scopeRow.code]"
            :disabled="categoryLoading[scopeRow.code]"
            @change="changeSelectedVariants"
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
          v-if="categoryErrors[scopeRow.code]"
          :title="categoryErrors[scopeRow.code]"
          type="error"
          :closable="false"
        />
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
          <el-table-column prop="kind" label="排除范围" width="120" :formatter="displayCell" />
          <el-table-column
            prop="name"
            label="本行不参与计提的分类／商品"
            :formatter="displayCell"
          />
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
    <el-dialog
      :model-value="!!unitSource"
      title="添加单位标准"
      width="580px"
      append-to-body
      @close="unitSource = null"
    >
      <template v-if="unitSource">
        <p>
          为“{{
            unitSource.name || '当前商品'
          }}”添加另一单位的提成，合并在同一商品下展示。原标准保留。
        </p>
        <el-alert
          v-if="
            !unitSource.name.trim() ||
            (!unitSource.sales.categoryIds.length && !unitSource.sales.variantIds.length)
          "
          title="商品范围尚未填写，可以先添加单位标准，保存规则前请在主表补齐商品。"
          type="info"
          :closable="false"
        />
        <el-form label-position="top" :disabled="disabled">
          <el-form-item label="计提单位" required>
            <el-select v-model="unitDraft.unitCode" filterable placeholder="请选择单位，如套、床">
              <el-option v-for="unit in unitOptions" :key="unit.value" v-bind="unit" />
            </el-select>
          </el-form-item>
          <el-form-item label="销售人员提成" :required="!unitSource.sales.excluded">
            <span v-if="unitSource.sales.excluded">明确不计提</span>
            <template v-else>
              <el-input-number
                v-model="unitDraft.sales"
                :min="0"
                :precision="4"
                :controls="false"
                aria-label="新单位销售提成"
              />
              <span>元／{{ payrollUnitName(unitDraft.unitCode) }}</span>
            </template>
          </el-form-item>
          <el-form-item label="城市总提成" :required="!unitSource.manager.excluded">
            <span v-if="unitSource.manager.excluded">明确不计提</span>
            <template v-else>
              <el-input-number
                v-model="unitDraft.manager"
                :min="0"
                :precision="4"
                :controls="false"
                aria-label="新单位城市总提成"
              />
              <span>元／{{ payrollUnitName(unitDraft.unitCode) }}</span>
            </template>
          </el-form-item>
        </el-form>
        <p class="field-hint">按订单上的型号、单位匹配对应金额，不自动换算单位。</p>
        <el-alert v-if="unitError" :title="unitError" type="error" :closable="false" />
      </template>
      <template #footer>
        <el-button @click="unitSource = null">取消</el-button>
        <el-button type="primary" :disabled="disabled" @click="addUnit">添加标准</el-button>
      </template>
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
import { displayCell } from '@/utils/business-display'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessageBox, type TreeInstance } from 'element-plus'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import type { PayrollCommissionRow } from '@/api/core/payroll-scheme/models/PayrollCommissionRow'
import { getPayrollProducts, type PayrollCategory, type PayrollProduct } from '@/api/core/payroll'
import {
  commissionRows,
  newCommissionRow,
  flattenCommissionRows,
  commissionRowTotal,
  duplicateCommissionScope,
  groupCommissionRows,
} from '@/utils/payroll-commission-rows'
import { departmentTree } from '@/utils/hr-department-tree'
import { commissionCategoryScope } from '@/utils/payroll-commission-scope'
import { errorMessage } from '@/api/core/error'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
import { businessDictionaryOptions } from '@/utils/business-dictionary'
import PayrollCommissionRateEditor from './PayrollCommissionRateEditor.vue'
import { commissionDateOptions } from '@/utils/payroll-rule-options'
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
const draftUnitGroups = ref<Record<string, string>>({})
const unitGroups = computed(() => groupCommissionRows(rows.value, draftUnitGroups.value))
const displayRows = computed(() => unitGroups.value.flat())
function unitSpan({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) {
  if (columnIndex !== 1) return [1, 1]
  let start = 0
  for (const group of unitGroups.value) {
    if (rowIndex < start + group.length) return rowIndex === start ? [group.length, 1] : [0, 0]
    start += group.length
  }
  return [1, 1]
}
function removeRow(row: PayrollCommissionRow) {
  if (props.disabled) return
  const index = rows.value.findIndex((candidate) => candidate.code === row.code)
  if (index >= 0) rows.value.splice(index, 1)
}
const scopeGroupCodes = ref<string[]>([])
watch(
  scopeRow,
  (row) => {
    scopeGroupCodes.value = row
      ? (unitGroups.value
          .find((group) => group.some((member) => member.code === row.code))
          ?.map((member) => member.code) ?? [row.code])
      : []
  },
  { flush: 'sync' },
)
watch(
  () =>
    scopeRow.value
      ? JSON.stringify([
          scopeRow.value.name,
          scopeRow.value.sales.categoryIds,
          scopeRow.value.sales.excludedCategoryIds,
          scopeRow.value.sales.variantIds,
          scopeRow.value.sales.excludedVariantIds,
        ])
      : '',
  () => {
    const source = scopeRow.value
    if (!source) return
    for (const row of rows.value.filter(
      (row) => row.code !== source.code && scopeGroupCodes.value.includes(row.code),
    )) {
      row.name = source.name
      Object.assign(row.sales, {
        categoryIds: [...source.sales.categoryIds],
        excludedCategoryIds: [...source.sales.excludedCategoryIds],
        variantIds: [...source.sales.variantIds],
        excludedVariantIds: [...source.sales.excludedVariantIds],
      })
    }
  },
)
const products = ref<PayrollProduct[]>([]),
  productResults = ref<PayrollProduct[]>([]),
  productError = ref(''),
  loading = ref(false),
  error = ref('')
const categoryLoading = ref<Record<string, boolean>>({})
const categoryErrors = ref<Record<string, string>>({})
const categoryVersions = new Map<string, number>()
const explicitModels = new Set<string>()
const selectedProductsLoading = ref(true)
const batchVisible = ref(false),
  batch = ref(newCommissionRow())
const unitSource = ref<PayrollCommissionRow | null>(null)
const unitDraft = ref({
  unitCode: '',
  sales: null as number | null,
  manager: null as number | null,
})
const unitError = ref('')
const unitOptions = computed(() => businessDictionaryOptions('', 'PRODUCT_UNIT'))
function unitPrerequisite(row: PayrollCommissionRow) {
  if ([row.sales, row.manager].every((rule) => rule.excluded))
    return '销售人员和城市总均已设为明确不计提，无需添加单位标准。'
  const roles = [
    { name: '销售人员', rule: row.sales },
    { name: '城市总', rule: row.manager },
  ]
  const nonQuantity = roles.filter(({ rule }) => rule.method !== 'QUANTITY')
  if (nonQuantity.length)
    return `${nonQuantity.map(({ name }) => name).join('、')}当前不是按数量计提。不同单位的金额需使用按数量方式，请先核对原标准。`
  const missing = roles.filter(({ rule }) => !rule.unitCode)
  return missing.length
    ? `请先填写${missing.map(({ name }) => name).join('、')}的计提单位，再添加其他单位标准。`
    : ''
}
function canAddUnit(row: PayrollCommissionRow) {
  return !unitPrerequisite(row)
}
function openUnit(row: PayrollCommissionRow) {
  if (props.disabled) return
  if (!canAddUnit(row)) {
    void ElMessageBox.alert(unitPrerequisite(row), '添加单位标准', {
      confirmButtonText: '知道了',
      type: 'warning',
    }).catch(() => undefined)
    return
  }
  unitDraft.value = { unitCode: '', sales: null, manager: null }
  unitError.value = ''
  unitSource.value = row
}
function addUnit() {
  const source = unitSource.value
  if (!source || props.disabled) return
  if (!canAddUnit(source)) {
    unitError.value = unitPrerequisite(source)
    return
  }
  const draft = unitDraft.value
  if (!unitOptions.value.some((unit) => unit.value === draft.unitCode)) {
    unitError.value = '请选择有效的计提单位'
    return
  }
  if (
    [source.sales.excluded ? 0 : draft.sales, source.manager.excluded ? 0 : draft.manager].some(
      (amount) => amount == null || !Number.isFinite(amount) || amount < 0,
    )
  ) {
    unitError.value = '请分别填写销售和城市总的提成金额；不计提的角色沿用原设置'
    return
  }
  const row = newCommissionRow(source.name)
  for (const role of ['sales', 'manager'] as const) {
    Object.assign(row[role], {
      categoryIds: [...source.sales.categoryIds],
      excludedCategoryIds: [...source.sales.excludedCategoryIds],
      variantIds: [...source.sales.variantIds],
      excludedVariantIds: [...source.sales.excludedVariantIds],
      method: 'QUANTITY',
      value: source[role].excluded ? source[role].value : draft[role],
      excluded: source[role].excluded,
      unitCode: draft.unitCode,
    })
  }
  const hasScope = (item: PayrollCommissionRow) =>
    item.sales.categoryIds.length || item.sales.variantIds.length
  const current = hasScope(source)
    ? rows.value.filter(hasScope)
    : unitGroups.value.find((group) => group.some((item) => item.code === source.code)) || [source]
  const message = duplicateCommissionScope([...current, row])
  if (message) {
    unitError.value = message
    return
  }
  draftUnitGroups.value[row.code] = draftUnitGroups.value[source.code] || source.code
  rows.value.splice(rows.value.indexOf(source) + 1, 0, row)
  unitSource.value = null
}
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
  void selectCategoryModels(scopeRow.value)
}
async function selectCategoryModels(row: PayrollCommissionRow) {
  const version = (categoryVersions.get(row.code) ?? 0) + 1
  categoryVersions.set(row.code, version)
  categoryErrors.value[row.code] = ''
  const scope = row.sales
  if (!scope.categoryIds.length) {
    scope.variantIds = []
    categoryLoading.value[row.code] = false
    return
  }
  explicitModels.add(row.code)
  categoryLoading.value[row.code] = true
  try {
    const found = new Map<string, PayrollProduct>()
    for (const category of categoryScope.value.compact(scope.categoryIds)) {
      const seen = new Set<string>()
      for (let begin = 0; ; begin += 100) {
        const batch = await getPayrollProducts('', category, null, begin)
        if (categoryVersions.get(row.code) !== version) return
        const fresh = batch.filter((product) => !seen.has(String(product.productVariantId)))
        if (begin > 0 && batch.length && !fresh.length)
          throw new Error('商品目录分页未生效，请更新 HR 和 ERP 服务后重新选择分类')
        batch.forEach((product) => seen.add(String(product.productVariantId)))
        batch
          .filter((product) => categoryScope.value.includes(product, scope))
          .forEach((product) => found.set(String(product.productVariantId), product))
        if (batch.length < 100) break
      }
    }
    if (categoryVersions.get(row.code) !== version) return
    const merged = new Map(
      products.value.map((product) => [String(product.productVariantId), product]),
    )
    found.forEach((product, id) => merged.set(id, product))
    products.value = [...merged.values()]
    const excluded = new Set(scope.excludedVariantIds.map(String))
    scope.variantIds = [...found.keys()].filter((id) => !excluded.has(id))
    if (!scope.variantIds.length)
      categoryErrors.value[row.code] = '当前分类范围没有可计提的型号，请调整分类或排除项'
    if (scopeRow.value?.code === row.code)
      scopeNotice.value = `分类范围已调整，已选中 ${scope.variantIds.length} 个型号，可再取消部分型号。`
  } catch (e) {
    if (categoryVersions.get(row.code) === version)
      categoryErrors.value[row.code] = errorMessage(e, '分类型号加载失败，请重新选择分类')
  } finally {
    if (categoryVersions.get(row.code) === version) categoryLoading.value[row.code] = false
  }
}
function changeSelectedVariants() {
  const row = scopeRow.value
  if (!row || props.disabled) return
  if (row.sales.variantIds.length) explicitModels.add(row.code)
  else if (explicitModels.has(row.code)) {
    row.sales.categoryIds = []
    row.sales.excludedCategoryIds = []
    categoryKeys.value = []
    scopeNotice.value = '已取消全部型号，商品范围已清空，请重新选择。'
  }
  clearScopeRangeError()
}
function clearScopeRangeError() {
  if (scopeRow.value?.sales.categoryIds.length || scopeRow.value?.sales.variantIds.length)
    scopeErrors.value.range = ''
}
function validateScopeRow(row: PayrollCommissionRow) {
  scopeErrors.value.name = row.name.trim() ? '' : '请填写标准名称'
  scopeErrors.value.range = categoryLoading.value[row.code]
    ? '正在加载分类对应的全部型号，请稍候'
    : categoryErrors.value[row.code] ||
      (row.sales.categoryIds.length || row.sales.variantIds.length
        ? ''
        : '请至少选择适用商品分类或指定商品型号／规格')
  return scopeErrors.value.name || scopeErrors.value.range
}
function finishScope() {
  if (!scopeRow.value || validateScopeRow(scopeRow.value)) return
  scopeRow.value = null
}
function validate() {
  for (const row of rows.value) {
    const message = validateScopeRow(row)
    if (message) {
      scopeRow.value = row
      return message
    }
  }
  return duplicateCommissionScope(rows.value)
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
  const categories = scope.categoryIds
    .map((id) => props.categories.find((c) => c.id === id)?.name || `分类 ${id}`)
    .join('、')
  if (
    selectedProductsLoading.value &&
    scope.variantIds.some(
      (id) => !products.value.some((product) => String(product.productVariantId) === id),
    )
  )
    return `正在加载 ${scope.variantIds.length} 个型号名称${categories ? `；筛选分类：${categories}` : ''}`
  const variants = scope.variantIds
    .map((id) => {
      const p = products.value.find((p) => String(p.productVariantId) === id)
      return p ? productLabel(p) : `商品规格暂不可用（编号 ${id}）`
    })
    .join('、')
  const label = variants
    ? `仅指定型号：${variants}${categories ? `；筛选分类：${categories}` : ''}`
    : categories
      ? `按分类：${categories}`
      : '请选择 ERP 分类或规格'
  const excluded = scope.excludedCategoryIds.length + scope.excludedVariantIds.length
  return label + (excluded ? `；排除 ${excluded} 项` : '')
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
  selectedProductsLoading.value = false
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
