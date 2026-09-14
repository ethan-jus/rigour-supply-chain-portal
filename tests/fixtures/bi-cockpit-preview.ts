import { createApp, computed, h, ref } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import CockpitFigure from '@/views/supply-chain/bi/components/CockpitFigure.vue'
import CityProductReport from '@/views/supply-chain/bi/components/CityProductReport.vue'
import { buildCockpit, type CockpitSection } from '@/views/supply-chain/bi/cockpit-model'
import { cockpitLayout } from '@/views/supply-chain/bi/cockpit-layout'
import type { SupplyDashboardOverview, SupplyDashboardOperatingAnalysis } from '@/api/core/bi'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'

seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [{ code: 'BOX', name: '箱' }])

const data = {
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-12T23:59:59Z',
  generatedAt: '2026-09-12T12:00:00Z',
  metrics: [
    ['sales_amount', 123456],
    ['paid_amount', 65432],
    ['unpaid_amount', 58024],
  ].map(([metricCode, value]) => ({ metricCode, value })),
  citySalesRanking: [],
  salesRanking: Array.from({ length: 108 }, (_, i) => ({
    dimensionCode: `S${i}`,
    dimensionName: `测试销售${i + 1}`,
    regionCode: i % 2 ? 'BJ' : 'SH',
    regionName: i % 2 ? '北京' : '上海',
    salesAmount: 10248 - i * 90,
    paidAmount: 7000 - i * 60,
    unpaidAmount: 3248 - i * 30,
    orderCount: 12,
    customerCount: 10,
  })),
  salesTrend: [1, 2, 3, 4, 5, 6].map((month) => ({
    period: `2026-0${month}-01`,
    value: month * 1000 + 20000,
    secondaryValue: month * 850,
  })),
  salesMonthlyPerformance: [],
  categorySalesRanking: [],
} as unknown as SupplyDashboardOverview
data.citySalesRanking = ['北京', '上海', '成都', '杭州', '武汉', '深圳'].map(
  (dimensionName, i) => ({
    rankType: 'CITY',
    dimensionCode: String(i),
    dimensionName,
    regionCode: String(i),
    regionName: dimensionName,
    salesAmount: 40000 - i * 5000,
    paidAmount: 14000 + i * 500,
    unpaidAmount: 26000 - i * 5500,
    orderCount: 40 - i * 4,
    customerCount: 25 - i * 2,
    rate: ((14000 + i * 500) / (40000 - i * 5000)) * 100,
  }),
)
data.productSalesRanking = [
  '金汤肥牛味粉面菜蛋',
  '油泼辣子干拌面',
  '葱油鸡肉菌菇拌面',
  '酸麻叉烧味粉面菜蛋',
  '天然饮用水550ml',
  '天然饮用水1.5L',
  '澳洋华彩A300',
  '澳洋华彩A500',
].map((dimensionName, i) => ({
  rankType: 'PRODUCT',
  dimensionCode: String(i + 1),
  dimensionName,
  categoryCode: i < 4 ? '1' : i < 6 ? '2' : '3',
  categoryName: i < 4 ? '方便面' : i < 6 ? '饮用水' : '台呢',
  salesQuantity: 100,
  salesAmount: 24000 - i * 2100,
  discountAmount: 0,
  refundAmount: 0,
  salesNetAmount: 24000 - i * 2100,
  estimatedCostAmount: 0,
  estimatedGrossProfit: 0,
  estimatedGrossProfitRate: 0,
  costCoverageRate: 0,
  orderCount: 30,
  customerCount: 20,
}))
data.skuSalesRanking = data.productSalesRanking.map((row, i) => ({
  ...row,
  rankType: 'SKU',
  dimensionName: `${row.dimensionName}/规格${i + 1}`,
  estimatedCostAmount: i < 6 ? row.salesAmount * 0.6 : 0,
  costCoverageRate: i < 6 ? 100 : 0,
}))
data.categorySalesRanking = ['方便面', '饮用水', '台呢'].map((dimensionName, i) => ({
  ...data.productSalesRanking[i],
  rankType: 'CATEGORY',
  dimensionCode: String(i + 1),
  dimensionName,
  categoryCode: String(i + 1),
  categoryName: dimensionName,
  salesAmount: data.productSalesRanking
    .filter((row) => row.categoryCode === String(i + 1))
    .reduce((sum, row) => sum + row.salesAmount, 0),
}))
data.salesMonthlyPerformance = [4, 5, 6, 7, 8, 9].flatMap((month) =>
  data.salesRanking.slice(0, 6).map((row, i) => ({
    ...row,
    period: `2026-${String(month).padStart(2, '0')}`,
    ownerStaffCode: row.dimensionCode,
    ownerStaffName: row.dimensionName,
    salesAmount: 1000 + (month % (i + 2)) * 2000 + month * (i + 1) * 150,
  })),
)
data.salesTargetCompletions = data.salesRanking.slice(0, 12).flatMap((row, i) =>
  ['SALES_AMOUNT', 'PAID_AMOUNT', 'CONTACTED_CUSTOMER', 'COOPERATED_CUSTOMER'].map(
    (metricCode, j) => ({
      dimensionType: 'SALES',
      dimensionCode: row.dimensionCode,
      dimensionName: row.dimensionName,
      metricCode,
      metricName: metricCode,
      targetValue: j < 2 ? 10000 : 25,
      actualValue: j < 2 ? 5000 + i * 600 + j * 800 : 15 + i,
      achievementRate: 0,
      configuredMonthCount: i === 1 ? 1 : 2,
      periodMonthCount: 2,
    }),
  ),
)
data.cityTargetCompletions = data.salesTargetCompletions.slice(0, 24).map((row, i) => ({
  ...row,
  dimensionType: 'CITY',
  dimensionCode: String(Math.floor(i / 4)),
  dimensionName: data.citySalesRanking[Math.floor(i / 4)].dimensionName,
}))
data.inventoryItemSummary = ['方便面', '饮用水', '台球周边'].map((categoryName, i) => ({
  categoryCode: String(i),
  categoryName,
  unitCode: 'BOX',
  procurementQuantity: 200 + i * 20,
  shippedQuantity: 150 - i * 30,
  remainingQuantity: 50 + i * 50,
  inactiveRemainingQuantity: i * 8,
}))
data.inventoryReplenishment = Array.from({ length: 12 }, (_, i) => ({
  categoryCode: 'noodle',
  categoryName: '方便面',
  productCode: `P${i}`,
  productName: `${i % 2 ? '油泼辣子干拌面' : '金汤肥牛粉面菜蛋'}规格${i + 1}`,
  unitCode: 'BOX',
  salesQuantity: 30,
  dailySalesQuantity: i === 0 ? 0 : 3,
  availableQuantity: 6 + i * 5,
  inTransitQuantity: 10,
  coverageDays: 2 + i,
  suggestedProcurementQuantity: Math.max(0, 30 - i * 3),
})) as SupplyDashboardOverview['inventoryReplenishment']
data.risks = Array.from({ length: 9 }, (_, i) => ({
  riskType: i % 2 ? 'LOW_STOCK' : 'STAGNANT_STOCK',
  riskLevel: ['HIGH', 'MEDIUM', 'LOW'][i % 3],
  dimensionCode: `P${i}`,
  dimensionName: `测试商品${i + 1}`,
  description: '固定测试风险',
  observedAt: data.to,
})) as SupplyDashboardOverview['risks']
const extra: SupplyDashboardOperatingAnalysis = {
  from: data.from,
  to: data.to,
  generatedAt: data.generatedAt,
  previousFrom: '2026-08-20T00:00:00Z',
  previousTo: '2026-08-31T23:59:59Z',
  previousSalesRanking: data.salesRanking.map((row, i) => ({
    ...row,
    salesAmount: row.salesAmount * (i % 2 ? 0.65 : 1.3),
    paidAmount: row.paidAmount * (i % 2 ? 1.3 : 0.6),
  })),
  salesReceipts: [],
  cityCustomers: [
    { regionCode: 'BJ', regionName: '北京', orderingCustomerCount: 32, repeatCustomerCount: 14 },
    { regionCode: 'SH', regionName: '上海', orderingCustomerCount: 20, repeatCustomerCount: 15 },
  ],
  cityProducts: ['北京', '上海', '成都', '杭州'].flatMap((regionName, y) =>
    ['方便面', '水类', '台呢', '台球周边', '鹰眼系统'].map((categoryName, x) => ({
      regionCode: String(y),
      regionName,
      categoryCode: String(x + 1),
      categoryName,
      salesAmount: (x + 1) * (y + 1) * 2345.67,
      orderCount: 10,
      customerCount: 8,
    })),
  ),
}
createApp({
  setup() {
    const reportVisible = ref(false)
    const section = ref<CockpitSection>('overview')
    const analysis = ref('')
    const model = computed(() =>
      buildCockpit(data, section.value, {
        productDimension: 'PRODUCT',
        period: 'month',
        inventoryUnit: 'BOX',
        costGroup: '全部',
        ...(section.value === 'city-operating' ? { regionCode: 'BJ', regionName: '北京' } : {}),
        analysis: extra,
      }),
    )
    const layout = computed(() => cockpitLayout(section.value, model.value.figures))
    return () =>
      h('main', [
        h('header', [
          h('strong', '图表渲染回归测试 · 固定测试数据，非业务页面'),
          h(
            'button',
            {
              onClick: () => {
                reportVisible.value = true
              },
            },
            '报表渲染测试',
          ),
          h(
            'select',
            {
              'aria-label': '测试专题',
              value: section.value,
              onChange: (event: Event) => {
                section.value = (event.target as HTMLSelectElement).value as CockpitSection
                analysis.value = ''
              },
            },
            [
              'overview',
              'sales',
              'sales-collection',
              'city-operating',
              'city-cost',
              'customer',
              'product-sales',
              'gross-profit',
              'payment-risk',
              'product-inventory',
              'inventory-risk',
              'activity',
            ].map((key) => h('option', { value: key }, key)),
          ),
        ]),
        h(
          'section',
          { class: 'canvas' },
          layout.value.primary.map((figure) =>
            h(CockpitFigure, { key: `${section.value}-${figure.id}`, figure }),
          ),
        ),
        h(
          'nav',
          layout.value.groups.map((group) =>
            h(
              'button',
              {
                type: 'button',
                onClick: () => {
                  analysis.value = group.id
                },
                'aria-pressed': (analysis.value || layout.value.groups[0]?.id) === group.id,
              },
              group.label,
            ),
          ),
        ),
        h(
          'section',
          { class: 'canvas' },
          (
            layout.value.groups.find(
              (group) => group.id === (analysis.value || layout.value.groups[0]?.id),
            )?.figures || []
          ).map((figure) => h(CockpitFigure, { key: figure.id, figure })),
        ),
        h(CityProductReport, {
          modelValue: reportVisible.value,
          'onUpdate:modelValue': (value: boolean) => {
            reportVisible.value = value
          },
          query: { from: data.from, to: data.to, productCategoryId: '1' },
          productCategories: [],
        }),
      ])
  },
})
  .use(ElementPlus)
  .mount('#app')
const style = document.createElement('style')
style.textContent =
  'body{margin:0;background:#f5f7fa;color:#1e293b;font-family:Arial,sans-serif}header{display:flex;gap:20px;padding:16px;flex-wrap:wrap}main{max-width:1440px;margin:auto;padding:16px}.canvas{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}@media(max-width:760px){main{padding:4px}.canvas{display:block}}'
document.head.append(style)
