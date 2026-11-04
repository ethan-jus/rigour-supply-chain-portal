<template>
  <CostLedgerManagementView v-if="lean" />
  <CostManagementView v-else />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CostLedgerManagementView from './CostLedgerManagementView.vue'
import CostManagementView from './CostManagementView.vue'
const route = useRoute()
const lean = computed(() =>
  ['/cost/logistics', '/cost/warehouse-rentals'].some((p) => route.path.endsWith(p)),
)
</script>
