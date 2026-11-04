<template>
  <div class="party-fields">
    <el-form-item :label="receiver ? '收货方类型' : '发货方类型'" required>
      <el-select v-model="party.partyTypeCode" @change="resetParty"
        ><el-option label="仓库" value="WAREHOUSE" /><el-option
          label="供应商"
          value="SUPPLIER" /><el-option label="客户" value="CUSTOMER" /><el-option
          label="其他"
          value="OTHER"
      /></el-select>
    </el-form-item>
    <el-form-item :label="receiver ? '收货城市' : '发货城市'" :required="receiver">
      <el-select v-model="party.cityCode" filterable @change="cityChanged"
        ><el-option v-for="c in cities" :key="c.code" :label="c.name" :value="c.code"
      /></el-select>
    </el-form-item>
    <el-form-item :label="receiver ? '收货方' : '发货方'" required>
      <el-input
        v-if="party.partyTypeCode === 'OTHER'"
        v-model="party.manualName"
        maxlength="200"
        placeholder="填写实际收发方名称"
      />
      <CostLedgerPartySelect
        v-else
        v-model="party.partyCode"
        :logistics="true"
        :kind="party.partyTypeCode"
        :city-code="party.cityCode"
        :name="party.displayName"
        @selected="selected"
      />
    </el-form-item>
    <el-form-item :label="receiver ? '收货人' : '发货联系人'" :required="receiver"
      ><el-input v-model="party.contactName" maxlength="100"
    /></el-form-item>
    <el-form-item label="联系方式" :required="receiver"
      ><el-input v-model="party.phone" maxlength="50"
    /></el-form-item>
    <el-form-item :label="receiver ? '收货地址' : '发货地址'" required class="address"
      ><el-input v-model="party.address" maxlength="500" placeholder="填写本次实际地址"
    /></el-form-item>
  </div>
</template>
<script setup lang="ts">
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import type { LedgerParty } from './cost-ledger'
import type { LedgerPartyReference } from '@/api/core/cost-ledger'
const party = defineModel<LedgerParty>({ required: true })
defineProps<{ receiver?: boolean; cities: { code: string; name: string }[] }>()
const emit = defineEmits<{ changed: [] }>()
function resetParty() {
  party.value.partyCode = null
  party.value.displayName = null
  party.value.manualName = null
  emit('changed')
}
function cityChanged() {
  if (party.value.partyTypeCode === 'CUSTOMER') {
    party.value.partyCode = null
    party.value.displayName = null
  }
  emit('changed')
}
function selected(row: LedgerPartyReference | null) {
  party.value.displayName = row?.name ?? null
  if (row) {
    if (row.cityCode) party.value.cityCode = row.cityCode
    if (row.address) party.value.address = row.address
    if (row.contactName) party.value.contactName = row.contactName
    if (row.phone) party.value.phone = row.phone
  }
  emit('changed')
}
</script>
<style scoped>
.party-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 22px;
}
.address {
  grid-column: 1/-1;
}
.el-select {
  width: 100%;
}
@media (max-width: 850px) {
  .party-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .party-fields {
    grid-template-columns: 1fr;
  }
}
</style>
