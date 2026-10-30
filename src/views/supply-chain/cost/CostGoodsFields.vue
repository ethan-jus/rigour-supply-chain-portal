<template>
  <h3 class="cost-section-title">{{ category === 'losses' ? '损耗对象' : '商品与供应商' }}</h3>
  <div class="cost-field-grid">
    <el-form-item label="商品" required :class="{ 'cost-field-wide': category === 'losses' }">
      <CostEntryMode v-model="productMode" label="商品">
        <template #linked>
          <CostReferenceSelect
            v-model="goods.productId"
            :loader="products"
            :snapshot="goods.productName"
            placeholder="搜索并选择商品"
            manual-label="未找到商品，手动填写"
            @change="chooseProduct"
            @manual="productMode = 'MANUAL'"
          />
        </template>
        <template #manual>
          <el-input v-model="goods.productName" maxlength="200" placeholder="填写商品名称" />
        </template>
      </CostEntryMode>
    </el-form-item>
    <el-form-item v-if="category === 'purchases'" label="供应商">
      <CostEntryMode v-model="supplierMode" label="供应商">
        <template #linked>
          <CostReferenceSelect
            v-model="goods.supplierId"
            :loader="suppliers"
            :snapshot="goods.supplierName"
            placeholder="搜索并选择供应商"
            manual-label="未找到供应商，手动填写"
            @change="(r) => (goods.supplierName = r?.name || '')"
            @manual="supplierMode = 'MANUAL'"
          />
        </template>
        <template #manual>
          <el-input v-model="goods.supplierName" maxlength="200" placeholder="填写供应商名称" />
        </template>
      </CostEntryMode>
      <span class="goods-field-hint">供应商可先待补，核对确认前必须填写。</span>
    </el-form-item>
    <el-form-item label="规格" :required="productMode === 'LINKED'">
      <CostReferenceSelect
        v-if="productMode === 'LINKED'"
        v-model="goods.variantId"
        :loader="variants"
        :reset-key="String(goods.productId)"
        :snapshot="variantSnapshot"
        :disabled="!goods.productId"
        :placeholder="goods.productId ? '请选择商品规格' : '请先选择商品'"
        @change="chooseVariant"
      />
      <el-input
        v-else
        v-model="goods.specification"
        placeholder="填写商品规格（可选）"
        maxlength="500"
      />
      <span v-if="goods.productId && !goods.variantId" class="goods-field-hint">
        请先选择规格，单位自动带入。商品未建立规格时，可切换为手动填写。
      </span>
      <span v-else-if="goods.variantId && !goods.specification?.trim()" class="goods-field-hint">
        已关联商品规格记录，主档未填写规格名称，可正常保存。
      </span>
    </el-form-item>
    <el-form-item label="单位" required
      ><el-input
        v-if="productMode === 'LINKED'"
        :model-value="goods.unit ? costLabel('PRODUCT_UNIT', goods.unit) : ''"
        placeholder="选择规格后自动带入"
        disabled
      />
      <el-select v-else v-model="goods.unit" filterable placeholder="请选择单位">
        <el-option
          v-for="option in unitOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
          :disabled="option.disabled"
        />
      </el-select>
    </el-form-item>
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
      ><el-input-number v-model="goods.quantity" :min="0" :precision="6" :max="99999999999999" />
      <span v-if="category === 'purchases'" class="goods-field-hint">
        数量可先待补，核对确认前必须大于 0；按上方所选单位填写。
      </span></el-form-item
    >
    <template v-if="category === 'purchases'">
      <el-form-item label="金额填写方式" class="cost-field-wide">
        <el-radio-group v-model="amountMode" aria-label="进货金额填写方式">
          <el-radio-button value="CALCULATED">按单价 × 数量计算</el-radio-button>
          <el-radio-button value="ACTUAL">填写实际金额</el-radio-button>
        </el-radio-group>
        <span class="goods-field-hint"
          >按所选规格的单位计算；有折扣、补差或金额待核实时，填写实际金额并说明。</span
        >
      </el-form-item>
      <el-form-item label="登记金额（元）">
        <el-input-number
          :model-value="amount"
          :disabled="amountMode === 'CALCULATED'"
          :controls="false"
          :min="0"
          :precision="2"
          :max="99999999999999.99"
          placeholder="待补金额"
          @update:model-value="emit('update:amount', $event ?? null)"
        />
        <span class="goods-field-hint">{{
          amountMode === 'CALCULATED'
            ? '单价或数量变化时自动更新，保留两位小数。'
            : '金额未知可留空保存，确认前须补齐。'
        }}</span>
      </el-form-item>
      <el-form-item v-if="suggested != null" label="计算核对">
        <span
          >{{ goods.unitPrice }} × {{ goods.quantity }}
          {{ costLabel('PRODUCT_UNIT', goods.unit) }} = {{ costMoney(suggested) }} 元</span
        >
        <span
          v-if="amount != null && amount !== suggested"
          class="goods-field-hint goods-field-warning"
          >与登记金额相差
          {{ costMoney(Math.abs(amount - suggested)) }} 元，确认前请填写金额说明。</span
        >
      </el-form-item>
    </template>
    <el-form-item v-if="category === 'losses'" label="损耗原因" required
      ><el-input v-model="goods.lossReason" type="textarea" maxlength="500"
    /></el-form-item>
    <el-form-item v-if="category === 'purchases'" label="金额说明"
      ><el-input
        v-model="goods.amountReason"
        maxlength="500"
        placeholder="零单价，或金额与单价×数量不一致时填写"
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
        <p>请按采购凭据填写原单号及日期。</p></template
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
import { displayBusinessLabel as costLabel } from '@/utils/business-display'
import { displayAmount as costMoney } from '@/utils/business-display'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { suggestedPurchaseAmount } from './cost-amount'
import { costOptions } from './cost-dictionaries'
import {
  getCostReferences,
  getCostPurchaseOrders,
  getCostWarehouses,
  type CostGoods,
  type CostCategory,
} from '@/api/core/cost'
import CostExternalDocumentFields from './CostExternalDocumentFields.vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import CostEntryMode from './CostEntryMode.vue'
import { useCostEntryMode } from './use-cost-entry-mode'
const props = defineProps<{
  persisted?: boolean
  amount?: number | null
  category: CostCategory
  cityCode?: string
  purchaseSnapshot?: string
  warehouseSnapshot?: string
}>()
const goods = defineModel<CostGoods>({ required: true })
const productMode = useCostEntryMode(goods, {
  empty: { productId: null, variantId: null, productName: '', specification: '', unit: '' } as Pick<
    CostGoods,
    'productId' | 'variantId' | 'productName' | 'specification' | 'unit'
  >,
  isLinked: (value) => !!value.productId,
  hasName: (value) => !!value.productName?.trim(),
  toManual: (value) => ({ ...value, productId: null, variantId: null }),
})
const supplierMode = useCostEntryMode(goods, {
  empty: { supplierId: null, supplierName: '' } as Pick<CostGoods, 'supplierId' | 'supplierName'>,
  isLinked: (value) => !!value.supplierId,
  hasName: (value) => !!value.supplierName?.trim(),
  toManual: (value) => ({ ...value, supplierId: null }),
})
const variantSnapshot = computed(() =>
  [goods.value.specification?.trim() || '未维护规格', costLabel('PRODUCT_UNIT', goods.value.unit)]
    .filter(Boolean)
    .join(' · '),
)
const unitOptions = computed(() => {
  const options = costOptions('PRODUCT_UNIT').map((option) => ({ ...option, disabled: false }))
  const current = goods.value.unit
  // 保留历史手填名称或停用项的回显；新选择只能使用当前启用的字典项。
  if (current && !options.some((option) => option.value === current))
    options.unshift({ value: current, label: costLabel('PRODUCT_UNIT', current), disabled: true })
  return options
})
const emit = defineEmits<{ city: [string]; 'update:amount': [number | null] }>()
// 历史记录保留实际金额，打开编辑器不触发重新估值。
const amountMode = ref(props.persisted || props.amount != null ? 'ACTUAL' : 'CALCULATED')
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
  goods.value.unitPrice != null && goods.value.quantity != null && goods.value.quantity > 0
    ? suggestedPurchaseAmount(goods.value.unitPrice, goods.value.quantity)
    : null,
)
watch([amountMode, suggested], () => {
  if (props.category === 'purchases' && amountMode.value === 'CALCULATED')
    emit('update:amount', suggested.value)
})
const refs = (kind: string) => (q: string, begin: number) =>
  getCostReferences(props.category, kind, q, goods.value.productId, begin).then((rows) =>
    rows.map((r) => ({ ...r, label: [r.name, r.specification].filter(Boolean).join(' · ') })),
  )
const products = refs('products'),
  suppliers = refs('suppliers')
const variants = async (q: string, begin: number) =>
  (await getCostReferences(props.category, 'variants', q, goods.value.productId, begin)).map(
    (r) => ({
      ...r,
      label: [r.specification?.trim() || '未维护规格', costLabel('PRODUCT_UNIT', r.unit)]
        .filter(Boolean)
        .join(' · '),
    }),
  )
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
  goods.value.productName = r?.name || ''
  // 商品包装规格不是 SKU 规格，切换或清空商品后必须重新选择实际规格。
  goods.value.specification = ''
  goods.value.unit = ''
}
function chooseVariant(r: ReferenceOption | null) {
  goods.value.specification = String(r?.specification || '')
  goods.value.unit = String(r?.unit || '')
}
function chooseOrder(r: ReferenceOption | null) {
  purchaseLabel.value = r?.name || ''
  if (!r && goods.value.externalDocument) goods.value.externalDocument.linkedId = null
  selectedPurchaseCity.value = r ? String(r.cityCode) : ''
  if (r) {
    emit('city', String(r.cityCode))
    goods.value.warehouseId = r.targetWarehouseId ? String(r.targetWarehouseId) : null
    if (!goods.value.supplierId && !goods.value.supplierName && r.senderName) {
      supplierMode.value = 'MANUAL'
      goods.value.supplierName ||= String(r.senderName)
    }
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
<style scoped>
.goods-field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
  margin-top: 4px;
}
.goods-field-warning {
  color: var(--el-color-warning-dark-2);
}
</style>
