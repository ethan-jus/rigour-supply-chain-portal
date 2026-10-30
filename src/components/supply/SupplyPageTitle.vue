<template>
  <component :is="tag" class="supply-page-title" :style="{ fontSize: 'var(--app-font-size-heading)' }"
    ><template v-if="configuredName">{{ configuredName }}</template
    ><slot v-else
  /></component>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import { supplyPageName } from '@/utils/supply-page-title'
withDefaults(defineProps<{ tag?: 'h1' | 'h2' }>(), { tag: 'h1' })
const route = inject(routeLocationKey, null)
const navigation = route ? useNavigationStore() : null
const configuredName = computed(() =>
  route?.meta.applicationCode === 'SUPPLY_CHAIN' && navigation
    ? supplyPageName(navigation.getNavigation('SUPPLY_CHAIN'), route.path)
    : undefined,
)
</script>

<style scoped>
.supply-page-title { font-size: var(--app-font-size-heading); color: var(--app-text-primary); font-weight: 600; line-height: 1.5; }
</style>
