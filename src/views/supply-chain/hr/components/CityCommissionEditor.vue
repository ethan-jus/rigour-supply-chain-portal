<template>
  <el-dialog
    v-model="visible"
    :title="editingId ? '编辑城市总提成' : '新增城市总提成'"
    width="min(860px, 96vw)"
    class="city-commission-editor"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    destroy-on-close
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form label-position="top" :disabled="!canWrite || saving" class="city-config-form">
      <el-form-item label="城市总" required>
        <el-select
          v-model="form.employeeCode"
          filterable
          placeholder="选择负责人"
          :disabled="!!editingId"
        >
          <el-option
            v-for="employee in managerOptions"
            :key="employee.employeeCode"
            :label="employee.employeeName + ' · ' + employee.employeeCode"
            :value="employee.employeeCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="管辖城市" required>
        <el-select
          v-model="selectedCities"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="2"
          :disabled="!!editingId"
          placeholder="可选择多个城市"
        >
          <el-option
            v-for="city in cityOptions"
            :key="city.code"
            :value="city.code"
            :label="city.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="生效日期" required
        ><el-date-picker
          v-model="form.effectiveFrom"
          value-format="YYYY-MM-DD"
          placeholder="选择生效日期"
      /></el-form-item>
      <el-form-item label="团队销售提成计入比例" required>
        <div>
          <el-input-number
            v-model="teamPercent"
            :min="0"
            :max="100"
            :precision="2"
            :controls="false"
            aria-label="团队提成计入比例"
          />
          <span>%</span>
        </div>
        <span class="field-hint">100% 全额计入；0% 不计入。团队不含本人。</span>
      </el-form-item>
      <el-form-item label="本人销售提成" required class="full-row">
        <el-radio-group
          :model-value="form.includeOwnSalesCommission ?? undefined"
          @update:model-value="form.includeOwnSalesCommission = $event === true"
        >
          <el-radio :value="true">按销售规则另计</el-radio
          ><el-radio :value="false">不另计</el-radio>
        </el-radio-group>
      </el-form-item>
      <section class="full-row product-section">
        <div class="product-heading">
          <strong>城市总独立商品提成</strong
          ><el-button v-if="productMode === 'CUSTOM' && canWrite" @click="openProduct()"
            >添加商品</el-button
          >
        </div>
        <el-radio-group v-model="productMode" aria-label="独立商品提成方式">
          <el-radio value="CUSTOM">单独设置</el-radio
          ><el-radio value="DEPARTMENT">沿用部门商品标准</el-radio
          ><el-radio value="NONE">不计提</el-radio>
        </el-radio-group>
        <p v-if="productMode === 'DEPARTMENT'" class="field-hint">
          使用“商品提成”中受益角色为城市总的标准，按订单销售人员所属部门匹配。
        </p>
        <el-table
          v-if="productMode === 'CUSTOM'"
          :data="productRules"
          border
          empty-text="请添加商品，或选择不计提"
        >
          <el-table-column
            prop="productName"
            label="商品型号"
            min-width="210"
            show-overflow-tooltip
          />
          <el-table-column label="提成标准" width="150"
            ><template #default="{ row }"
              >{{ row.rate
              }}{{
                row.methodCode === 'PERCENT'
                  ? '% 回款金额'
                  : ' 元 / ' + costLabel('PRODUCT_UNIT', row.unitCode)
              }}</template
            ></el-table-column
          >
          <el-table-column v-if="canWrite" label="操作" width="120"
            ><template #default="{ $index }"
              ><el-button link type="primary" @click="openProduct($index)">编辑</el-button
              ><el-button link type="danger" @click="productRules.splice($index, 1)"
                >移除</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <p v-if="productMode === 'CUSTOM'" class="field-hint">
          适用于所选城市及本配置的生效期间，整单全额回款后计提。
        </p>
      </section>
      <el-collapse v-model="more" class="full-row"
        ><el-collapse-item title="更多设置（截止日期、状态、备注）" name="more">
          <el-form-item label="截止日期"
            ><el-date-picker
              v-model="endDate"
              value-format="YYYY-MM-DD"
              clearable
              placeholder="留空为长期有效"
          /></el-form-item>
          <el-form-item label="状态"
            ><el-switch v-model="form.enabled" active-text="启用" inactive-text="停用"
          /></el-form-item>
          <el-form-item label="备注"
            ><el-input v-model="form.remark" type="textarea" maxlength="500" show-word-limit
          /></el-form-item> </el-collapse-item
      ></el-collapse>
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button v-if="canWrite" type="primary" :loading="saving" @click="save"
        >保存配置</el-button
      ></template
    >
  </el-dialog>
  <el-dialog
    v-model="productVisible"
    title="商品提成标准"
    width="min(560px, 96vw)"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-alert v-if="productError" :title="productError" type="error" :closable="false" />
    <el-form label-width="90px">
      <el-form-item label="商品分类" required
        ><el-tree-select
          v-model="productForm.categoryId"
          :data="categoryTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          check-strictly
          filterable
          placeholder="选择分类"
          @change="changeCategory"
      /></el-form-item>
      <el-form-item label="规格型号" required
        ><el-select
          v-model="productForm.productVariantId"
          :disabled="!productForm.categoryId"
          filterable
          remote
          :remote-method="searchProducts"
          :loading="productLoading"
          placeholder="搜索商品或型号"
          @visible-change="(opened) => opened && searchProducts('')"
          @change="selectProduct"
          ><el-option
            v-for="p in products"
            :key="p.productVariantId"
            :label="[p.productName, p.specification, p.variantCode].filter(Boolean).join(' · ')"
            :value="p.productVariantId" /></el-select
      ></el-form-item>
      <el-form-item label="计算方式" required
        ><CostDictSelect v-model="productForm.methodCode" code="PAYROLL_COMMISSION_METHOD"
      /></el-form-item>
      <el-form-item label="提成标准" required
        ><el-input-number
          v-model="productForm.rate"
          :min="0"
          :max="productForm.methodCode === 'PERCENT' ? 100 : 99999999999999.99"
          :precision="2"
          :controls="false"
        /><span
          class="rate-unit"
          v-if="productForm.methodCode === 'PERCENT' || productForm.unitCode"
          >{{
            productForm.methodCode === 'PERCENT'
              ? '%'
              : '元 / ' + costLabel('PRODUCT_UNIT', productForm.unitCode)
          }}</span
        ></el-form-item
      >
    </el-form>
    <template #footer
      ><el-button @click="productVisible = false">取消</el-button
      ><el-button type="primary" :disabled="productLoading" @click="saveProduct"
        >确定</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCityManagerRules,
  savePayrollRule,
  getPayrollProducts,
  getPayrollProductCategories,
  type CityProductRule,
  type PayrollRule,
  type PayrollRuleCommand,
  type PayrollEmployee,
  type PayrollProduct,
  type PayrollCategory,
} from '@/api/core/payroll'
import { errorMessage } from '@/api/core/error'
import { departmentTree } from '@/utils/hr-department-tree'
import CostDictSelect from '../../cost/CostDictSelect.vue'
import { costLabel } from '../../cost/cost-dictionaries'
const props = defineProps<{
  employees: PayrollEmployee[]
  cities: { code: string; name: string }[]
  canWrite: boolean
}>()
const emit = defineEmits<{ saved: [] }>()
const visible = ref(false),
  saving = ref(false),
  error = ref(''),
  editingId = ref<string | null>(null)
const form = ref<PayrollRuleCommand>({} as PayrollRuleCommand),
  selectedCities = ref<string[]>([]),
  endDate = ref(''),
  more = ref<string[]>([])
const teamPercent = ref<number | undefined>(100),
  productMode = ref<'CUSTOM' | 'DEPARTMENT' | 'NONE'>('CUSTOM'),
  productRules = ref<CityProductRule[]>([])
const managerOptions = computed(() =>
  props.employees.filter(
    (e) => e.payrollCategory === 'SALES' || e.employeeCode === form.value.employeeCode,
  ),
)
const cityOptions = computed(() =>
  form.value.cityCode && !props.cities.some((c) => c.code === form.value.cityCode)
    ? [
        ...props.cities,
        { code: form.value.cityCode, name: form.value.cityName || form.value.cityCode },
      ]
    : props.cities,
)
let requestIds = new Map<string, string>()
function open(blank: PayrollRuleCommand, row?: PayrollRule, employeeCode?: string) {
  form.value = row
    ? { ...JSON.parse(JSON.stringify(row.data)), revision: row.revision }
    : { ...blank, employeeCode: employeeCode ?? null }
  editingId.value = row?.id ?? null
  selectedCities.value = row?.data.cityCode ? [row.data.cityCode] : []
  endDate.value = row && row.data.effectiveTo !== '9999-12-31' ? row.data.effectiveTo : ''
  const policy = row?.data.cityCommission
  teamPercent.value = policy?.teamPercent ?? 100
  productRules.value = policy?.products ? JSON.parse(JSON.stringify(policy.products)) : []
  productMode.value = row
    ? policy?.products == null
      ? 'DEPARTMENT'
      : policy.products.length
        ? 'CUSTOM'
        : 'NONE'
    : 'CUSTOM'
  more.value = row && (!row.data.enabled || !!endDate.value) ? ['more'] : []
  requestIds = new Map()
  error.value = ''
  visible.value = true
}
async function save() {
  if (!props.canWrite || saving.value) return
  error.value = ''
  if (!form.value.employeeCode || !selectedCities.value.length || !form.value.effectiveFrom) {
    error.value = '请选择城市总、管辖城市和生效日期'
    return
  }
  if (
    teamPercent.value == null ||
    !Number.isFinite(teamPercent.value) ||
    teamPercent.value < 0 ||
    teamPercent.value > 100
  ) {
    error.value = '团队计入比例应在 0 至 100% 之间'
    return
  }
  if (form.value.includeOwnSalesCommission == null) {
    error.value = '请选择本人销售是否另计提成'
    return
  }
  if (endDate.value && endDate.value < form.value.effectiveFrom) {
    error.value = '截止日期不能早于生效日期'
    return
  }
  if (productMode.value === 'CUSTOM' && !productRules.value.length) {
    error.value = '请添加独立商品标准，或明确选择不计提'
    return
  }
  const commands = selectedCities.value.map((code) => {
    if (!requestIds.has(code)) requestIds.set(code, crypto.randomUUID())
    const cityName = cityOptions.value.find((c) => c.code === code)?.name || code
    const employeeName =
      props.employees.find((e) => e.employeeCode === form.value.employeeCode)?.employeeName ||
      form.value.employeeCode
    return {
      ...form.value,
      kindCode: 'CITY_MANAGER' as const,
      cityCode: code,
      cityName,
      name: `${cityName} · ${employeeName} · ${form.value.effectiveFrom}`.slice(0, 120),
      requestId: editingId.value ? form.value.requestId : requestIds.get(code)!,
      effectiveTo: endDate.value || '9999-12-31',
      cityCommission: {
        teamPercent: teamPercent.value!,
        products:
          productMode.value === 'DEPARTMENT'
            ? null
            : productMode.value === 'NONE'
              ? []
              : productRules.value,
      },
    }
  })
  saving.value = true
  try {
    if (editingId.value) await savePayrollRule(editingId.value, commands[0]!)
    else await createCityManagerRules(commands)
    visible.value = false
    ElMessage.success('提成配置已保存')
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e, '保存失败，请核对后重试')
  } finally {
    saving.value = false
  }
}
const categories = ref<PayrollCategory[]>([]),
  categoryTree = computed(() => departmentTree(categories.value))
const productVisible = ref(false),
  productError = ref(''),
  productLoading = ref(false),
  products = ref<PayrollProduct[]>([])
const productIndex = ref<number | undefined>(),
  productForm = ref<Partial<CityProductRule>>({})
let productVersion = 0,
  categoryVersion = 0
async function openProduct(index?: number) {
  productIndex.value = index
  productForm.value =
    index == null ? { methodCode: 'QUANTITY', rate: undefined } : { ...productRules.value[index] }
  const p = productForm.value
  products.value = p.productVariantId
    ? [{ ...p, productCode: '', variantCode: '', specification: '' } as PayrollProduct]
    : []
  productError.value = ''
  productVisible.value = true
  ++productVersion
  productLoading.value = false
  const id = ++categoryVersion
  try {
    const rows = await getPayrollProductCategories()
    if (id === categoryVersion) categories.value = rows
  } catch (e) {
    if (id === categoryVersion) productError.value = errorMessage(e, '商品分类加载失败')
  }
}
function changeCategory() {
  ++productVersion
  productLoading.value = false
  products.value = []
  productForm.value.productVariantId = undefined
  productForm.value.productId = undefined
  productForm.value.unitCode = undefined
  void searchProducts('')
}
async function searchProducts(query: string) {
  if (!productForm.value.categoryId) return
  const id = ++productVersion
  productLoading.value = true
  try {
    const result = await getPayrollProducts(query, productForm.value.categoryId)
    if (id === productVersion)
      products.value = [
        ...new Map(
          [
            ...products.value.filter(
              (p) => p.productVariantId === productForm.value.productVariantId,
            ),
            ...result,
          ].map((p) => [p.productVariantId, p]),
        ).values(),
      ]
  } catch (e) {
    if (id === productVersion) productError.value = errorMessage(e, '商品查询失败')
  } finally {
    if (id === productVersion) productLoading.value = false
  }
}
function selectProduct() {
  const p = products.value.find((p) => p.productVariantId === productForm.value.productVariantId)
  if (p)
    Object.assign(productForm.value, {
      productId: p.productId,
      productName: [p.productName, p.specification].filter(Boolean).join(' · '),
      unitCode: p.unitCode,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
    })
}
function saveProduct() {
  const p = productForm.value
  if (
    !p.productId ||
    !p.productVariantId ||
    !p.categoryId ||
    !p.unitCode ||
    !p.methodCode ||
    p.rate == null ||
    !Number.isFinite(p.rate) ||
    p.rate < 0 ||
    (p.methodCode === 'PERCENT' && p.rate > 100)
  ) {
    productError.value = '请完整选择商品、计算方式并填写有效标准'
    return
  }
  if (
    productRules.value.some(
      (r, i) => i !== productIndex.value && r.productVariantId === p.productVariantId,
    )
  ) {
    productError.value = '该商品型号已配置，请直接编辑'
    return
  }
  if (productIndex.value == null) productRules.value.push({ ...p } as CityProductRule)
  else productRules.value[productIndex.value] = { ...p } as CityProductRule
  productVisible.value = false
}
defineExpose({ open })
</script>
<style scoped>
.city-config-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.full-row {
  grid-column: 1/-1;
}
.city-config-form :deep(.el-select),
.city-config-form :deep(.el-date-editor) {
  width: 100%;
}
.field-hint {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.product-section {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
  margin-bottom: 12px;
}
.product-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.rate-unit {
  margin-left: 8px;
}
@media (max-width: 600px) {
  .city-config-form {
    grid-template-columns: 1fr;
  }
}
</style>
<style>
.city-commission-editor .el-dialog__body {
  max-height: 70vh;
  overflow: auto;
}
.city-commission-editor .el-dialog__footer {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 16px;
}
</style>
