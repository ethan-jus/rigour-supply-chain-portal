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
          <el-button link type="primary" @click="scopeRow = row as PayrollCommissionRow"
            >选择商品与排除项</el-button
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
        <el-form-item label="标准名称"
          ><el-input v-model="scopeRow.name" placeholder="例如：澳洋华彩 A300"
        /></el-form-item>
        <el-form-item label="包含分类及子类"
          ><el-tree-select
            v-model="scopeRow.sales.categoryIds"
            :data="tree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            multiple
            show-checkbox
            check-strictly
            filterable
            :render-after-expand="false"
        /></el-form-item>
        <el-form-item label="排除分类及子类"
          ><el-tree-select
            v-model="scopeRow.sales.excludedCategoryIds"
            :data="tree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            multiple
            show-checkbox
            check-strictly
            filterable
            :render-after-expand="false"
        /></el-form-item>
        <el-form-item label="指定商品型号／规格"
          ><el-select
            v-model="scopeRow.sales.variantIds"
            multiple
            filterable
            remote
            :remote-method="search"
            :loading="loading"
            ><el-option
              v-for="p in products"
              :key="p.productVariantId"
              :value="String(p.productVariantId)"
              :label="productLabel(p)" /></el-select
        ></el-form-item>
        <el-form-item label="排除商品型号／规格"
          ><el-select
            v-model="scopeRow.sales.excludedVariantIds"
            multiple
            filterable
            remote
            :remote-method="search"
            :loading="loading"
            ><el-option
              v-for="p in products"
              :key="p.productVariantId"
              :value="String(p.productVariantId)"
              :label="productLabel(p)" /></el-select
        ></el-form-item>
        <p class="field-hint">
          同一行商品共用销售与城市总两项标准。不同型号的金额不同，请分别建立标准行。
        </p>
      </el-form>
      <template #footer
        ><el-button type="primary" @click="scopeRow = null">完成</el-button></template
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
import { computed, onMounted, ref, watch } from 'vue'
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
import { errorMessage } from '@/api/core/error'
import { costLabel } from '../../cost/cost-dictionaries'
import PayrollCommissionRateEditor from './PayrollCommissionRateEditor.vue'
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const props = defineProps<{ categories: PayrollCategory[]; disabled?: boolean }>()
const tree = computed(() => departmentTree(props.categories))
const rows = ref<PayrollCommissionRow[]>(commissionRows(form.value.commission.rules))
const selected = ref<PayrollCommissionRow[]>([]),
  scopeRow = ref<PayrollCommissionRow | null>(null)
const products = ref<PayrollProduct[]>([]),
  loading = ref(false),
  error = ref('')
const batchVisible = ref(false),
  batch = ref(newCommissionRow())
const productLabel = (p: PayrollProduct) => `${p.productName} / ${p.specification || p.variantCode}`
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
      : `${total.value} 元／${costLabel('PRODUCT_UNIT', total.unitCode)}`
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
async function search(keyword: string) {
  const version = ++searchVersion
  loading.value = true
  try {
    const found = await getPayrollProducts(keyword)
    if (version !== searchVersion) return
    const merged = new Map(products.value.map((p) => [String(p.productVariantId), p]))
    found.forEach((p) => merged.set(String(p.productVariantId), p))
    products.value = [...merged.values()]
  } catch (e) {
    error.value = errorMessage(e, '商品查询失败')
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
</style>
