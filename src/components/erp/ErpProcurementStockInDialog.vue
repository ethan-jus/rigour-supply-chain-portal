<template>
  <el-dialog
    v-model="visible"
    title="采购入库"
    width="min(1120px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="100px"
      ><el-form-item label="采购订单" required
        ><el-select
          v-model="selectedId"
          filterable
          remote
          :remote-method="search"
          :loading="searching"
          placeholder="输入已确认的采购单号"
          @change="selectOrder"
          ><el-option
            v-for="o in orders"
            :key="o.id"
            :value="o.id"
            :label="`${o.procurementNo} · ${o.supplierName}`" /></el-select></el-form-item
      ><el-form-item label="入库时间"
        ><el-date-picker
          v-model="stockInTime"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ssZ"
          placeholder="默认当前时间" /></el-form-item
    ></el-form>
    <div v-loading="loading">
      <div v-if="detail" class="receipt-summary">
        {{ detail.supplierName }} · {{ detail.targetWarehouseName
        }}<el-button link type="primary" @click="fillAll">全部到货</el-button>
      </div>
      <el-table :data="lines" border max-height="400">
        <el-table-column
          prop="productName"
          label="商品名称"
          min-width="190"
          show-overflow-tooltip
        /><el-table-column
          prop="variantCode"
          label="SKU编码"
          min-width="160"
          show-overflow-tooltip
        />
        <!-- @vue-generic {ReceiptLine} --><el-table-column label="采购数量" width="140"
          ><template #default="{ row }"
            >{{ row.quantity }} {{ unit(row.unitCode) }}</template
          ></el-table-column
        >
        <!-- @vue-generic {ReceiptLine} --><el-table-column label="待入库" width="140"
          ><template #default="{ row }">{{
            row.receiptProgressVerified === false
              ? '待核验'
              : `${remaining(row)} ${unit(receiptUnit(row))}`
          }}</template></el-table-column
        >
        <!-- @vue-generic {ReceiptLine} --><el-table-column label="本次入库数量 *" min-width="190"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.receiptQuantity"
              :min="0"
              :max="remaining(row)"
              :precision="6"
              :controls="false"
              :disabled="row.receiptProgressVerified === false"
            />
            {{ unit(receiptUnit(row)) }}</template
          ></el-table-column
        >
      </el-table>
    </div>
    <el-input
      v-model="remark"
      type="textarea"
      :rows="2"
      maxlength="1000"
      placeholder="入库备注（选填）"
      style="margin-top: 16px"
    />
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="!detail || loading" :loading="saving" @click="save"
        >确认入库</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { errorMessage } from '@/api/core/error'
import { ElMessage } from 'element-plus'
import {
  getProcurementOrders,
  getProcurementOrder,
  confirmProcurementStockIn,
  type ProcurementOrderSummary,
  type ProcurementOrderDetail,
  type ProcurementOrderLine,
} from '@/api/core/erp-documents'
import { businessDictionaryLabel } from '@/utils/business-dictionary'
const visible = defineModel<boolean>({ default: false }),
  emit = defineEmits<{ saved: [] }>()
type ReceiptLine = ProcurementOrderLine & { receiptQuantity?: number }
const orders = ref<ProcurementOrderSummary[]>([]),
  selectedId = ref(''),
  detail = ref<ProcurementOrderDetail>(),
  lines = ref<ReceiptLine[]>([]),
  stockInTime = ref<string>(),
  remark = ref(''),
  searching = ref(false),
  loading = ref(false),
  saving = ref(false)
let searchToken = 0,
  detailToken = 0
const unit = (code: string) => businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, code)
const receiptUnit = (l: ReceiptLine) => l.baseUnitCode || l.unitCode
const remaining = (l: ReceiptLine) =>
  Math.max(
    0,
    Number(
      (
        l.quantity * (l.conversionRate || 1) -
        (l.receivedBaseQuantity ?? l.receivedQuantity ?? 0)
      ).toFixed(6),
    ),
  )
async function search(keyword: string) {
  const token = ++searchToken
  searching.value = true
  try {
    const data = await getProcurementOrders({
      begin: 0,
      step: 100,
      procurementNo: keyword || undefined,
      confirmationStatusCode: 'CONFIRMED',
    })
    if (token === searchToken)
      orders.value = data.items.filter(
        (o) => !o.sourceSystemCode && ['SUBMITTED', 'PARTIAL_IN'].includes(o.statusCode),
      )
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '可入库采购单加载失败'))
  } finally {
    if (token === searchToken) searching.value = false
  }
}
async function selectOrder(id: string) {
  const token = ++detailToken
  loading.value = true
  detail.value = undefined
  lines.value = []
  try {
    const data = await getProcurementOrder(id)
    if (token === detailToken) {
      detail.value = data
      lines.value = data.lines.map((l) => ({ ...l, receiptQuantity: undefined }))
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '采购单加载失败'))
  } finally {
    if (token === detailToken) loading.value = false
  }
}
function fillAll() {
  lines.value.forEach((l) => {
    if (l.receiptProgressVerified !== false) l.receiptQuantity = remaining(l)
  })
}
watch(visible, (value) => {
  if (value) {
    selectedId.value = ''
    detail.value = undefined
    lines.value = []
    stockInTime.value = undefined
    remark.value = ''
    void search('')
  } else {
    searchToken++
    detailToken++
  }
})
async function save() {
  if (!detail.value) return
  const selected = lines.value.filter((l) => (l.receiptQuantity || 0) > 0)
  if (!selected.length) {
    ElMessage.warning('请填写至少一项本次入库数量')
    return
  }
  saving.value = true
  try {
    await confirmProcurementStockIn({
      procurementOrderId: detail.value.id,
      procurementRevision: detail.value.revision,
      stockInTime: stockInTime.value,
      remark: remark.value,
      lines: selected.map((l) => ({
        procurementOrderLineId: l.id,
        unitCode: receiptUnit(l),
        quantity: l.receiptQuantity!,
      })),
    })
    visible.value = false
    emit('saved')
    ElMessage.success('采购入库成功')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '入库失败，请刷新采购单后重试'))
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.receipt-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  color: #64748b;
}
:deep(.el-select) {
  width: 100%;
}
</style>
