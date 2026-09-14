<template>
  <SupplyModulePlaceholder :title="page.title" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SUPPLY_DOMAIN_PAGES } from './catalog'
import SupplyModulePlaceholder from '@/components/supply/SupplyModulePlaceholder.vue'

const route = useRoute()
const page = computed(() => {
  const routeKey = String(route.meta.routeKey || '')
  const definition = SUPPLY_DOMAIN_PAGES.find((item) => item.routeKey === routeKey)
  if (!definition) throw new Error(`未注册的供应链能力页面: ${routeKey}`)
  return definition
})
</script>
