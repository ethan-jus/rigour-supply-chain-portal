<template>
  <svg class="nav-icon" width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path v-if="variant === 'home'" d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path v-if="variant === 'home'" d="M9 21v-7h6v7" />
    <path v-else-if="variant === 'order'" d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />
    <path v-else-if="variant === 'product'" d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />
    <path v-else-if="variant === 'inventory'" d="M4 7h16v13H4zM4 7l2-4h12l2 4M9 11h6" />
    <path v-else-if="variant === 'customer'" d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 1 0 0-6M16 14.5h2a4 4 0 0 1 4 4V20" />
    <path v-else-if="variant === 'visit'" d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle v-if="variant === 'visit'" cx="12" cy="9" r="2.2" />
    <path v-else-if="variant === 'chart'" d="M4 19V5M4 19h17M8 16v-4M12 16V8M16 16v-6M20 16v-9" />
    <path v-else-if="variant === 'users'" d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 11a3 3 0 1 0 0-6M16 14.5h2a4 4 0 0 1 4 4V20" />
    <path v-else-if="variant === 'role'" d="M12 3 20 6v5c0 5-3.5 8.2-8 10-4.5-1.8-8-5-8-10V6zM9 12l2 2 4-4" />
    <path v-else-if="variant === 'menu'" d="M4 6h16M4 12h16M4 18h16M8 6v.01M8 12v.01M8 18v.01" />
    <path v-else-if="variant === 'tenant'" d="M4 21V5l8-3 8 3v16M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4" />
    <path v-else d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ iconKey: string | null }>()
const variant = computed(() => {
  const value = (props.iconKey || '').toLowerCase()
  if (value.includes('home') || value.includes('dashboard') || value.includes('odometer')) return 'home'
  if (value.includes('order') || value.includes('list')) return 'order'
  if (value.includes('product') || value.includes('goods') || value.includes('box') || value.includes('grid')) return 'product'
  if (value.includes('inventory') || value.includes('stock')) return 'inventory'
  if (value.includes('customer') || value.includes('crm') || value.includes('shop')) return 'customer'
  if (value.includes('visit') || value.includes('location') || value.includes('map')) return 'visit'
  if (value.includes('chart') || value.includes('bi') || value.includes('report') || value.includes('data')) return 'chart'
  if (value.includes('user') || value.includes('avatar')) return 'users'
  if (value.includes('role') || value.includes('permission') || value.includes('key')) return 'role'
  if (value.includes('menu') || value.includes('resource') || value.includes('document')) return 'menu'
  if (value.includes('tenant') || value.includes('organization') || value.includes('office') || value.includes('building')) return 'tenant'
  if (value.includes('setting') || value.includes('setup') || value.includes('filter')) return 'role'
  if (value.includes('share') || value.includes('connection')) return 'customer'
  return 'default'
})
</script>

<style scoped>
.nav-icon { flex: 0 0 auto; opacity: .9; }
</style>
