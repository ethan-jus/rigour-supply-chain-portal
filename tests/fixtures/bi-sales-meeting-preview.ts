import { createApp, h, ref } from 'vue'
import BiSalesMeetingBoard from '@/views/supply-chain/bi/components/BiSalesMeetingBoard.vue'
import type { SalesPeriod } from '@/views/supply-chain/bi/sales-meeting-model'
import { salesDashboardFixture } from './bi-sales-dashboard-data'
createApp({
  setup() {
    const period = ref<SalesPeriod>({ from: '2026-08-01', to: '2026-08-31' }),
      selected = ref(''),
      dayMode = ref(false),
      annualMode = ref(false),
      region = ref('')
    const snapshot = salesDashboardFixture()
    return () =>
      h(BiSalesMeetingBoard, {
        snapshot,
        embedded: true,
        annualMode: annualMode.value,
        detail: selected.value ? snapshot : null,
        selectedCode: selected.value,
        period: period.value,
        dayMode: dayMode.value,
        maxDate: '2026-09-24',
        scopeLabel: '设计验证 · 模拟数据',
        regionCode: region.value,
        cities: [
          { code: 'HZ', name: '杭州市' },
          { code: 'SH', name: '上海市' },
        ],
        onSelect: (code: string) => (selected.value = code),
        onCity: (code: string) => (region.value = code),
        onPeriod: (p: SalesPeriod, annual = false) => {
          annualMode.value = annual
          period.value = p
          dayMode.value = false
        },
        onDay: (d: string) => {
          period.value = { from: d, to: d }
          dayMode.value = true
        },
      })
  },
}).mount('#app')
