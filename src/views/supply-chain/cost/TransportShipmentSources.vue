<template>
  <section class="transport-section" aria-label="订货宝发货信息">
    <h3>订货宝发货信息</h3>
    <article v-for="source in sources" :key="source.id" class="shipment-source">
      <dl class="source-fields">
        <div>
          <dt>订货宝发货单号</dt>
          <dd>{{ source.latest.shipmentNo }}</dd>
        </div>
        <div>
          <dt>发货状态</dt>
          <dd>{{ sourceStatus(source.latest.sourceStatus) }}</dd>
        </div>
      </dl>
      <el-alert
        v-if="source.issue || source.differencePending"
        :title="sourceNotice(source)"
        type="warning"
        :closable="false"
      />
      <el-collapse v-if="source.latest.goods.length"
        ><el-collapse-item title="发货商品" :name="source.id">
          <el-table :data="source.latest.goods" border>
            <el-table-column label="商品名称" min-width="180"
              ><template #default="{ row }">{{
                row.goods_name || row.GoodsName || '-'
              }}</template></el-table-column
            >
            <el-table-column label="商品编码" min-width="150"
              ><template #default="{ row }">{{
                row.goods_num || row.GoodsNum || '-'
              }}</template></el-table-column
            >
            <el-table-column label="规格" min-width="120"
              ><template #default="{ row }">{{
                row.goods_options || row.GoodsOptions || '-'
              }}</template></el-table-column
            >
            <el-table-column label="发货数量" width="110"
              ><template #default="{ row }">{{
                row.ships_number ?? row.Number ?? '-'
              }}</template></el-table-column
            >
            <el-table-column label="单位" width="90"
              ><template #default="{ row }">{{
                row.ships_units_name ||
                row.order_units_name ||
                row.units_name ||
                row.UnitsName ||
                '-'
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
defineProps<{ sources: ShipmentTransportSource[] }>()
const sourceNotice = (source: ShipmentTransportSource) =>
  source.issue?.includes('来源配送方式尚未映射')
    ? `配送方式“${source.latest.deliveryModeName || '-'}”尚未对应，请在数据字典的“来源映射”中选择配送方式；保存后系统将在后续同步中自动更新原发货资料。`
    : source.issue?.includes('来源物流公司尚未映射')
      ? `物流公司“${source.latest.carrierName || '-'}”尚未对应，请在数据字典的“来源映射”中选择物流公司；保存后系统将在后续同步中自动更新原发货资料。`
      : source.issue || '原发货信息已更新，请核对运输记录'

const sourceStatus = (s: string) =>
  ({ shipped: '待发货', receivedin: '待收货', received: '已收货', cancelled: '已取消' })[s] ||
  '待核对'
</script>
<style scoped>
.source-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 20px 24px;
  margin: 0;
}
.source-fields > div {
  min-width: 0;
}
.source-fields dt {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.source-fields dd {
  margin: 8px 0 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.shipment-source + .shipment-source {
  margin-top: 20px;
}
.el-alert,
.el-collapse {
  margin-top: 12px;
}
</style>
