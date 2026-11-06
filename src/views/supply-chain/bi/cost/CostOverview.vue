<template>
  <section class="scope-cards" aria-label="成本分类汇总">
    <button
      v-for="card in cards"
      :key="card.scope"
      class="scope-card"
      :class="card.scope"
      @click="emit('scope', card.scope)"
    >
      <span class="scope-card-heading"
        ><span>{{ card.label }}</span
        ><span aria-hidden="true">↗</span></span
      >
      <strong>{{ money(card.amount) }}<small>元</small></strong>
      <span class="scope-card-comparison">
        <template v-if="card.comparable">
          <span>{{ comparisonLabel }}</span>
          <b :class="changeClass(card.delta)">{{ signed(card.delta) }}</b>
          <span>{{ card.growth == null ? '零基数' : `${card.growth}%` }}</span>
        </template>
        <span v-else class="muted">暂无可比期记录</span>
      </span>
      <span v-if="card.components.length" class="scope-components">
        <span v-for="item in card.components" :key="item.key"
          >{{ item.label }} <b>{{ money(item.current) }}</b></span
        >
      </span>
      <span v-else class="scope-description">{{ scopeDescriptions[card.scope] }}</span>
      <span class="scope-card-footer">
        <span>{{ card.count === undefined ? '已确认金额' : `${card.count} 笔已确认单据` }}</span>
        <span v-if="card.reviewCount" class="pending">{{ card.reviewCount }} 笔待核对</span>
        <span v-else>查看分析 →</span>
      </span>
    </button>
  </section>

  <section v-if="expenseCards.length" class="overview-expenses" aria-label="经营费用分项">
    <div class="panel-heading">
      <h2>经营费用分项</h2>
      <span class="muted">单位：元</span>
    </div>
    <div class="expense-cards">
      <button
        v-for="item in expenseCards"
        :key="item.key"
        class="expense-card"
        @click="emit('category', item.key)"
      >
        <span>{{ categories[item.key] }}<span aria-hidden="true"> →</span></span>
        <strong>{{ money(item.amount) }}</strong>
        <small>{{ item.count ? `${item.count} 笔已确认单据` : '暂无已确认单据' }}</small>
      </button>
    </div>
  </section>

  <section class="overview-operations" aria-label="经营费用核对">
    <button @click="emit('records', { payment: 'UNPAID', status: 'CONFIRMED' })">
      <span>未付款经营费用</span
      ><strong>{{ money(report.current.unpaid) }} <small>元</small></strong
      ><span class="text-link">查看明细 →</span>
    </button>
    <button :disabled="!hasUnassigned" @click="emit('records', { city: 'UNKNOWN' })">
      <span>待归属经营费用</span
      ><strong>{{ money(report.current.unassigned) }} <small>元</small></strong
      ><span class="text-link">归属核对 →</span>
    </button>
    <div class="overview-review">
      <span>待核对来源</span><strong>{{ reviewCount }} <small>笔</small></strong>
      <div class="review-scopes">
        <button
          v-for="card in cards.filter((c) => c.reviewCount)"
          :key="card.scope"
          class="text-button"
          @click="emit('scope', card.scope)"
        >
          {{ card.label }} {{ card.reviewCount }} 笔 →
        </button>
        <span v-if="!reviewCount" class="muted">当前范围无待核对来源</span>
      </div>
    </div>
  </section>

  <div class="chart-grid overview-charts">
    <section class="cost-panel">
      <div class="panel-heading">
        <div>
          <h2>{{ trend === 'months' ? '经营费用月度趋势' : '经营费用期间累计' }}</h2>
          <p class="muted">{{ trend === 'months' ? monthRange : periodRange }}</p>
        </div>
        <div class="segmented" aria-label="趋势口径">
          <button
            :class="{ active: trend === 'months' }"
            :aria-pressed="trend === 'months'"
            @click="trend = 'months'"
          >
            月度金额
          </button>
          <button
            :class="{ active: trend === 'period' }"
            :aria-pressed="trend === 'period'"
            @click="trend = 'period'"
          >
            期间累计
          </button>
        </div>
      </div>
      <EchartsChart
        :option="trend === 'months' ? monthlyTrend(report.months) : line(report)"
        :height="285"
        @chart-click="trendClick"
      />
      <div v-if="trend === 'period' && month !== 0" class="trend-monthly">
        <span>按月计入费用</span><strong>{{ money(report.monthlyAmount || '0.00') }} 元</strong
        ><span class="muted">薪酬、租赁等按所属月归集</span>
      </div>
    </section>
    <section class="cost-panel overview-structure">
      <div class="panel-heading">
        <h2>经营费用构成</h2>
        <span class="muted">金额 · 占比</span>
      </div>
      <CostRing
        :groups="report.categories"
        :total="report.current.amount"
        category
        @select="(key) => emit('analysis', { category: key as CostCategory })"
      />
    </section>
  </div>

  <div class="chart-grid overview-drivers">
    <section class="cost-panel">
      <div class="panel-heading">
        <h2>费用归属对比</h2>
        <button class="text-button" @click="emit('cities')">完整归属分析 →</button>
      </div>
      <CostComparisonBars
        :groups="report.cityGroups"
        :comparable="report.meta.comparisonAvailable"
        @select="(city) => emit('analysis', { city })"
      />
    </section>
    <section class="cost-panel overview-changes">
      <div class="panel-heading">
        <h2>重点费用变动</h2>
        <div class="segmented">
          <button :class="{ active: direction === 'increase' }" @click="direction = 'increase'">
            增加</button
          ><button :class="{ active: direction === 'decrease' }" @click="direction = 'decrease'">
            减少
          </button>
        </div>
      </div>
      <template v-if="report.meta.comparisonAvailable">
        <div class="change-reconcile">
          <span
            >增加 <b class="increase">+{{ money(report.increased) }}</b></span
          ><span
            >减少 <b class="decrease">−{{ money(report.decreased) }}</b></span
          ><span
            >净变动 <b>{{ signed(report.delta) }}</b></span
          >
        </div>
        <button
          v-for="item in changes"
          :key="`${item.city}:${item.category}`"
          class="overview-change-row"
          @click="emit('analysis', { city: item.city, category: item.category })"
        >
          <span
            ><b>{{ item.cityName }}</b
            ><small>{{ categories[item.category] }}</small></span
          ><strong :class="changeClass(item.delta)">{{ signed(item.delta) }}</strong
          ><small>贡献 {{ item.contribution }}%</small>
        </button>
        <p v-if="!changes.length" class="empty">没有该方向的费用变动</p>
      </template>
      <p v-else class="empty">可比期没有已确认记录，暂不计算费用变动。</p>
      <p v-if="coverageNotice" class="comparison-notice">{{ coverageNotice }}</p>
    </section>
  </div>

  <details v-if="available.includes('labor')" class="cost-panel overview-details payroll-costs">
    <summary>
      <span>人力薪酬构成</span
      ><span class="muted">{{
        payrollRecorded ? `${money(categoryAmount('labor'))} 元` : '暂无已确认薪酬'
      }}</span>
    </summary>
    <div v-if="payrollRecorded" class="salary-components">
      <div v-for="component in report.payrollComponents" :key="component.key">
        <span>{{ component.label }}</span
        ><strong>{{ money(component.amount) }} <small>元</small></strong
        ><span class="muted">{{
          component.missingCount
            ? `${component.missingCount} 笔缺少分项`
            : `${component.records} 笔工资单`
        }}</span>
      </div>
    </div>
    <p v-else class="empty">本期暂无已确认薪酬</p>
    <div class="panel-foot">
      <span class="muted">按工资所属月归集应发工资，激励包含在提成中</span
      ><button class="text-button" @click="emit('category', 'labor')">查看工资来源 →</button>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CostCategory, CostQuery, CostReport, CostScope } from '@/api/core/bi-cost-dashboard'
import EchartsChart from '../components/EchartsChart.vue'
import CostRing from './CostRing.vue'
import CostComparisonBars from './CostComparisonBars.vue'
import {
  categories,
  comparisonCoverageNotice,
  eventKey,
  line,
  money,
  monthlyTrend,
  overviewCards,
  payrollHasRecords,
  signed,
} from './cost-presentation'

const props = defineProps<{
  report: CostReport
  available: CostCategory[]
  comparisonLabel: string
  month?: number
}>()
const emit = defineEmits<{
  scope: [scope: CostScope]
  category: [category: CostCategory]
  records: [query: CostQuery]
  analysis: [query: CostQuery]
  month: [key: string]
  cities: []
}>()
const trend = ref<'months' | 'period'>('months'),
  direction = ref<'increase' | 'decrease'>('increase')
const cards = computed(() => overviewCards(props.report, props.available))
const expenseCards = computed(() => {
  const order: CostCategory[] = [
    'freight',
    'warehouse',
    'office',
    'marketing',
    'labor',
    'expense',
    'premises_unknown',
  ]
  return order
    .filter((key) => props.available.includes(key))
    .flatMap((key) => {
      const group = props.report.categories.find((item) => item.key === key)
      // 未分类场地费用有已确认记录时单独列出，避免漏掉经营费用的组成部分。
      if (key === 'premises_unknown' && !group?.count && Number(group?.current || 0) === 0)
        return []
      return [{ key, amount: group?.current ?? '0.00', count: group?.count ?? 0 }]
    })
})
const reviewCount = computed(() => cards.value.reduce((total, card) => total + card.reviewCount, 0))
const changes = computed(() =>
  props.report.changes.filter((c) => c.direction === direction.value).slice(0, 5),
)
const hasUnassigned = computed(() => props.report.cities.some((c) => c.key === 'UNKNOWN'))
const coverageNotice = computed(() => comparisonCoverageNotice(props.report))
const payrollRecorded = computed(() => payrollHasRecords(props.report))
const periodRange = computed(
  () => `${props.report.meta.period.from} — ${props.report.meta.period.to}`,
)
const monthRange = computed(() => {
  const months = props.report.months
  return months.length
    ? `${months[0]!.label} — ${months.at(-1)!.label} · 截至 ${months.at(-1)!.cutoff}`
    : '当前范围没有月度数据'
})
const scopeDescriptions = {
  opex: '物流、仓储、办公、营销、薪酬及报销',
  purchase: '折后采购货款 + 已确认实际运费',
  loss: '已确认商品损耗金额',
}
function categoryAmount(category: CostCategory) {
  if (category === 'purchase') return props.report.purchase
  if (category === 'loss') return props.report.loss
  return props.report.categories.find((c) => c.key === category)?.current ?? '0.00'
}
function changeClass(value: string | null) {
  return Number(value) > 0 ? 'increase' : Number(value) < 0 ? 'decrease' : ''
}
function trendClick(event: unknown) {
  if (trend.value !== 'months') return
  const key = eventKey(event)
  if (key) emit('month', key)
}
</script>
