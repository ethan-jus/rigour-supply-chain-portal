<template>
  <component :is="iconComponent" class="nav-icon" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Avatar, Box, Briefcase, Connection, DataAnalysis, Document,
  Goods, House, List, Location, OfficeBuilding, Setting, Shop,
  TrendCharts, UserFilled, Warning,
} from '@element-plus/icons-vue'

const props = defineProps<{ iconKey: string | null }>()
const iconComponent = computed(() => {
  const value = (props.iconKey || '').toLowerCase()
  if (value.includes('home') || value.includes('dashboard') || value.includes('odometer')) return House
  if (value.includes('erp') || value.includes('product') || value.includes('goods')) return Goods
  if (value.includes('inventory') || value.includes('stock') || value.includes('warehouse')) return Box
  if (value.includes('customer') || value.includes('crm') || value.includes('shop')) return Shop
  if (value.includes('sales') || value.includes('visit') || value.includes('location') || value.includes('map')) return Location
  if (value.includes('city') || value.includes('office') || value.includes('building') || value.includes('tenant')) return OfficeBuilding
  if (value.includes('chart') || value.includes('bi') || value.includes('report')) return TrendCharts
  if (value.includes('data')) return DataAnalysis
  if (value.includes('hr') || value.includes('user')) return UserFilled
  if (value.includes('channel') || value.includes('avatar')) return Avatar
  if (value.includes('connection') || value.includes('integration') || value.includes('share')) return Connection
  if (value.includes('setting') || value.includes('setup') || value.includes('filter') || value.includes('role')) return Setting
  if (value.includes('warning')) return Warning
  if (value.includes('task') || value.includes('flag')) return Briefcase
  if (value.includes('order') || value.includes('list')) return List
  if (value.includes('menu') || value.includes('resource') || value.includes('document')) return Document
  return Document
})
</script>

<style scoped>
.nav-icon { width: 18px; height: 18px; flex: 0 0 auto; }
</style>
