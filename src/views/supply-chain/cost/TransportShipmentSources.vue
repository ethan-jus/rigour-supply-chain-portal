<template>
  <section class="transport-section" aria-label="订货宝发货信息">
    <h3>订货宝发货信息</h3>
    <article v-for="source in sources" :key="source.id" class="shipment-source">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="订货宝发货单号">{{
          source.latest.shipmentNo
        }}</el-descriptions-item>
        <el-descriptions-item label="发货状态">{{
          sourceStatus(source.latest.sourceStatus)
        }}</el-descriptions-item>
        <el-descriptions-item label="发货时间">{{
          displayRecordDateTime(source.latest.shipTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="配送公司">{{
          source.latest.carrierName || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="快递单号">{{
          source.latest.trackingNumbers.join('、') || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="配送方式">{{
          source.latest.deliveryModeName || '-'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="source.issue || source.differencePending"
        :title="source.issue || '原发货信息已更新，请核对已确认运输记录'"
        type="warning"
        :closable="false"
      />
      <el-collapse v-if="source.latest.goods.length"
        ><el-collapse-item title="发货商品" :name="source.id">
          <el-table :data="source.latest.goods" border>
            <el-table-column label="商品名称"
              ><template #default="{ row }">{{
                row.goods_name || row.GoodsName || '-'
              }}</template></el-table-column
            >
            <el-table-column label="商品编码"
              ><template #default="{ row }">{{
                row.goods_num || row.GoodsNum || '-'
              }}</template></el-table-column
            >
            <el-table-column label="规格"
              ><template #default="{ row }">{{
                row.goods_options || row.GoodsOptions || '-'
              }}</template></el-table-column
            >
            <el-table-column label="发货数量"
              ><template #default="{ row }">{{
                row.ships_number ?? row.Number ?? '-'
              }}</template></el-table-column
            >
            <el-table-column label="单位"
              ><template #default="{ row }">{{
                row.order_units_name || row.units_name || row.UnitsName || '-'
              }}</template></el-table-column
            >
          </el-table>
        </el-collapse-item></el-collapse
      >
    </article>
  </section>
</template>
<script setup lang="ts">
import type { ShipmentTransportSource } from '@/api/core/transport-records'
import { displayRecordDateTime } from '@/utils/business-display'
defineProps<{ sources: ShipmentTransportSource[] }>()
const sourceStatus = (s: string) =>
  ({ shipped: '待发货', receivedin: '待收货', received: '已收货', cancelled: '已取消' })[s] ||
  '待核对'
</script>
<style scoped>
.shipment-source + .shipment-source {
  margin-top: 20px;
}
.el-alert,
.el-collapse {
  margin-top: 12px;
}
</style>
