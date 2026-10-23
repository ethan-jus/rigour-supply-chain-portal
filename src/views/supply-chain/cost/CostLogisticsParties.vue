<template>
  <div class="manual-route-fields cost-field-grid">
    <el-form-item :label="roles.sender" required>
      <CostEntryMode v-model="senderMode" :label="roles.sender">
        <template #linked>
          <CostReferenceSelect
            v-if="logistics.legCode === 'PURCHASE'"
            v-model="logistics.supplierId"
            :loader="suppliers"
            :snapshot="logistics.senderName"
            placeholder="搜索并选择供应商"
            manual-label="未找到供应商，手动填写"
            @change="(row) => (logistics.senderName = row?.name || '')"
            @manual="senderMode = 'MANUAL'"
          />
          <CostReferenceSelect
            v-else
            v-model="logistics.sourceWarehouseId"
            :loader="sourceWarehouses"
            :snapshot="logistics.senderName"
            :placeholder="'搜索并选择' + roles.sender"
            :manual-label="'未找到' + roles.sender + '，手动填写'"
            @change="(row) => selectWarehouse('source', row)"
            @manual="senderMode = 'MANUAL'"
          />
        </template>
        <template #manual>
          <el-input
            v-model="logistics.senderName"
            :placeholder="'填写' + roles.sender + '名称'"
            maxlength="200"
          />
        </template>
      </CostEntryMode>
    </el-form-item>
    <el-form-item :label="roles.receiver" required>
      <CostEntryMode v-model="receiverMode" :label="roles.receiver">
        <template #linked>
          <CostReferenceSelect
            v-if="logistics.legCode === 'DELIVERY'"
            v-model="logistics.customerId"
            :loader="customers"
            :snapshot="logistics.receiverName"
            :disabled="!cityCode"
            :placeholder="cityCode ? '搜索并选择本城市客户' : '请先选择费用归属'"
            manual-label="未找到客户，手动填写"
            @change="(row) => (logistics.receiverName = row?.name || '')"
            @manual="receiverMode = 'MANUAL'"
          />
          <CostReferenceSelect
            v-else
            v-model="logistics.targetWarehouseId"
            :loader="targetWarehouses"
            :snapshot="logistics.receiverName"
            :placeholder="'搜索并选择' + roles.receiver"
            :manual-label="'未找到' + roles.receiver + '，手动填写'"
            @change="(row) => selectWarehouse('target', row)"
            @manual="receiverMode = 'MANUAL'"
          />
        </template>
        <template #manual>
          <el-input
            v-model="logistics.receiverName"
            :placeholder="'填写' + roles.receiver + '名称'"
            maxlength="200"
          />
        </template>
      </CostEntryMode>
    </el-form-item>
    <el-form-item label="发货地址">
      <el-input
        v-model="logistics.originAddress"
        maxlength="500"
        :placeholder="roles.sender + '的发货地址'"
      />
    </el-form-item>
    <el-form-item label="收货地址">
      <el-input
        v-model="logistics.destinationAddress"
        maxlength="500"
        :placeholder="roles.receiver + '的收货地址'"
      />
      <span v-if="logistics.legCode === 'DELIVERY'" class="field-hint"
        >确认前需补齐客户实际收货地址。</span
      >
    </el-form-item>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { CostCommand } from '@/api/core/cost'
import CostEntryMode from './CostEntryMode.vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import { logisticsRoles } from './cost-logistics'
import { useCostEntryMode } from './use-cost-entry-mode'

type Logistics = NonNullable<CostCommand['logistics']>
type Loader = (keyword: string, begin: number) => Promise<ReferenceOption[]>
const props = defineProps<{
  cityCode: string
  suppliers: Loader
  customers: Loader
  warehouses: Loader
}>()
const logistics = defineModel<Logistics>({ required: true })
const emit = defineEmits<{ warehouse: [side: 'source' | 'target', row: ReferenceOption | null] }>()
const roles = computed(() => logisticsRoles(logistics.value.legCode))
const senderMode = useCostEntryMode(logistics, {
  empty: { supplierId: null, sourceWarehouseId: null, senderName: '' } as Pick<
    Logistics,
    'supplierId' | 'sourceWarehouseId' | 'senderName'
  >,
  isLinked: (value) => !!value.supplierId || !!value.sourceWarehouseId,
  hasName: (value) => !!value.senderName?.trim(),
  toManual: (value) => ({ ...value, supplierId: null, sourceWarehouseId: null }),
})
const receiverMode = useCostEntryMode(logistics, {
  empty: { customerId: null, targetWarehouseId: null, receiverName: '' } as Pick<
    Logistics,
    'customerId' | 'targetWarehouseId' | 'receiverName'
  >,
  isLinked: (value) => !!value.customerId || !!value.targetWarehouseId,
  hasName: (value) => !!value.receiverName?.trim(),
  toManual: (value) => ({ ...value, customerId: null, targetWarehouseId: null }),
})
const warehouseLoader =
  (side: 'source' | 'target'): Loader =>
  async (keyword, begin) => {
    const expected =
      side === 'source'
        ? logistics.value.legCode === 'TRANSFER'
          ? 'CENTER'
          : 'CITY'
        : logistics.value.legCode === 'PURCHASE'
          ? 'CENTER'
          : 'CITY'
    // 与后端运输角色校验一致；类型未维护的历史仓库仍可登记，由确认环节核对。
    return (await props.warehouses(keyword, begin)).filter(
      (row) =>
        (!row.warehouseTypeCode || row.warehouseTypeCode === expected) &&
        (expected !== 'CITY' || !props.cityCode || row.regionCode === props.cityCode),
    )
  }
const sourceWarehouses = warehouseLoader('source')
const targetWarehouses = warehouseLoader('target')
function selectWarehouse(side: 'source' | 'target', row: ReferenceOption | null) {
  if (side === 'source') logistics.value.senderName = row?.name || ''
  else logistics.value.receiverName = row?.name || ''
  emit('warehouse', side, row)
}
</script>
