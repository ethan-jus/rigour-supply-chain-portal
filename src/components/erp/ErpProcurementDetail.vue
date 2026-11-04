<template>
  <ErpRecordDrawer
    v-model="visible"
    class="erp-purchase-detail"
    title="采购订单详情"
    size="min(1240px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-loading="loading" class="purchase-detail-content">
      <template v-if="order">
        <header class="purchase-detail-summary">
          <div>
            <span class="summary-label">采购单号</span><strong>{{ order.procurementNo }}</strong>
          </div>
          <div class="summary-tags">
            <el-tag :type="order.confirmationStatusCode === 'CONFIRMED' ? 'success' : 'info'">{{
              order.confirmationStatusCode === 'CONFIRMED' ? '已确认' : '待确认'
            }}</el-tag
            ><el-tag effect="plain">{{ fulfillment(order.statusCode) }}</el-tag>
          </div>
        </header>
        <div class="detail-overview">
          <section class="detail-section">
            <h3>采购信息</h3>
            <dl class="detail-fields">
              <div class="field-wide">
                <dt>供应商</dt>
                <dd>
                  {{ order.supplierName || '—' }}<small>{{ order.supplierCode }}</small>
                </dd>
              </div>
              <div>
                <dt>采购日期</dt>
                <dd>{{ order.purchaseDate || '—' }}</dd>
              </div>
              <div>
                <dt>预计到货</dt>
                <dd>{{ time(order.expectedArrivalTime) }}</dd>
              </div>
            </dl>
          </section>
          <section class="detail-section">
            <h3>收货信息</h3>
            <dl class="detail-fields">
              <div class="field-wide">
                <dt>收货仓库</dt>
                <dd>{{ order.targetWarehouseName || '—' }}</dd>
              </div>
              <div>
                <dt>收货人</dt>
                <dd>{{ order.receiverName || '—' }}</dd>
              </div>
              <div>
                <dt>收货联系电话</dt>
                <dd>{{ order.receiverPhone || '—' }}</dd>
              </div>
              <div class="field-wide">
                <dt>收货地址</dt>
                <dd>{{ order.receivingAddress || '—' }}</dd>
              </div>
            </dl>
          </section>
        </div>
        <section class="detail-section">
          <div class="detail-section-heading">
            <h3>采购商品</h3>
            <span>{{ order.lines.length }} 个 SKU</span>
          </div>
          <el-table :data="order.lines" border max-height="360" row-key="id">
            <el-table-column
              prop="productName"
              label="商品名称"
              min-width="190"
              show-overflow-tooltip
            /><el-table-column
              prop="variantCode"
              label="SKU编码"
              width="170"
              show-overflow-tooltip
            /><el-table-column
              prop="specification"
              label="规格"
              min-width="140"
              show-overflow-tooltip
            />
            <!-- @vue-generic {ProcurementOrderLine} --><el-table-column label="采购单位" width="90"
              ><template #default="{ row }">{{ unit(row.unitCode) }}</template></el-table-column
            >
            <!-- @vue-generic {ProcurementOrderLine} --><el-table-column
              label="采购数量"
              width="110"
              align="right"
              ><template #default="{ row }">{{ number(row.quantity) }}</template></el-table-column
            >
            <!-- @vue-generic {ProcurementOrderLine} --><el-table-column
              label="采购单价（元）"
              width="140"
              align="right"
              ><template #default="{ row }">{{ money(row.unitPrice) }}</template></el-table-column
            >
            <!-- @vue-generic {ProcurementOrderLine} --><el-table-column
              label="金额（元）"
              width="140"
              align="right"
              ><template #default="{ row }">{{ money(row.lineAmount) }}</template></el-table-column
            >
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
          </el-table>
        </section>
        <section class="detail-section">
          <h3>合同与费用</h3>
          <dl class="detail-fields contract-fields">
            <div>
              <dt>采购合同号</dt>
              <dd>{{ order.contractNo || '—' }}</dd>
            </div>
            <div>
              <dt>合同附件</dt>
              <dd>
                <ErpProcurementContractLink
                  v-if="order.contractFileKey"
                  :order-id="String(order.id)"
                /><span v-else>未上传</span>
              </dd>
            </div>
            <div>
              <dt>运费承担</dt>
              <dd>{{ bearer(order.freightBearerCode) }}</dd>
            </div>
            <div>
              <dt>物流费</dt>
              <dd>{{ order.freightAmount == null ? '待定' : `¥${money(order.freightAmount)}` }}</dd>
            </div>
            <div class="field-wide">
              <dt>备注</dt>
              <dd>{{ order.remark || '—' }}</dd>
            </div>
          </dl>
        </section>
        <div class="detail-audit">
          创建时间：{{ time(order.createdTime)
          }}<span>更新时间：{{ time(order.updatedTime) }}</span>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="采购订单加载失败"
        ><el-button @click="load">重新加载</el-button></el-empty
      >
    </div>
    <template #footer
      ><div class="detail-footer">
        <div v-if="order" class="detail-totals">
          <span
            >货款 <b>¥{{ money(order.totalAmount) }}</b></span
          ><span
            >我方承担运费
            <b
              >¥{{ money(order.freightBearerCode === 'BUYER' ? order.freightAmount || 0 : 0) }}</b
            ></span
          ><strong
            >采购总额 <em>¥{{ money(procurementPayable(order)) }}</em></strong
          >
        </div>
        <el-button @click="visible = false">关闭</el-button>
      </div></template
    >
  </ErpRecordDrawer>
</template>
<script setup lang="ts">
import ErpRecordDrawer from './ErpRecordDrawer.vue'
import ErpProcurementContractLink from './ErpProcurementContractLink.vue'
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getProcurementOrder,
  type ProcurementOrderDetail,
  type ProcurementOrderLine,
} from '@/api/core/erp-documents'
import { errorMessage } from '@/api/core/error'
import { businessDictionaryLabel, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { procurementPayable } from '@/utils/procurement'
const visible = defineModel<boolean>({ default: false }),
  props = defineProps<{ orderId?: string }>()
const order = ref<ProcurementOrderDetail>(),
  loading = ref(false)
let request = 0
const money = (value: number) =>
  Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const number = (value: number) =>
  Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 6 })
const time = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
const unit = (code: string) => businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, code)
const bearer = (code?: string | null) =>
  code === 'SUPPLIER' ? '供应商承担' : code === 'INCLUDED' ? '货价已含运费' : '我方承担'
const fulfillment = (code: string) =>
  ({
    DRAFT: '待确认',
    SUBMITTED: '待入库',
    PARTIAL_IN: '部分入库',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  })[code] || code
async function load() {
  if (!props.orderId) return
  const token = ++request
  loading.value = true
  try {
    const data = await getProcurementOrder(props.orderId)
    if (token === request) order.value = data
  } catch (reason) {
    if (token === request) ElMessage.error(errorMessage(reason, '采购订单加载失败'))
  } finally {
    if (token === request) loading.value = false
  }
}
watch(visible, (value) => {
  if (value) {
    order.value = undefined
    void load()
    void loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])
  } else request++
})
</script>
<style scoped>
.purchase-detail-content {
  min-height: 220px;
}
.purchase-detail-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 20px;
}
.purchase-detail-summary strong {
  display: block;
  font-size: 21px;
  margin-top: 4px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.summary-label {
  color: #64748b;
  font-size: 12px;
}
.summary-tags {
  display: flex;
  gap: 8px;
}
.detail-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.detail-section {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  padding: 18px;
  margin-bottom: 16px;
}
.detail-section h3 {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
}
.detail-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
  margin: 0;
}
.detail-fields .field-wide {
  grid-column: 1/-1;
}
.detail-fields dt {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 5px;
}
.detail-fields dd {
  font-size: 14px;
  line-height: 22px;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #172033;
}
.detail-fields dd small {
  display: block;
  color: #94a3b8;
  font-size: 12px;
}
.detail-section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.detail-section-heading span {
  font-size: 12px;
  color: #64748b;
}
.contract-fields {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.detail-audit {
  display: flex;
  gap: 24px;
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 4px;
}
.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.detail-totals {
  display: flex;
  align-items: center;
  gap: 24px;
  color: #64748b;
  font-size: 13px;
}
.detail-totals b {
  color: #334155;
  font-weight: 500;
  margin-left: 8px;
}
.detail-totals strong {
  color: #334155;
}
.detail-totals em {
  color: #2563eb;
  font-size: 20px;
  font-style: normal;
  margin-left: 8px;
}
@media (max-width: 850px) {
  .detail-overview {
    grid-template-columns: 1fr;
  }
  .contract-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .detail-totals {
    gap: 8px;
    flex-wrap: wrap;
  }
  .detail-audit {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
