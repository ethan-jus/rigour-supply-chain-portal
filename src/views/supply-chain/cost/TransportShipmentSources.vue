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
        :type="carrierUpdating(source) ? 'info' : 'warning'"
        :closable="false"
      >
        <template v-if="!carrierUpdating(source) && mappingTarget(source)">
          <span v-if="carrierSourceValue(source)">
            同一家物流公司只需设置一次。系统会自动补齐相关运输记录。
          </span>
          <span v-else>同一种配送方式只需设置一次。系统会在同步时复核相关发货单。</span>
          <RouterLink
            v-if="can('business-settings:dict:read') && can('business-settings:dict:write')"
            :to="mappingTarget(source)!"
            @click="emit('open-mapping')"
            >去设置</RouterLink
          >
          <span v-else> 请联系有数据字典权限的同事设置。</span>
        </template>
      </el-alert>
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
            <el-table-column label="规格" min-width="120">
              <template #default="{ row }">{{ shipmentSpecification(row) }}</template>
            </el-table-column>
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
            <el-table-column
              v-if="source.latest.goods.some((row) => goodsRemark(row).trim())"
              label="商品备注"
              min-width="180"
            >
              <template #default="{ row }">
                <span class="goods-remark">{{ displayValue(goodsRemark(row)) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-collapse-item></el-collapse
      >
    </article>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { getMappedDhbCarrierValues } from '@/api/core/business-settings'
import type { ShipmentTransportSource } from '@/api/core/transport-records'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayValue } from '@/utils/business-display'
const props = defineProps<{ sources: ShipmentTransportSource[] }>()
const emit = defineEmits<{ 'open-mapping': [] }>()
const { can } = useSupplyPermissions()
const mappedCarriers = ref<string[]>([])

function goodsRemark(row: Record<string, unknown>) {
  const text = row.remark ?? row.Remark
  return typeof text === 'string' ? text : ''
}

function specificationText(value: unknown) {
  if (typeof value === 'string') return value.trim()
  return typeof value === 'number' ? String(value) : ''
}

function shipmentSpecification(row: Record<string, unknown>) {
  const options = Array.isArray(row.options_info) ? row.options_info : []
  const names = options.map((option) => specificationText(option?.options_name)).filter(Boolean)
  if (names.length) return names.join(' / ')
  return (
    [
      row.OptionsName,
      row.goods_options,
      row.options_name,
      row.GoodsOptions,
      row.specification,
      row.spec,
    ]
      .map(specificationText)
      .find(Boolean) || '-'
  )
}

watch(
  () => props.sources.map(carrierSourceValue).filter(Boolean),
  async (values, _, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    mappedCarriers.value = []
    if (!values.length || !can('order:logistics-cost:read')) return
    try {
      const mapped = await getMappedDhbCarrierValues([...new Set(values)])
      if (current) mappedCarriers.value = mapped
    } catch {
      // 字典状态暂不可用时继续展示原单的核对提示。
    }
  },
  { immediate: true },
)

function carrierSourceValue(source: ShipmentTransportSource) {
  if (mappingField(source)?.dictionary !== 'COST_CARRIER') return ''
  return (
    sourceField(source, 'logistics_code') ||
    sourceField(source, 'logistics_name') ||
    source.latest.carrierName ||
    ''
  )
}
function carrierUpdating(source: ShipmentTransportSource) {
  return mappedCarriers.value.includes(carrierSourceValue(source))
}

function mappingField(source: ShipmentTransportSource) {
  if (needsDoorDeliveryReview(source)) {
    if (
      source.latest.carrierCode ||
      (!sourceField(source, 'logistics_code') && !sourceField(source, 'logistics_name'))
    )
      return null
    return {
      dictionary: 'COST_CARRIER',
      code: 'logistics_code',
      name: 'logistics_name',
    }
  }
  if (source.issue?.includes('来源配送方式尚未映射'))
    return {
      dictionary: 'COST_DELIVERY_MODE',
      code: 'distribution_mode_id',
      name: 'distribution_mode_name',
    }
  if (source.issue?.includes('来源物流公司尚未映射'))
    return {
      dictionary: 'COST_CARRIER',
      code: 'logistics_code',
      name: 'logistics_name',
    }
  return null
}
function sourceField(source: ShipmentTransportSource, field: string) {
  const { detail, list } = source.latest.sourceFields ?? {}
  for (const payload of [detail, list]) {
    const value = (payload as Record<string, unknown> | null)?.[field]
    if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
function needsDoorDeliveryReview(source: ShipmentTransportSource) {
  return (
    source.issue?.includes('订货宝仅标记送货上门') ||
    (source.issue?.includes('来源配送方式尚未映射') &&
      (sourceField(source, 'distribution_mode_name') || source.latest.deliveryModeName) ===
        '送货上门')
  )
}
function mappingTarget(source: ShipmentTransportSource) {
  const field = mappingField(source)
  if (!field) return null
  return {
    path: '/supply-chain/settings/numbering-dictionaries',
    query: {
      dictionary: field.dictionary,
      tab: 'sources',
      source: 'DHB_SHIPMENT_LOGISTICS',
      value:
        sourceField(source, field.code) ||
        sourceField(source, field.name) ||
        carrierSourceValue(source),
      label: sourceField(source, field.name) || undefined,
    },
  }
}
function sourceNotice(source: ShipmentTransportSource) {
  if (carrierUpdating(source)) {
    const name = source.latest.carrierName || sourceField(source, 'logistics_name')
    return name ? `${name} · 更新中` : '物流公司更新中'
  }
  if (needsDoorDeliveryReview(source)) {
    const carrier = sourceField(source, 'logistics_name') || source.latest.carrierName
    if (source.latest.carrierCode) return '配送方式待核对。'
    if (carrier) return `物流公司待核对：${carrier}`
    return '订货宝未提供物流公司，请核对原发货单。'
  }
  const field = mappingField(source)
  if (!field) return source.issue || '原发货信息已更新，请核对运输记录'
  if (field.dictionary === 'COST_DELIVERY_MODE') return '配送方式待核对。'
  const name = sourceField(source, field.name) || source.latest.carrierName
  return name ? `物流公司待核对：${name}` : '物流公司待核对'
}

const sourceStatus = (s: string) =>
  ({ shipped: '待发货', receivedin: '待收货', received: '已收货', cancelled: '已取消' })[s] ||
  '待核对'
</script>
<style scoped>
.goods-remark {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
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
