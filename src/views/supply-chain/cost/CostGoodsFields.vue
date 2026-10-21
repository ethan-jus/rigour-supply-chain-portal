<template>
  <h3 class="cost-section-title">{{ category === 'losses' ? '损耗对象' : '商品与供应商' }}</h3>
  <div class="cost-field-grid">
    <el-form-item label="关联商品"
      ><CostReferenceSelect
        v-model="goods.productId"
        :loader="products"
        :snapshot="goods.productName"
        placeholder="搜索系统商品（可选）"
        @change="chooseProduct"
    /></el-form-item>
    <el-form-item v-if="goods.productId" label="关联 SKU"
      ><CostReferenceSelect
        v-model="goods.variantId"
        :loader="variants"
        :reset-key="goods.productId"
        :snapshot="goods.specification"
        placeholder="选择实际规格，不自动匹配"
        @change="chooseVariant"
    /></el-form-item>
    <el-form-item label="商品名称" required
      ><el-input v-model="goods.productName" :disabled="!!goods.productId" maxlength="200"
    /></el-form-item>
    <el-form-item label="规格"
      ><el-input v-model="goods.specification" :disabled="!!goods.variantId" maxlength="500"
    /></el-form-item>
    <el-form-item label="单位" required
      ><el-input
        v-model="goods.unit"
        :disabled="!!goods.variantId"
        maxlength="64"
        placeholder="手填单位或选择 SKU 带入"
    /></el-form-item>
    <el-form-item v-if="category === 'purchases'" label="关联供应商"
      ><CostReferenceSelect
        v-model="goods.supplierId"
        :loader="suppliers"
        :snapshot="goods.supplierName"
        placeholder="搜索系统供应商（可选）"
        @change="
          (r) => {
            if (r) goods.supplierName = r.name
          }
        "
    /></el-form-item>
    <el-form-item v-if="category === 'purchases'" label="供应商"
      ><el-input v-model="goods.supplierName" :disabled="!!goods.supplierId" maxlength="200"
    /></el-form-item>
    <el-form-item label="关联仓库"
      ><CostReferenceSelect
        v-model="goods.warehouseId"
        :loader="warehouses"
        :snapshot="warehouseLabel"
        placeholder="搜索系统仓库（可选）"
        @change="
          (r) => {
            warehouseLabel = r?.name || ''
          }
        "
    /></el-form-item>
    <el-form-item
      :label="category === 'losses' ? '损耗发生地点' : '收货地点'"
      :required="category === 'losses' && !goods.warehouseId"
      ><el-input v-model="goods.location" maxlength="500"
    /></el-form-item>
  </div>
  <h3 class="cost-section-title">{{ category === 'losses' ? '损耗情况' : '进货信息' }}</h3>
  <slot name="occurrence" />
  <div class="cost-field-grid">
    <el-form-item v-if="category === 'purchases'" label="进货单价（元）" required
      ><el-input-number v-model="goods.unitPrice" :min="0" :precision="6" :max="99999999999999"
    /></el-form-item>
    <el-form-item
      :label="category === 'losses' ? '损耗数量' : '进货数量'"
      :required="category === 'losses'"
      ><el-input-number v-model="goods.quantity" :min="0" :precision="6" :max="99999999999999"
    /></el-form-item>
    <el-form-item
      v-if="category === 'purchases' && goods.unitPrice != null && goods.quantity != null"
      label="参考金额"
      ><span>{{ suggested }}</span
      ><el-button link @click="emit('suggestAmount', suggested)">填入金额</el-button
      ><span>仅辅助填写，最终以登记金额为准</span></el-form-item
    >
    <el-form-item v-if="category === 'losses'" label="损耗原因" required
      ><el-input v-model="goods.lossReason" type="textarea" maxlength="500"
    /></el-form-item>
    <el-form-item v-if="category === 'purchases'" label="金额说明"
      ><el-input
        v-model="goods.amountReason"
        maxlength="500"
        placeholder="金额与单价×数量不一致时填写"
    /></el-form-item>
  </div>
  <h3 class="cost-section-title">来源与补充</h3>
  <el-collapse
    ><el-collapse-item title="来源凭据（可选）" name="source">
      <el-form-item label="单据来源（可选）"
        ><el-radio-group v-model="sourceMode" @change="changeSourceMode"
          ><el-radio-button value="NONE">无来源单据</el-radio-button
          ><el-radio-button value="LINKED">选择系统单据</el-radio-button
          ><el-radio-button value="MANUAL">手动录入外部单据</el-radio-button></el-radio-group
        ></el-form-item
      >
      <template v-if="goods.externalDocument"
        ><CostExternalDocumentFields v-model="goods.externalDocument" />
        <p>仅记录来源信息，不生成本系统采购单。</p></template
      >
      <el-form-item
        v-if="sourceMode !== 'NONE'"
        :label="goods.externalDocument ? '补关联采购单' : '关联采购单'"
        ><CostReferenceSelect
          v-model="goods.purchaseOrderId"
          :loader="orders"
          :reset-key="cityCode"
          placeholder="搜索采购单号、供应商或仓库（可选）"
          :snapshot="purchaseLabel"
          @change="chooseOrder"
      /></el-form-item> </el-collapse-item
  ></el-collapse>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { suggestedPurchaseAmount } from './cost-amount'
import {
  getCostReferences,
  getCostPurchaseOrders,
  getCostWarehouses,
  type CostGoods,
  type CostCategory,
} from '@/api/core/cost'
import CostExternalDocumentFields from './CostExternalDocumentFields.vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
const props = defineProps<{
  persisted?: boolean
  category: CostCategory
  cityCode?: string
  purchaseSnapshot?: string
  warehouseSnapshot?: string
}>()
const goods = defineModel<CostGoods>({ required: true })
const emit = defineEmits<{ city: [string]; suggestAmount: [number] }>()
const selectedPurchaseCity = ref(goods.value.purchaseOrderId ? props.cityCode || '' : '')
const purchaseLabel = ref(props.purchaseSnapshot || ''),
  warehouseLabel = ref(props.warehouseSnapshot || '')
const sourceMode = ref(
  goods.value.externalDocument ? 'MANUAL' : goods.value.purchaseOrderId ? 'LINKED' : 'NONE',
)
function changeSourceMode() {
  if (props.persisted && goods.value.externalDocument && sourceMode.value === 'LINKED') {
    sourceMode.value = 'MANUAL'
    ElMessage.info('请在外部凭据下方补关联采购单，保留原始来源')
    return
  }
  purchaseLabel.value = ''
  goods.value.purchaseOrderId = null
  goods.value.externalDocument =
    sourceMode.value === 'MANUAL'
      ? {
          sourceSystem: 'DHB',
          documentType: 'PURCHASE',
          documentNo: '',
          documentDate: '',
          senderName: '',
          receiverName: '',
          remark: '',
        }
      : null
}
const suggested = computed(() =>
  suggestedPurchaseAmount(goods.value.unitPrice ?? 0, goods.value.quantity ?? 0),
)
const refs = (kind: string) => (q: string, begin: number) =>
  getCostReferences(props.category, kind, q, goods.value.productId, begin).then((rows) =>
    rows.map((r) => ({ ...r, label: `${r.name} · ${r.specification || r.code}` })),
  )
const products = refs('products'),
  variants = refs('variants'),
  suppliers = refs('suppliers')
const orders = async (q: string, begin: number) =>
  (await getCostPurchaseOrders(props.category, q, props.cityCode, begin)).map((r) => ({
    ...r,
    name: r.documentNo,
    label: `${r.documentNo} · ${r.senderName} → ${r.receiverName}`,
  }))
const warehouses = async (q: string, begin: number) =>
  begin
    ? []
    : (await getCostWarehouses(props.category, q)).map((r) => ({
        id: r.value,
        label: r.label,
        name: r.name || r.label,
      }))
function chooseProduct(r: ReferenceOption | null) {
  goods.value.variantId = null
  if (r) {
    goods.value.productName = r.name
    goods.value.specification = String(r.specification || '')
    goods.value.unit = String(r.unit || '')
  }
}
function chooseVariant(r: ReferenceOption | null) {
  if (r) {
    goods.value.specification = String(r.specification || '')
    goods.value.unit = String(r.unit || '')
  }
}
function chooseOrder(r: ReferenceOption | null) {
  purchaseLabel.value = r?.name || ''
  if (!r && goods.value.externalDocument) goods.value.externalDocument.linkedId = null
  selectedPurchaseCity.value = r ? String(r.cityCode) : ''
  if (r) {
    emit('city', String(r.cityCode))
    goods.value.warehouseId = r.targetWarehouseId ? String(r.targetWarehouseId) : null
    goods.value.supplierName ||= String(r.senderName || '')
    if (goods.value.externalDocument) goods.value.externalDocument.linkedId = r.id
    warehouseLabel.value = String(r.receiverName)
  }
}
watch(
  () => props.cityCode,
  (city) => {
    if (
      goods.value.purchaseOrderId &&
      selectedPurchaseCity.value &&
      selectedPurchaseCity.value !== city
    ) {
      goods.value.purchaseOrderId = null
      if (goods.value.externalDocument) goods.value.externalDocument.linkedId = null
      purchaseLabel.value = ''
    }
  },
)
</script>
