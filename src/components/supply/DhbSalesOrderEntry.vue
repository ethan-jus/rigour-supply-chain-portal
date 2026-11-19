<template>
  <el-dialog
    v-model="editorVisible"
    title="补录销售订单"
    width="min(1040px, 94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @closed="emit('closed')"
    @opened="resetEntryScroll"
  >
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
      :title="`原销售单号：${sourceOrderNo || '-'}。请按原单填写客户、下单时间和商品，提交后返回资料关联。`"
    />
    <el-form ref="entryForm" :model="form" label-width="auto" label-position="top" class="sales-order-form">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="客户" required>
            <el-select
              v-model="form.customerId"
              filterable
              remote
              reserve-keyword
              placeholder="搜索客户/门店"
              :remote-method="searchCustomers"
              :loading="customerLoading"
              style="width: 100%"
              @change="selectCustomer"
            >
              <el-option
                v-for="item in customerOptions"
                :key="item.id"
                :label="item.customerName"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="下单时间" required>
            <el-date-picker
              v-model="form.orderDate"
              type="datetime"
              placeholder="选择原单下单时间"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户名称">
            <el-input
              v-model="form.customerNameSnapshot"
              readonly
              clearable
              placeholder="选择客户后带出"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8"
          ><el-form-item label="联系人"
            ><el-input v-model="form.contactNameSnapshot" clearable /></el-form-item
        ></el-col>
        <el-col :span="8"
          ><el-form-item label="联系电话"
            ><el-input v-model="form.contactPhoneSnapshot" clearable /></el-form-item
        ></el-col>
        <el-col :span="8">
          <el-form-item label="归属地区">
            <el-select
              v-model="form.regionCode"
              disabled
              clearable
              filterable
              placeholder="选择归属地区"
              style="width: 100%"
            >
              <el-option
                v-for="item in regionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="归属销售人员">
            <el-input :model-value="form.ownerEmployeeNameSnapshot || form.ownerEmployeeCode" readonly />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="付款方式">
            <el-select
              v-model="form.paymentMethodCode"
              clearable
              placeholder="选择付款方式"
              style="width: 100%"
            >
              <el-option
                v-for="item in paymentMethodOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="24"
          ><el-form-item label="备注"
            ><el-input
              v-model="form.remark"
              type="textarea"
              :rows="2"
              maxlength="1000"
              show-word-limit /></el-form-item
        ></el-col>
      </el-row>

      <div class="form-section-title">
        <h3>商品明细<span class="product-count">{{ form.lines.length }} 项</span></h3>
        <el-button type="primary" plain :disabled="saving" @click="productPickerOpen = true">添加商品</el-button>
      </div>
      <el-table :data="form.lines" row-key="localId" border class="sales-entry-lines"
        empty-text="请点击“添加商品”，在弹窗中选择商品和规格">
        <el-table-column type="index" label="序号" width="56" />
        <el-table-column prop="productCodeSnapshot" label="商品编码" width="140" show-overflow-tooltip />
        <el-table-column prop="productNameSnapshot" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="specificationSnapshot" label="规格" min-width="150" show-overflow-tooltip />
        <el-table-column label="单位 *" width="110"><template #default="{ row }">
          <el-select v-model="row.unitCode" aria-label="商品单位" placeholder="选择单位">
            <el-option v-for="option in productUnitOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </template></el-table-column>
        <el-table-column label="数量 *" width="140"><template #default="{ row }">
          <el-input-number v-model="row.quantity" aria-label="商品数量" :controls="false" :min="0.01" :precision="2" />
        </template></el-table-column>
        <el-table-column label="单价（元）*" width="140"><template #default="{ row }">
          <el-input-number v-model="row.unitPrice" aria-label="商品单价" :controls="false" :min="0" :precision="2" placeholder="填写单价" />
        </template></el-table-column>
        <el-table-column label="优惠（元）" width="140"><template #default="{ row }">
          <el-input-number v-model="row.discountAmount" aria-label="商品优惠" :controls="false" :min="0" :precision="2" />
        </template></el-table-column>
        <el-table-column label="小计（元）" width="130" align="right"><template #default="{ row }">
          {{ row.unitPrice == null || row.quantity == null ? '-' : formatMoney(row.quantity * row.unitPrice - (row.discountAmount || 0)) }}
        </template></el-table-column>
        <el-table-column label="操作" width="70" fixed="right"><template #default="{ $index }">
          <el-button type="danger" link :disabled="saving" @click="removeLine($index)">删除</el-button>
        </template></el-table-column>
      </el-table>
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="editorVisible = false">取消</el-button>
      <el-button
        v-if="can('order:create') && can('order:submit')"
        type="primary"
        :loading="saving"
        @click="saveOrder"
        ><SupplyActionLabel code="order:submit" fallback="保存并提交" /></el-button
      >
    </template>
  </el-dialog>

  <SalesOrderProductPicker v-model="productPickerOpen"
    :excluded-keys="form.lines.filter(l => l.productId && l.productVariantId).map(l => `${l.productId}:${l.productVariantId}`)"
    @selected="addSelectedProducts" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createSalesOrder, type SalesOrderCommand, type SalesOrderDetail } from '@/api/core/order-sales'
import { getAllCrmCustomerAreas, getInternalCrmCustomers, type CrmDictionaryView, type InternalCrmCustomerSummary } from '@/api/core/crm'
import { businessDictionaryOptions, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { randomId } from '@/utils/random-id'
import SupplyActionLabel from './SupplyActionLabel.vue'
import SalesOrderProductPicker, { type SalesProductChoice } from '@/views/supply-chain/order/components/SalesOrderProductPicker.vue'

defineProps<{ sourceOrderNo?: string }>()
const emit = defineEmits<{ created: [order: SalesOrderDetail]; closed: [] }>()
const { can } = useSupplyPermissions()
const saving = ref(false)
const editorVisible = ref(false)
const customerLoading = ref(false)
const customerOptions = ref<InternalCrmCustomerSummary[]>([])
const productPickerOpen = ref(false)
const entryForm = ref<{ $el: HTMLElement }>()
const productUnitOptions = computed(() => businessDictionaryOptions('COMMON', 'PRODUCT_UNIT'))

const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))
const customerAreaOptions = ref<CrmDictionaryView[]>([])
const regionOptions = computed(() => {
  const options = customerAreaOptions.value.map((item) => ({
    label: areaOptionLabel(item),
    value: item.code,
  }))
  const existing = new Set(options.map((item) => item.value))
  for (const item of businessDictionaryOptions('COMMON', 'REGION')) {
    if (!existing.has(item.value)) options.push(item)
  }
  return options
})

interface SalesOrderLineForm {
  localId: string
  productId: string | null
  productVariantId: string | null
  productCodeSnapshot: string | null
  skuCodeSnapshot: string | null
  productNameSnapshot: string
  specificationSnapshot: string | null
  unitCode: string
  quantity: number
  unitPrice: number | null
  discountAmount: number
  remark: string | null
}

const form = reactive({
  customerId: '',
  customerCodeSnapshot: '',
  customerNameSnapshot: '',
  contactNameSnapshot: '',
  contactPhoneSnapshot: '',
  regionCode: '',
  ownerSalesUserId: '',
  ownerSalesName: '',
  ownerEmployeeCode: '',
  ownerEmployeeNameSnapshot: '',
  orderDate: null as Date | string | null,
  paymentMethodCode: '',
  remark: '',
  lines: [] as SalesOrderLineForm[],
})

function resetEntryScroll() {
  entryForm.value?.$el.scrollTo({ top: 0, left: 0 })
}

onMounted(() => {
  if (!can('order:create') || !can('order:submit')) {
    emit('closed')
    return
  }
  editorVisible.value = true
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'REGION' },
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
    { moduleCode: 'ORDER', code: 'PAYMENT_METHOD' },
  ])
  void Promise.all([loadCustomerAreas(), searchCustomers('')])
})

async function saveOrder() {
  if (saving.value || !can('order:create') || !can('order:submit')) return
  const command = buildCommand()
  if (!command) return
  saving.value = true
  try {
    const order = await createSalesOrder(command)
    emit('created', order)
    ElMessage.success('销售订单已创建并提交')
    editorVisible.value = false
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单保存失败'))
  } finally {
    saving.value = false
  }
}

async function searchCustomers(query: string) {
  customerLoading.value = true
  try {
    const result = await getInternalCrmCustomers({
      begin: 0,
      step: 20,
      customerName: empty(query),
      statusCode: 'ACTIVE',
    })
    customerOptions.value = result.items
  } finally {
    customerLoading.value = false
  }
}

async function loadCustomerAreas() {
  try {
    const areas = await getAllCrmCustomerAreas()
    customerAreaOptions.value = areas.filter((item) => item.status === 'ACTIVE')
  } catch (reason) {
    customerAreaOptions.value = []
    ElMessage.warning(errorMessage(reason, '归属地区加载失败，可稍后刷新'))
  }
}

function selectCustomer(value: string | number) {
  const customer = customerOptions.value.find((item) => String(item.id) === String(value))
  if (!customer) return
  form.customerCodeSnapshot = customer.customerCode || ''
  form.customerNameSnapshot = customer.customerName
  form.contactNameSnapshot = customer.contactName || ''
  form.contactPhoneSnapshot = customer.contactPhone || ''
  form.regionCode = customer.regionCode || ''
  form.ownerEmployeeCode = customer.ownerEmployeeCode || ''
  form.ownerEmployeeNameSnapshot =
    customer.ownerEmployeeNameSnapshot || customer.ownerSalesName || ''
}

function addSelectedProducts(products: SalesProductChoice[]) {
  const existing = new Set(form.lines.map(l => `${l.productId}:${l.productVariantId}`))
  for (const product of products) {
    if (existing.has(product.key)) continue
    form.lines.push({
      localId: randomId(), productId: product.productId, productVariantId: product.variantId,
      productCodeSnapshot: product.productCode, skuCodeSnapshot: product.variantCode,
      productNameSnapshot: product.productName, specificationSnapshot: product.specification,
      unitCode: product.unitCode || '', quantity: 1, unitPrice: product.salePrice,
      discountAmount: 0, remark: null,
    })
    existing.add(product.key)
  }
}
function removeLine(index: number) { form.lines.splice(index, 1) }

function buildCommand(): SalesOrderCommand | null {
  if (!form.orderDate) {
    ElMessage.warning('请选择原销售单的下单时间')
    return null
  }
  if (!form.customerId || !form.customerNameSnapshot) {
    ElMessage.warning('请选择客户')
    return null
  }
  if (!form.lines.length) {
    ElMessage.warning('请先添加至少一项商品')
    return null
  }
  if (form.lines.some(line => line.unitPrice == null)) {
    ElMessage.warning('请填写原单商品的单价；没有参考价时不能自动按零元保存')
    return null
  }
  const lines = form.lines.map((line) => ({
    productId: idPayload(line.productId),
    productVariantId: idPayload(line.productVariantId),
    productCodeSnapshot: line.productCodeSnapshot,
    skuCodeSnapshot: line.skuCodeSnapshot,
    productNameSnapshot: empty(line.productNameSnapshot) || null,
    specificationSnapshot: line.specificationSnapshot,
    unitCode: empty(line.unitCode) || null,
    quantity: line.quantity,
    unitPrice: line.unitPrice!,
    discountAmount: line.discountAmount || 0,
    remark: line.remark,
  }))
  if (
    lines.some(
      (line) =>
        !line.productId || !line.productVariantId || !line.productNameSnapshot || !line.unitCode,
    )
  ) {
    ElMessage.warning('请完善商品、规格和单位')
    return null
  }
  if (lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 ||
    line.unitPrice == null || !Number.isFinite(line.unitPrice) || line.unitPrice < 0 || line.discountAmount < 0 || line.discountAmount > line.quantity * line.unitPrice)) {
    ElMessage.warning('请填写有效的数量、单价和优惠金额')
    return null
  }
  return {
    customerId: idPayload(form.customerId),
    customerCodeSnapshot: empty(form.customerCodeSnapshot),
    customerNameSnapshot: empty(form.customerNameSnapshot) || null,
    contactNameSnapshot: empty(form.contactNameSnapshot),
    contactPhoneSnapshot: empty(form.contactPhoneSnapshot),
    regionCode: empty(form.regionCode),
    ownerSalesUserId: empty(form.ownerSalesUserId),
    ownerSalesName: empty(form.ownerSalesName),
    ownerEmployeeCode: empty(form.ownerEmployeeCode),
    ownerEmployeeNameSnapshot: empty(form.ownerEmployeeNameSnapshot),
    orderDate: toIso(form.orderDate),
    paymentMethodCode: empty(form.paymentMethodCode),
    discountAmount: 0,
    remark: empty(form.remark),
    lines,
    submit: true,
    revision: null,
  }
}

function areaOptionLabel(item: CrmDictionaryView) {
  if (!item.parentCode) return item.name
  const parent = customerAreaOptions.value.find((row) => row.code === item.parentCode)
  return parent ? `${parent.name} / ${item.name}` : item.name
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `¥${Number(value).toFixed(2)}`
}

function toIso(value: Date | string | null) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function idString(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized === 'null' || normalized === 'undefined' ? '' : normalized
}

function idPayload(value: string | number | null | undefined) {
  const normalized = idString(value)
  return normalized || null
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.form-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0 12px;

  h3 {
    margin: 0;
    font-size: 16px;
  }
}
.product-count { margin-left: 10px; font-size: 13px; font-weight: 400; color: var(--el-text-color-secondary); }
.sales-entry-lines { width: 100%; }
.sales-entry-lines :deep(.el-input-number) { width: 100%; }
.sales-order-form {
  :deep(.el-col), :deep(.el-form-item__content) { min-width: 0; }
  :deep(.el-form-item__label) { white-space: nowrap; }
}

.sales-order-form {
  max-height: min(640px, 68vh);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 6px 2px 2px;
}
</style>
