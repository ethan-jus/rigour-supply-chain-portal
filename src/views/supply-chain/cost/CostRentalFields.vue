<template>
  <el-form-item v-if="needsClassification" label="历史场地类型" required>
    <el-select
      v-model="rental.premisesType"
      placeholder="原类型不明，请核对"
      @change="rental.warehouseId = null"
    >
      <el-option label="仓储费用" value="WAREHOUSE" />
      <el-option label="办公室费用" value="OFFICE" />
    </el-select>
  </el-form-item>
  <h3 class="cost-section-title">{{ office ? '办公室信息' : '仓库信息' }}</h3>
  <div class="cost-field-grid">
    <el-form-item v-if="!office" label="关联仓库"
      ><CostReferenceSelect
        v-model="rental.warehouseId"
        :loader="warehouses"
        :snapshot="warehouseSnapshot"
        placeholder="选择已有仓库；没有主档可手填"
        @change="chooseWarehouse"
    /></el-form-item>
    <el-form-item :label="office ? '办公室名称' : '仓库名称'" required
      ><el-input v-model="rental.premisesName" :disabled="!!rental.warehouseId" maxlength="120"
    /></el-form-item>
    <el-form-item label="租赁面积（㎡）" required
      ><el-input-number v-model="rental.area" :min="0" :precision="2"
    /></el-form-item>
    <slot name="city" />
    <el-form-item label="地址"><el-input v-model="rental.address" maxlength="500" /></el-form-item>
  </div>
  <h3 class="cost-section-title">本次租金</h3>
  <slot name="rent" />
  <el-collapse
    ><el-collapse-item title="补充租赁信息（可选）" name="extra">
      <el-form-item label="出租方"
        ><el-input v-model="rental.landlordName" maxlength="200"
      /></el-form-item>
      <el-form-item label="合同号"
        ><el-input v-model="rental.contractNo" maxlength="100"
      /></el-form-item>
      <el-form-item label="租期开始"
        ><el-date-picker v-model="rental.leaseFrom" value-format="YYYY-MM-DD"
      /></el-form-item>
      <el-form-item label="租期截止"
        ><el-date-picker v-model="rental.leaseTo" value-format="YYYY-MM-DD"
      /></el-form-item>
      <el-form-item label="押金（元）"
        ><el-input-number v-model="rental.deposit" :min="0" :precision="2" /><span
          >押金单列，不计入租金</span
        ></el-form-item
      >
    </el-collapse-item></el-collapse
  >
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CostCommand } from '@/api/core/cost'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
const props = defineProps<{
  office: boolean
  warehouseSnapshot: string
  warehouses: (q: string, begin: number) => Promise<ReferenceOption[]>
}>()
const rental = defineModel<NonNullable<CostCommand['rental']>>({ required: true })
const needsClassification = ref(
  !rental.value.premisesType || rental.value.premisesType === 'UNKNOWN',
)
const office = computed(() =>
  needsClassification.value ? rental.value.premisesType === 'OFFICE' : props.office,
)
function chooseWarehouse(row: ReferenceOption | null) {
  if (row) {
    rental.value.premisesName = row.name
    rental.value.address = String(row.address || '')
  }
}
</script>
