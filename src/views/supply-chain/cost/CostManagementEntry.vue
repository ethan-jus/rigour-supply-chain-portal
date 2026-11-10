<template>
  <LogisticsTransportRecordsView v-if="logistics" />
  <CostLedgerManagementView v-else-if="lean" />
  <CostManagementView v-else />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LogisticsTransportRecordsView from './LogisticsTransportRecordsView.vue'
import CostLedgerManagementView from './CostLedgerManagementView.vue'
import CostManagementView from './CostManagementView.vue'
const route = useRoute()
const logistics = computed(() => route.path.endsWith('/cost/logistics'))
const lean = computed(() =>
  ['/cost/logistics', '/cost/warehouse-rentals'].some((p) => route.path.endsWith(p)),
)
</script>
