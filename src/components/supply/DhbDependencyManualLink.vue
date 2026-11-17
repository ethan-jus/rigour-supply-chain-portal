<template>
  <el-dialog
    v-model="visible"
    :title="`关联已补录的${label}`"
    width="min(680px, 96vw)"
    :close-on-click-modal="false"
  >
    <el-descriptions :column="1" border>
      <el-descriptions-item label="发货单号">{{ issue?.sourceId }}</el-descriptions-item>
      <el-descriptions-item v-if="issue?.relatedSalesOrderNo" label="原销售单号">{{
        issue.relatedSalesOrderNo
      }}</el-descriptions-item>
      <el-descriptions-item label="订货宝资料编号">{{
        issue?.requiredSourceId
      }}</el-descriptions-item>
    </el-descriptions>
    <el-button
      v-if="kind === 'SALES_ORDER'"
      :disabled="saving || !can('order:create') || !can('order:submit')"
      @click="salesEntryVisible = true"
      >补录销售订单</el-button
    >
    <el-button v-else :disabled="saving" @click="goCreate">去{{ label }}页面补录</el-button>
    <p v-if="kind === 'SALES_ORDER' && (!can('order:create') || !can('order:submit'))">
      补录销售订单需要新增及提交权限，请联系有权限的人员处理。
    </p>
    <el-alert v-if="createdMessage" :title="createdMessage" type="success" :closable="false" />
    <el-form label-position="top" style="margin-top: 16px">
      <el-form-item :label="`选择本系统${kind === 'PRODUCT_SKU' ? '商品' : label}`" required>
        <el-select
          v-model="selected"
          filterable
          remote
          :remote-method="search"
          :loading="loading"
          :disabled="saving"
          placeholder="按单号、名称搜索已补录资料"
          style="width: 100%"
          @change="variant = ''"
        >
          <el-option v-for="item in options" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="kind === 'PRODUCT_SKU'" label="商品规格" required>
        <el-select
          v-model="variant"
          :disabled="saving || !selected"
          style="width: 100%"
          placeholder="选择已补录规格"
        >
          <el-option
            v-for="item in variants"
            :key="item.id"
            :label="`${item.variantCode} · ${item.specificationSnapshot || '默认规格'}`"
            :value="String(item.id)"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button
        type="primary"
        :loading="saving"
        :disabled="!selected || (kind === 'PRODUCT_SKU' && !variant)"
        @click="save"
        >保存资料关联</el-button
      ></template
    >
  </el-dialog>
  <SalesOrderEntry
    v-if="salesEntryVisible"
    entry-only
    :source-order-no="issue?.relatedSalesOrderNo || issue?.requiredSourceId || ''"
    @created="onSalesCreated"
    @closed="salesEntryVisible = false"
  />
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getSalesOrders, type SalesOrderDetail } from '@/api/core/order-sales'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { getInternalCrmCustomers } from '@/api/core/crm'
import { getErpInventoryWarehouses } from '@/api/core/erp-internal'
import { getErpManagedProducts, type ErpManagedProductVariant } from '@/api/core/erp-product'
import { linkDhbDependency, type DhbSyncOpenIssueItem } from '@/api/core/dhb-orchestration'
const SalesOrderEntry = defineAsyncComponent(
  () => import('@/views/supply-chain/order/SalesOrderView.vue'),
)
const { can } = useSupplyPermissions()
const salesEntryVisible = ref(false)
const createdMessage = ref('')
function onSalesCreated(order: SalesOrderDetail) {
  salesEntryVisible.value = false
  if (['DRAFT', 'CANCELLED', 'DELETED'].includes(order.orderStatusCode)) {
    error.value = '销售订单需提交后才能关联'
    return
  }
  const id = String(order.id)
  options.value = [
    { id, label: `${order.orderNo} · ${order.customerNameSnapshot || ''}` },
    ...options.value.filter((row) => row.id !== id),
  ]
  selected.value = id
  createdMessage.value = `销售订单 ${order.orderNo} 已提交，请核对后保存资料关联。`
  error.value = ''
}
const emit = defineEmits<{ saved: [] }>()
const router = useRouter(),
  visible = ref(false),
  saving = ref(false),
  loading = ref(false),
  error = ref('')
const issue = ref<DhbSyncOpenIssueItem>(),
  selected = ref(''),
  variant = ref('')
const options = ref<Array<{ id: string; label: string; variants?: ErpManagedProductVariant[] }>>([])
const kind = computed(() => issue.value?.requiredDataType || '')
const names: Record<string, string> = {
  SALES_ORDER: '销售订单',
  CUSTOMER: '客户档案',
  WAREHOUSE: '仓库信息',
  PRODUCT_SPU: '商品',
  PRODUCT_SKU: '商品规格',
}
const label = computed(() => names[kind.value] || '资料')
const variants = computed(() => options.value.find((o) => o.id === selected.value)?.variants || [])
const routes: Record<string, string> = {
  CUSTOMER: '/supply-chain/crm/customers/profiles',
  WAREHOUSE: '/supply-chain/erp/inventory/warehouses',
  PRODUCT_SPU: '/supply-chain/erp/master-data/products',
  PRODUCT_SKU: '/supply-chain/erp/master-data/products',
}
function goCreate() {
  const path = routes[kind.value]
  if (path)
    void router.push({
      path,
      query: {
        ...(issue.value?.relatedSalesOrderNo && kind.value === 'SALES_ORDER'
          ? { sourceOrderNo: issue.value.relatedSalesOrderNo }
          : {}),
      },
    })
}
let generation = 0
async function open(value: DhbSyncOpenIssueItem) {
  issue.value = value
  selected.value = ''
  variant.value = ''
  options.value = []
  error.value = ''
  createdMessage.value = ''
  visible.value = true
  await search(
    value.requiredDataType === 'SALES_ORDER'
      ? value.relatedSalesOrderNo || value.requiredSourceId || ''
      : '',
  )
}
async function search(text: string) {
  if (saving.value) return
  const version = ++generation
  loading.value = true
  error.value = ''
  try {
    const query = { begin: 0, step: 30 }
    let rows: typeof options.value = []
    if (kind.value === 'SALES_ORDER')
      rows = (await getSalesOrders({ ...query, orderNo: text || undefined })).items
        .filter((v) => !['DRAFT', 'CANCELLED', 'DELETED'].includes(v.orderStatusCode))
        .map((v) => ({ id: String(v.id), label: `${v.orderNo} · ${v.customerNameSnapshot || ''}` }))
    else if (kind.value === 'CUSTOMER')
      rows = (await getInternalCrmCustomers({ ...query, customerName: text || undefined })).items
        .filter((v) => v.statusCode === 'ACTIVE')
        .map((v) => ({ id: String(v.id), label: `${v.customerCode} · ${v.customerName}` }))
    else if (kind.value === 'WAREHOUSE')
      rows = (
        await getErpInventoryWarehouses({
          ...query,
          warehouseName: text || undefined,
          statusCode: 'ACTIVE',
        })
      ).items.map((v) => ({ id: String(v.id), label: `${v.warehouseCode} · ${v.warehouseName}` }))
    else
      rows = (
        await getErpManagedProducts({
          ...query,
          productName: text || undefined,
          withVariants: true,
        })
      ).items.map((v) => ({
        id: String(v.id),
        label: `${v.productCode} · ${v.productName}`,
        variants: v.variants,
      }))
    if (version === generation) {
      const chosen = options.value.find((item) => item.id === selected.value)
      options.value =
        chosen && !rows.some((item) => item.id === chosen.id) ? [chosen, ...rows] : rows
    }
  } catch {
    if (version === generation) error.value = '资料暂时无法读取或无查看权限，请核对后重试。'
  } finally {
    if (version === generation) loading.value = false
  }
}
async function save() {
  const value = issue.value
  if (
    saving.value ||
    !selected.value ||
    !value?.connectorId ||
    !value.requiredDataType ||
    !value.requiredSourceId ||
    (kind.value === 'PRODUCT_SKU' && !variant.value)
  )
    return
  saving.value = true
  error.value = ''
  try {
    await linkDhbDependency({
      connectorId: value.connectorId,
      sourceObjectType: value.sourceObjectType,
      sourceId: value.sourceId,
      requiredDataType: value.requiredDataType,
      requiredSourceId: value.requiredSourceId,
      targetId: kind.value === 'PRODUCT_SKU' ? variant.value : selected.value,
      ...(kind.value === 'PRODUCT_SKU' ? { productId: selected.value } : {}),
    })
    visible.value = false
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '未取得关联结果，请刷新核对后再操作。'
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>
