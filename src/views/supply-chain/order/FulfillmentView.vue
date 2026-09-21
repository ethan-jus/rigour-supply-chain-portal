<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listFulfillmentQueue,
  getFulfillmentQueueDetail,
  executeOrderFulfillment,
  type FulfillmentQueueItem,
  type FulfillmentQueueDetail,
} from '@/api/core/order-sales'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
const access = useSupplyAuthorizationStore()
const loading = ref(false),
  busy = ref(false),
  page = ref(1),
  total = ref(0),
  keyword = ref(''),
  status = ref('PENDING'),
  rows = ref<FulfillmentQueueItem[]>([]),
  detail = ref<FulfillmentQueueDetail | null>(null),
  visible = ref(false)
async function load() {
  loading.value = true
  try {
    const r = await listFulfillmentQueue({
      begin: (page.value - 1) * 20,
      step: 20,
      keyword: keyword.value || undefined,
      outboundStatus: status.value || undefined,
    })
    rows.value = r.items
    total.value = r.total
  } finally {
    loading.value = false
  }
}
async function open(row: FulfillmentQueueItem) {
  detail.value = await getFulfillmentQueueDetail(row.orderId)
  visible.value = true
}
async function execute() {
  const d = detail.value
  if (!d) return
  try {
    await ElMessageBox.confirm(
      `确认从该订单已选仓库出库？重复重试会核对既有执行结果。`,
      '确认订单出库',
      { type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await executeOrderFulfillment(d.order.orderId, {
      warehouseId: d.order.warehouseId,
      revision: d.order.revision,
    })
    detail.value = await getFulfillmentQueueDetail(d.order.orderId)
    await load()
    ElMessage.success('已核对出库结果')
  } finally {
    busy.value = false
  }
}
function search() {
  page.value = 1
  void load()
}
onMounted(load)
</script>
<template>
  <section class="fulfillment-page">
    <SupplyPageTitle tag="h2">订单出库</SupplyPageTitle>
    <p>查看已选仓的订单商品，执行出库并核对结果。</p>
    <el-form inline @submit.prevent="search"
      ><el-form-item label="订单号"
        ><el-input v-model="keyword" clearable maxlength="100" /></el-form-item
      ><el-form-item label="状态"
        ><el-select v-model="status" style="width: 140px"
          ><el-option label="待出库" value="PENDING" /><el-option
            label="已出库"
            value="CONFIRMED" /><el-option label="全部" value="" /></el-select></el-form-item
      ><el-button native-type="submit" type="primary">查询</el-button></el-form
    >
    <el-table :data="rows" v-loading="loading"
      ><el-table-column prop="orderNo" label="订单号" /><el-table-column
        prop="warehouseName"
        label="出库仓库"
      /><el-table-column label="状态"
        ><template #default="{ row }">{{
          row.outboundStatus === 'CONFIRMED' ? '已出库' : '待出库'
        }}</template></el-table-column
      ><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="open(row as FulfillmentQueueItem)"
            >查看商品与出库</el-button
          ></template
        ></el-table-column
      ></el-table
    ><el-pagination
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="total,prev,pager,next"
      @current-change="load"
    />
    <el-dialog v-model="visible" title="订单出库" width="760px" destroy-on-close
      ><template v-if="detail"
        ><p>
          订单：{{ detail.order.orderNo }} · 已选仓库：{{
            detail.order.warehouseName || `编号 ${detail.order.warehouseId}`
          }}
        </p>
        <el-alert
          v-if="detail.execution.lastError"
          :title="detail.execution.lastError"
          type="warning"
          :closable="false"
        /><el-table :data="detail.lines"
          ><el-table-column prop="productName" label="商品" /><el-table-column
            prop="skuCode"
            label="规格编码" /><el-table-column prop="quantity" label="数量" /><el-table-column
            prop="unitCode"
            label="单位"
        /></el-table>
        <p v-if="detail.execution.stockOutNo">
          出库单：{{ detail.execution.stockOutNo }}
        </p></template
      ><template #footer
        ><el-button @click="visible = false">关闭</el-button
        ><el-button
          v-if="
            detail &&
            detail.order.outboundStatus !== 'CONFIRMED' &&
            access.can('order:outbound:confirm')
          "
          type="primary"
          :loading="busy"
          @click="execute"
          >确认出库 / 核对结果</el-button
        ></template
      ></el-dialog
    >
  </section>
</template>
<style scoped>
.fulfillment-page {
  padding: 24px;
}
.fulfillment-page > p {
  color: var(--el-text-color-secondary);
}
.el-pagination {
  margin-top: 16px;
}
</style>
