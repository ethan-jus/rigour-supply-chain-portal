import { createApp, h, ref } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import PaymentRiskBoard from '@/views/supply-chain/bi/components/PaymentRiskBoard.vue'
import type { PaymentRiskData, PaymentRiskLevel } from '@/api/core/payment-risk'

// 独立设计验证入口；不在正式路由/API中注入样例数据。
const categories = ['台呢', '球台', '球杆', '配件'].map((name, index) => ({
  id: String(index + 1),
  name,
  parentId: null,
}))
const matrix = [
  [52000, 70000, 86000, 64000, 48000],
  [45000, 58000, 62000, 56000, 39000],
  [38000, 46000, 52000, 51000, 33000],
  [32000, 41000, 48000, 46000, 33000],
  [26000, 32000, 39000, 38000, 25000],
  [20000, 26000, 29000, 28000, 23000],
]
const classify = (age: number, cloth: boolean): PaymentRiskLevel => {
  const step = cloth ? 10 : 30
  return age <= step ? 'LOW' : age <= step * 2 ? 'MEDIUM' : age <= step * 3 ? 'HIGH' : 'SEVERE'
}
const fixture: PaymentRiskData = {
  generatedAt: '2026-10-20T02:00:00Z',
  dataUpdatedAt: '2026-10-20T01:55:00Z',
  categories,
  orders: matrix.flatMap((row, city) =>
    row.flatMap((amount, month) =>
      Array.from({ length: 6 }, (_, index) => {
        const id = String(city * 1000 + month * 10 + index + 1)
        const orderDate = `2026-${String(month + 6).padStart(2, '0')}-${String(index * 3 + 1).padStart(2, '0')}`
        const age = Math.round(
          (Date.parse('2026-10-20T00:00:00+08:00') - Date.parse(`${orderDate}T00:00:00+08:00`)) /
            86400000,
        )
        const category = categories[(city + month + index) % 4]!
        const other = categories[(city + month + index + 1) % 4]!
        return {
          orderId: id,
          orderNo: `DEMO-${id}`,
          customerName: `演示门店${id}`,
          regionCode: `CITY${city}`,
          regionName: ['成都', '深圳', '重庆', '武汉', '东莞', '西安'][city]!,
          ownerStaffCode: `S${index % 4}`,
          ownerStaffName: `业务员${'ABCD'[index % 4]}`,
          orderDate,
          ageDays: age,
          orderAmount: index === 5 ? amount - Math.floor(amount / 6) * 5 : Math.floor(amount / 6),
          paidAmount: index % 2 ? Math.floor(amount / 12) : 0,
          products: (index % 3 ? [category] : [category, other]).map((c) => ({
            categoryId: c.id,
            categoryName: c.name,
            productId: `${c.id}-${index % 2}`,
            productName: `${c.name} · 示例型号${(index % 2) + 1}`,
            riskLevel: classify(age, c.name === '台呢'),
            productAmount: c.id === category.id ? Math.floor(amount / 9) : Math.floor(amount / 18),
          })),
        }
      }),
    ),
  ),
}
createApp({
  setup() {
    const range = ref<[string, string]>(['2026-06', '2026-10'])
    const data = ref(fixture)
    return () =>
      h(PaymentRiskBoard, {
        data: data.value,
        initialRange: range.value,
        demo: true,
        onLoad: (value: [string, string]) => {
          range.value = value
          data.value = {
            ...fixture,
            orders: fixture.orders.filter(
              (o) => o.orderDate.slice(0, 7) >= value[0] && o.orderDate.slice(0, 7) <= value[1],
            ),
          }
        },
      })
  },
})
  .use(ElementPlus)
  .mount('#app')
