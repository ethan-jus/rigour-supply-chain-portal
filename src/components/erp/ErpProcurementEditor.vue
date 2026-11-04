<template>
  <ErpRecordDrawer
    v-model="visible"
    :title="orderId ? '编辑采购订单' : '新增采购订单'"
    size="min(1280px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="purchase-editor" :aria-busy="loading">
      <el-skeleton v-if="loading" :rows="12" animated />
      <div v-if="!loading && orderId" class="document-meta">
        <span>采购单号：{{ detail?.procurementNo || '保存后自动生成' }}</span
        ><el-tag :type="detail?.confirmationStatusCode === 'CONFIRMED' ? 'success' : 'info'">{{
          detail?.confirmationStatusCode === 'CONFIRMED' ? '已确认' : '待确认'
        }}</el-tag>
      </div>
      <el-form v-if="!loading" ref="formRef" :model="form" :rules="rules" label-width="110px">
        <section>
          <h3>采购信息</h3>
          <el-row :gutter="24">
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="供应商" prop="supplierCode"
                ><el-select
                  v-model="form.supplierCode"
                  filterable
                  remote
                  :remote-method="searchSuppliers"
                  :loading="supplierLoading"
                  placeholder="搜索并选择供应商"
                  ><el-option
                    v-for="s in suppliers"
                    :key="s.supplierCode"
                    :label="s.supplierName"
                    :value="s.supplierCode" /></el-select></el-form-item
            ></el-col>
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="采购日期" prop="purchaseDate"
                ><el-date-picker
                  v-model="form.purchaseDate"
                  type="date"
                  value-format="YYYY-MM-DD" /></el-form-item
            ></el-col>
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="预计到货"
                ><el-date-picker
                  v-model="form.expectedArrivalTime"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item
            ></el-col>
          </el-row>
        </section>
        <section>
          <h3>收货信息</h3>
          <el-row :gutter="24">
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="收货仓库" prop="targetWarehouseCode"
                ><el-select
                  v-model="form.targetWarehouseCode"
                  filterable
                  remote
                  :remote-method="searchWarehouses"
                  :loading="warehouseLoading"
                  @change="warehouseChanged"
                  ><el-option
                    v-for="w in warehouses"
                    :key="w.warehouseCode"
                    :label="w.warehouseName"
                    :value="w.warehouseCode" /></el-select></el-form-item
            ></el-col>
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="收货人" prop="receiverName"
                ><el-input v-model="form.receiverName" maxlength="100" /></el-form-item
            ></el-col>
            <el-col :xs="24" :sm="12" :lg="8"
              ><el-form-item label="收货联系电话" prop="receiverPhone"
                ><el-input v-model="form.receiverPhone" maxlength="50" /></el-form-item
            ></el-col>
            <el-col :span="24"
              ><el-form-item label="收货地址" prop="receivingAddress"
                ><el-input
                  v-model="form.receivingAddress"
                  maxlength="1000"
                  placeholder="填写完整的收货地址" /></el-form-item
            ></el-col>
          </el-row>
        </section>
        <section>
          <div class="section-toolbar">
            <h3>
              <span class="required">*</span> 采购商品
              <span class="muted">{{ lines.length }} 个 SKU</span>
            </h3>
            <el-button type="primary" plain @click="pickerVisible = true">＋ 选择商品</el-button>
          </div>
          <el-table
            :data="lines"
            border
            max-height="420"
            row-key="variantCode"
            empty-text="请点击“选择商品”添加采购明细"
          >
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column
              prop="productName"
              label="商品名称"
              min-width="180"
              show-overflow-tooltip
            /><!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column
              prop="variantCode"
              label="SKU编码"
              width="170"
              show-overflow-tooltip
            /><!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column
              prop="specification"
              label="规格"
              min-width="130"
              show-overflow-tooltip
            />
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="采购单位" min-width="115"
              ><template #default="{ row }"
                ><el-select v-model="row.unitCode" @change="row.unitPrice = undefined"
                  ><el-option
                    v-for="code in units(row)"
                    :key="code"
                    :value="code"
                    :label="unit(code)" /></el-select></template
            ></el-table-column>
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="采购数量" min-width="140"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.quantity"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  placeholder="请输入" /></template
            ></el-table-column>
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="采购单价（元）" min-width="140"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  placeholder="请输入" /></template
            ></el-table-column>
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="金额（元）" width="145" align="right"
              ><template #default="{ row }">{{ amount(row) }}</template></el-table-column
            >
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="备注" min-width="140"
              ><template #default="{ row }"
                ><el-input v-model="row.remark" maxlength="1000" /></template
            ></el-table-column>
            <!-- @vue-generic {ProcurementEditableLine} -->
            <el-table-column label="操作" width="70" fixed="right"
              ><template #default="{ $index }"
                ><el-button link type="danger" @click="lines.splice($index, 1)"
                  >移除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
          <div class="line-note">
            数量、采购价可手工填写，单价允许为 0；切换采购单位后请重新填写对应单价。
          </div>
        </section>
        <section>
          <h3>合同与费用</h3>
          <div class="contract-cost-grid">
            <div class="contract-column">
              <el-form-item label="采购合同号"
                ><el-input v-model="form.contractNo" maxlength="100"
              /></el-form-item>
              <el-form-item label="合同附件" class="contract-attachment-item">
                <div class="contract-file">
                  <div class="contract-file-name" :title="contractName || '合同附件'">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      aria-hidden="true"
                    >
                      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
                      <path d="M14 3v5h5M8 12h8M8 16h5" />
                    </svg>
                    <span>{{
                      form.contractFileKey ? contractName || '已保存的合同附件' : '尚未选择附件'
                    }}</span>
                    <el-tag v-if="form.contractFileKey" size="small" type="success">已上传</el-tag>
                  </div>
                  <div class="contract-file-actions">
                    <el-button :loading="uploading" @click="fileInput?.click()">{{
                      form.contractFileKey ? '更换附件' : '上传附件'
                    }}</el-button>
                    <el-button
                      v-if="form.contractFileKey"
                      link
                      type="danger"
                      @click="removeContract"
                      >移除</el-button
                    >
                    <ErpProcurementContractLink
                      v-if="detail?.contractFileKey && orderId"
                      :order-id="orderId"
                      label="查看已保存附件"
                    />
                  </div>
                  <p class="contract-file-help">支持 PDF、Word、JPG、PNG，单个文件不超过10MB</p>
                </div>
              </el-form-item>
            </div>
            <div class="freight-column">
              <el-form-item label="运费承担" prop="freightBearerCode"
                ><el-select v-model="form.freightBearerCode"
                  ><el-option label="我方承担" value="BUYER" /><el-option
                    label="供应商承担"
                    value="SUPPLIER" /><el-option label="已含货价" value="INCLUDED" /></el-select
              ></el-form-item>
              <el-form-item label="物流费（元）" prop="freightAmount"
                ><el-input-number
                  v-model="form.freightAmount"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  placeholder="填写物流费，无运费填0"
              /></el-form-item>
            </div>
          </div>
          <el-form-item label="备注" class="contract-remark"
            ><el-input
              v-model="form.remark"
              type="textarea"
              :rows="2"
              maxlength="1000"
              show-word-limit
          /></el-form-item>
        </section>
      </el-form>
      <input
        ref="fileInput"
        hidden
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.png"
        @change="upload"
      />
    </div>
    <template #footer
      ><div class="editor-footer">
        <div class="totals">
          货款 <strong>¥{{ money(total) }}</strong
          ><span>我方承担运费 ¥{{ money(buyerFreight) }}</span
          >采购总额 <strong class="primary">¥{{ money(total + buyerFreight) }}</strong>
        </div>
        <div>
          <el-button @click="visible = false">取消</el-button
          ><el-button
            type="primary"
            :loading="saving"
            :disabled="loading || uploading"
            @click="save"
            >保存</el-button
          >
        </div>
      </div></template
    >
  </ErpRecordDrawer>
  <ErpProcurementProductPicker
    v-model="pickerVisible"
    :excluded-codes="lines.map((l) => l.variantCode)"
    @selected="addProducts"
  />
</template>
<script setup lang="ts">
import ErpRecordDrawer from './ErpRecordDrawer.vue'
import { computed, reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/core/error'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createProcurementOrder,
  updateProcurementOrder,
  getProcurementOrder,
  getProcurementProducts,
  uploadProcurementContract,
  type ProcurementOrderCommand,
  type ProcurementOrderDetail,
  type ProcurementProduct,
} from '@/api/core/erp-documents'
import {
  getErpSupplierProfiles,
  getErpInventoryWarehouses,
  type ErpSupplierProfileView,
  type ErpInternalWarehouseView,
} from '@/api/core/erp-internal'
import { businessDictionaryLabel } from '@/utils/business-dictionary'
import {
  appendProcurementProducts,
  roundProcurementInput,
  type ProcurementEditableLine,
} from '@/utils/procurement'
import ErpProcurementProductPicker from './ErpProcurementProductPicker.vue'
import ErpProcurementContractLink from './ErpProcurementContractLink.vue'
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ orderId?: string }>()
const emit = defineEmits<{ saved: [] }>()
const loading = ref(false),
  saving = ref(false),
  uploading = ref(false),
  pickerVisible = ref(false),
  supplierLoading = ref(false),
  warehouseLoading = ref(false)
const detail = ref<ProcurementOrderDetail>(),
  formRef = ref<FormInstance>(),
  fileInput = ref<HTMLInputElement>(),
  contractName = ref('')
const suppliers = ref<ErpSupplierProfileView[]>([]),
  warehouses = ref<ErpInternalWarehouseView[]>([]),
  lines = ref<ProcurementEditableLine[]>([])
const form = reactive<ProcurementOrderCommand>({ lines: [] })
const rules: FormRules = Object.fromEntries(
  [
    ['supplierCode', '请选择供应商'],
    ['purchaseDate', '请选择采购日期'],
    ['targetWarehouseCode', '请选择收货仓库'],
    ['receiverName', '请输入收货人'],
    ['receiverPhone', '请输入收货联系电话'],
    ['receivingAddress', '请输入收货地址'],
    ['freightBearerCode', '请选择运费承担'],
  ].map(([key, message]) => [
    key!,
    [{ required: true, whitespace: true, message, trigger: 'change' }],
  ]),
)
rules.freightAmount = [
  {
    required: true,
    type: 'number',
    min: 0,
    message: '请填写物流费，无运费填0',
    trigger: ['change', 'blur'],
  },
]
const unit = (code?: string | null) =>
  code ? businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, code) : '—'
const money = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const total = computed(() =>
  lines.value.reduce(
    (sum, l) => sum + Number(((l.quantity || 0) * (l.unitPrice || 0)).toFixed(6)),
    0,
  ),
)
const buyerFreight = computed(() =>
  form.freightBearerCode === 'BUYER' ? form.freightAmount || 0 : 0,
)
function amount(row: ProcurementEditableLine) {
  return row.quantity == null || row.unitPrice == null
    ? '—'
    : money(Number((row.quantity * row.unitPrice).toFixed(6)))
}
function units(row: ProcurementEditableLine) {
  return [
    ...new Set(
      [
        row.unitCode,
        row.baseUnitCode,
        ...(row.baseToMiddleRate && row.baseToMiddleRate > 0 ? [row.middleUnitCode] : []),
        ...(row.baseToBigRate && row.baseToBigRate > 0 ? [row.bigUnitCode] : []),
      ].filter((x): x is string => !!x),
    ),
  ]
}
function addProducts(products: ProcurementProduct[]) {
  if (lines.value.length + products.length > 200) {
    ElMessage.warning('每张采购单最多200个SKU')
    return
  }
  lines.value = appendProcurementProducts(lines.value, products)
}
let supplierRequest = 0,
  warehouseRequest = 0,
  editorRequest = 0
async function searchSuppliers(keyword: string) {
  const n = ++supplierRequest
  supplierLoading.value = true
  try {
    const data = await getErpSupplierProfiles({
      begin: 0,
      step: 50,
      supplierName: keyword || undefined,
      statusCode: 'ACTIVE',
    })
    if (n === supplierRequest) suppliers.value = data.items
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '供应商加载失败'))
  } finally {
    if (n === supplierRequest) supplierLoading.value = false
  }
}
async function searchWarehouses(keyword: string) {
  const n = ++warehouseRequest
  warehouseLoading.value = true
  try {
    const data = await getErpInventoryWarehouses({
      begin: 0,
      step: 50,
      warehouseName: keyword || undefined,
      statusCode: 'ACTIVE',
    })
    if (n === warehouseRequest) warehouses.value = data.items
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '仓库加载失败'))
  } finally {
    if (n === warehouseRequest) warehouseLoading.value = false
  }
}
function warehouseChanged(code: string) {
  const w = warehouses.value.find((item) => item.warehouseCode === code)
  form.receiverName = w?.contactName || ''
  form.receiverPhone = w?.contactPhone || ''
  form.receivingAddress = w?.address || ''
}
watch(visible, async (value) => {
  const token = ++editorRequest
  if (!value) return
  detail.value = undefined
  lines.value = []
  contractName.value = ''
  Object.assign(form, {
    supplierCode: '',
    targetWarehouseCode: '',
    purchaseDate: new Date().toLocaleDateString('sv-SE'),
    expectedArrivalTime: null,
    receiverName: '',
    receiverPhone: '',
    receivingAddress: '',
    freightAmount: undefined,
    freightBearerCode: 'BUYER',
    contractNo: '',
    contractFileKey: null,
    remark: '',
    revision: undefined,
  })
  loading.value = true
  try {
    await Promise.all([searchSuppliers(''), searchWarehouses('')])
    if (!props.orderId) return
    const row = await getProcurementOrder(props.orderId)
    if (token !== editorRequest) return
    detail.value = row
    Object.assign(form, {
      supplierCode: row.supplierCode || '',
      targetWarehouseCode: row.targetWarehouseCode || '',
      purchaseDate: row.purchaseDate || '',
      expectedArrivalTime: row.expectedArrivalTime,
      receiverName: row.receiverName || '',
      receiverPhone: row.receiverPhone || '',
      receivingAddress: row.receivingAddress || '',
      freightAmount: row.freightAmount ?? undefined,
      freightBearerCode: row.freightBearerCode || 'BUYER',
      contractNo: row.contractNo,
      contractFileKey: row.contractFileKey,
      remark: row.remark,
      revision: row.revision,
    })
    if (!suppliers.value.some((s) => s.supplierCode === row.supplierCode))
      suppliers.value.push({
        id: row.supplierId,
        supplierCode: row.supplierCode || '',
        supplierName: row.supplierName,
      } as ErpSupplierProfileView)
    if (!warehouses.value.some((w) => w.warehouseCode === row.targetWarehouseCode))
      warehouses.value.push({
        id: row.targetWarehouseId,
        warehouseCode: row.targetWarehouseCode || '',
        warehouseName: row.targetWarehouseName,
      } as ErpInternalWarehouseView)
    lines.value = row.lines.map((l) => ({
      productCode: l.productCode || '',
      variantCode: l.variantCode || '',
      productName: l.productName,
      specification: l.specification || null,
      defaultUnitCode: l.unitCode,
      baseUnitCode: l.baseUnitCode || l.unitCode,
      middleUnitCode: null,
      baseToMiddleRate: null,
      bigUnitCode: null,
      baseToBigRate: null,
      purchasePrice: l.unitPrice,
      unitCode: l.unitCode,
      quantity: roundProcurementInput(l.quantity),
      unitPrice: roundProcurementInput(l.unitPrice),
      remark: l.remark || '',
    }))
    {
      const catalog = await Promise.all(
        [...new Set(lines.value.map((l) => l.productCode))].map((productCode) =>
          getProcurementProducts({ begin: 0, step: 200, productCode }),
        ),
      )
      if (token !== editorRequest) return
      for (const line of lines.value) {
        const product = catalog
          .flatMap((d) => d.items)
          .find((p) => p.variantCode === line.variantCode)
        if (product)
          Object.assign(line, {
            middleUnitCode: product.middleUnitCode,
            baseToMiddleRate: product.baseToMiddleRate,
            bigUnitCode: product.bigUnitCode,
            baseToBigRate: product.baseToBigRate,
          })
      }
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '采购订单加载失败'))
    visible.value = false
  } finally {
    if (token === editorRequest) loading.value = false
  }
})
function removeContract() {
  form.contractFileKey = null
  contractName.value = ''
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024 || !/\.(pdf|docx?|jpg|png)$/i.test(file.name)) {
    ElMessage.warning('请选择10MB以内的PDF、Word、JPG或PNG文件')
    input.value = ''
    return
  }
  uploading.value = true
  try {
    form.contractFileKey = await uploadProcurementContract(file, props.orderId)
    contractName.value = file.name
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '合同上传失败'))
  } finally {
    uploading.value = false
    input.value = ''
  }
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return
  if (
    !form.freightBearerCode?.trim() ||
    form.freightAmount == null ||
    !Number.isFinite(form.freightAmount) ||
    form.freightAmount < 0
  ) {
    ElMessage.warning('请选择运费承担并填写物流费，无运费填0')
    return
  }
  if (!lines.value.length) {
    ElMessage.warning('请至少选择一个商品')
    return
  }
  for (const line of lines.value) {
    line.quantity = roundProcurementInput(line.quantity)
    line.unitPrice = roundProcurementInput(line.unitPrice)
  }
  if (
    lines.value.some(
      (l) =>
        !Number.isFinite(l.quantity) ||
        l.quantity! <= 0 ||
        !Number.isFinite(l.unitPrice) ||
        l.unitPrice! < 0,
    )
  ) {
    ElMessage.warning('请填写每个商品的采购数量（大于0）和采购价（不小于0）')
    return
  }
  saving.value = true
  try {
    const command: ProcurementOrderCommand = {
      ...form,
      lines: lines.value.map((l) => ({
        productCode: l.productCode,
        variantCode: l.variantCode,
        unitCode: l.unitCode,
        quantity: l.quantity!,
        unitPrice: l.unitPrice!,
        remark: l.remark,
      })),
    }
    if (props.orderId) await updateProcurementOrder(props.orderId, command)
    else await createProcurementOrder(command)
    ElMessage.success('采购单已保存，状态为待确认')
    visible.value = false
    emit('saved')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '保存失败，请检查输入或刷新后重试'))
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.purchase-editor {
  padding: 0;
}
.document-meta,
.section-toolbar,
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.document-meta {
  padding: 0 0 16px;
  color: #64748b;
}
.purchase-editor section {
  background: white;
  border: 1px solid #dfe6ef;
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 18px;
}
.section-toolbar h3 {
  margin: 0;
}
.section-toolbar {
  margin-bottom: 16px;
}
.muted,
.line-note {
  color: #8492a6;
  font-size: 12px;
}
.muted {
  font-weight: normal;
  margin-left: 8px;
}
.line-note {
  margin-top: 12px;
}
.required {
  color: #f56c6c;
}
.totals {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #64748b;
}
.totals strong {
  color: #1e293b;
  font-size: 17px;
}
.totals .primary {
  color: #2563eb;
}
.contract-cost-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 28px;
}
.freight-column {
  border-left: 1px solid #e2e8f0;
  padding-left: 20px;
}
.contract-file {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #dfe6ef;
  border-radius: 6px;
  background: #f8fafc;
}
.contract-file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #334155;
}
.contract-file-name svg {
  width: 20px;
  height: 20px;
  flex: none;
  color: #2563eb;
}
.contract-file-name > span:first-of-type {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.contract-file-name :deep(.el-tag) {
  flex: none;
}
.contract-file-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.contract-file-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.contract-file-help {
  margin: 8px 0 0;
  color: #8492a6;
  font-size: 12px;
  line-height: 20px;
}
.contract-remark {
  margin-top: 4px;
  margin-bottom: 0;
}
:deep(.el-select),
:deep(.el-date-editor),
:deep(.el-input-number) {
  width: 100%;
}
@media (max-width: 800px) {
  .contract-cost-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .freight-column {
    border-left: 0;
    padding-left: 0;
  }
  .editor-footer {
    align-items: flex-end;
  }
  .totals {
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
  }
  .totals strong {
    font-size: 14px;
  }
}
</style>
