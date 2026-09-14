import { createApp, h } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import CityProductReport from '@/views/supply-chain/bi/components/CityProductReport.vue'

// Browser tests intercept every API request; this fixture is not a production route.
createApp({
  render: () =>
    h(CityProductReport, {
      modelValue: true,
      query: { from: '2026-07-01', to: '2026-09-12', productCategoryId: '1' },
      productCategories: [],
      filterOptions: {
        region: [
          { label: '测试城市甲', value: 'A' },
          { label: '测试城市乙', value: 'B' },
        ],
        owner: [],
        customerType: [],
        source: [],
      },
    }),
})
  .use(ElementPlus)
  .mount('#app')
