<template>
  <main
    ref="root"
    class="bi-overview"
    :class="{ 'is-city-overview': cityContext }"
    :aria-busy="loading"
    @scroll.passive="onScroll"
  >
    <header class="overview-header">
      <div class="overview-heading">
        <strong>供应链数字化平台</strong>
        <h1>{{ cityContext ? '城市经营' : '经营总览' }}</h1>
      </div>
      <div class="overview-filters">
        <span>{{ scopeLabel }}</span>
        <label
          >年份
          <select aria-label="统计年份" :value="year" @change="selectYear">
            <option v-for="value in years" :key="value" :value="value">{{ value }}年</option>
          </select></label
        >
        <label
          >月份
          <select aria-label="统计月份" :value="selectedMonth ?? ''" @change="selectMonth">
            <option value="">全年</option>
            <option
              v-for="value in 12"
              :key="value"
              :value="value"
              :disabled="year === thisYear && value > thisMonth"
            >
              {{ value }}月
            </option>
          </select></label
        >
        <button class="outline" :class="{ active: annual }" @click="emit('period', year, null)">
          全年
        </button>
        <button
          class="icon-button"
          aria-label="刷新经营数据"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <Refresh />
        </button>
        <button
          v-if="cityContext"
          class="icon-button"
          aria-label="全屏城市看板"
          @click="toggleFullscreen"
        >
          <FullScreen />
        </button>
      </div>
      <p class="overview-period">
        {{ periodLabel }}
        <span v-if="snapshot">· 对比 {{ previousLabel }} · 数据范围截至 {{ cutoff }}</span>
      </p>
    </header>
    <nav class="overview-anchors" :aria-label="cityContext ? '城市经营章节' : '经营总览章节'">
      <button
        v-for="(section, index) in sections"
        :key="section.id"
        :class="{ active: activeSection === index }"
        @click="go(index)"
      >
        {{ section.label }}
      </button>
    </nav>
    <div v-if="cityContext" class="city-context">
      <label
        >当前城市
        <select
          aria-label="选择城市"
          :value="cityContext.code"
          :disabled="!cityContext.options.length"
          @change="emit('city', ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!cityContext.options.length" value="">暂无可查看城市</option>
          <option v-for="city in cityContext.options" :key="city.code" :value="city.code">
            {{ city.name }}
          </option>
        </select>
      </label>
      <h2>{{ cityContext.name || '城市经营' }}</h2>
    </div>
    <div v-if="loading" class="overview-state" role="status">正在读取经营数据…</div>
    <div v-else-if="error" class="overview-state is-error" role="alert">
      {{ error }} <button @click="emit('refresh')">重新读取</button>
    </div>
    <template v-else-if="snapshot">
      <p
        v-if="snapshot.analysisError || snapshot.comparisonError"
        class="overview-notice"
        role="status"
      >
        {{ snapshot.analysisError || snapshot.comparisonError }}；缺失指标显示为 —。
      </p>
      <section id="overview-summary" class="overview-kpis" aria-label="经营指标">
        <article v-for="(kpi, index) in kpis" :key="kpi.code">
          <h2>{{ kpi.label }}</h2>
          <p :class="['kpi-value', { blue: index === 0, cyan: index === 1 }]">
            {{ index < 2 ? money(kpi.value) : count(kpi.value)
            }}<small>{{ index < 2 ? amountUnit : index === 2 ? '家' : '单' }}</small>
          </p>
          <div v-if="index === 2" class="repeat-inline">
            复购客户 <b>{{ count(repeat) }}</b> 家
            <span
              >复购率 <b>{{ percentage(repeatRate) }}</b></span
            >
          </div>
          <p class="kpi-comparison">
            {{ comparisonLabel }} <b>{{ changeLabel(kpi.value, kpi.previous) }}</b>
          </p>
          <p v-if="index === 1" class="metric-note">按到账日期，包含历史订单本期到账</p>
        </article>
      </section>
      <section id="overview-trend" class="overview-trend-goals" aria-label="趋势与目标">
        <article class="overview-trend">
          <div class="section-title">
            <h2>{{ receiptMode ? '本期到账趋势' : '交易额趋势' }}</h2>
            <div class="segmented" aria-label="趋势指标">
              <button :class="{ active: !receiptMode }" @click="receiptMode = false">交易额</button
              ><button :class="{ active: receiptMode }" @click="receiptMode = true">
                本期到账
              </button>
            </div>
          </div>
          <div class="trend-summary">
            本期合计
            <strong :class="receiptMode ? 'cyan' : 'blue'"
              >{{ money(metric(receiptMode ? 'receipt_amount' : 'sales_amount'))
              }}<small>{{ amountUnit }}</small></strong
            >
          </div>
          <div class="trend-chart-scroll"><EchartsChart :option="chart" :height="360" /></div>
          <p v-if="partial" class="trend-notes">进行中 · 截至 {{ cutoff }}，按相同截止日期对比</p>
        </article>
        <aside class="overview-goals" aria-label="目标达成">
          <h2>{{ annual ? '年度' : '本月' }}目标达成</h2>
          <p class="section-description">
            {{
              goals
                ? cityContext
                  ? `${cityContext.name} · ${annual ? '12个月累计' : '城市目标'}`
                  : `覆盖 ${goals.cityCount} 个城市 · ${annual ? '12个月累计' : '按城市汇总'}`
                : '目标覆盖范围暂未就绪'
            }}
          </p>
          <div class="goal-grid">
            <article v-for="goal in goalCards" :key="goal.key" class="overview-goal">
              <h3 :title="goal.note">{{ goal.label }}</h3>
              <div
                role="img"
                :aria-label="`${goal.label}目标完成率 ${percentage(rate(goal.actual, goal.target))}`"
              >
                <EchartsChart :option="targetGauge(goal.actual, goal.target)" :height="114" />
              </div>
              <p class="goal-values">
                <strong :class="goal.key === 'receipt' ? 'cyan' : 'blue'">{{
                  goal.money ? money(goal.actual) : count(goal.actual)
                }}</strong>
                <span>{{ goal.money ? amountUnit : '家' }}</span>
              </p>
              <p class="goal-meta">
                <span
                  >目标 {{ goal.money ? money(goal.target) : count(goal.target)
                  }}{{ goal.money ? shortAmountUnit : '家' }}</span
                >
                <span v-if="goal.actual != null && goal.target != null">
                  {{ goal.actual >= goal.target ? '超额' : '差额' }}
                  {{
                    goal.money
                      ? money(Math.abs(goal.actual - goal.target))
                      : count(Math.abs(goal.actual - goal.target))
                  }}{{ goal.money ? shortAmountUnit : '家' }}
                </span>
                <span v-else>数据暂未就绪</span>
              </p>
            </article>
          </div>
          <p class="goal-explanation">
            单城月默认：交易、到账各{{
              cityContext ? '100,000元' : '10万元'
            }}；新增200家、复购100家。年度目标逐月累计，客户数按期间去重。
          </p>
        </aside>
      </section>
      <section
        id="overview-cities"
        class="overview-cities"
        :aria-label="cityContext ? '销售业绩对比' : '城市经营对比'"
      >
        <slot name="comparison">
          <div class="section-title">
            <h2>城市经营对比</h2>
            <button class="text-button" @click="emit('city')">
              进入城市经营看板 <ArrowRight />
            </button>
          </div>
          <div class="ranking-toolbar">
            <div class="segmented">
              <button :class="{ active: !cityReceipt }" @click="changeCityMetric(false)">
                本期交易额排名</button
              ><button :class="{ active: cityReceipt }" @click="changeCityMetric(true)">
                本期到账排名
              </button>
            </div>
          </div>
          <div class="overview-table-scroll">
            <table :class="{ 'with-cohort': !cityReceipt }">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>城市</th>
                  <th>本期{{ cityReceipt ? '到账' : '交易额' }}<small>（万元）</small></th>
                  <th v-if="!cityReceipt">本期回款额<small>（万元）</small></th>
                  <th v-if="!cityReceipt">本期回款率</th>
                  <th>{{ annual ? '上年同期' : '上月同期' }}<small>（万元）</small></th>
                  <th>增减额<small>（万元）</small></th>
                  <th>{{ annual ? '年度' : '月' }}目标<small>（万元）</small></th>
                  <th>目标完成率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(city, index) in pageCities" :key="city.code">
                  <td>
                    <span
                      :class="['rank', ['gold', 'silver', 'bronze'][cityPage * 8 + index]]"
                      :aria-label="`第${cityPage * 8 + index + 1}名${['，金牌', '，银牌', '，铜牌'][cityPage * 8 + index] || ''}`"
                    >
                      <span v-if="cityPage * 8 + index < 3" class="rank-medal" aria-hidden="true">{{
                        ['🥇', '🥈', '🥉'][cityPage * 8 + index]
                      }}</span>
                      <span v-else>{{ cityPage * 8 + index + 1 }}</span>
                    </span>
                  </td>
                  <th>
                    <button
                      class="city-link"
                      :disabled="['UNKNOWN', 'MULTI', ''].includes(city.code.trim().toUpperCase())"
                      @click="emit('city', city.code)"
                    >
                      {{ city.name }}
                    </button>
                  </th>
                  <td :class="['amount-cell', { cyan: cityReceipt }]">{{ money(city.amount) }}</td>
                  <td v-if="!cityReceipt" class="cohort-amount">{{ money(city.paid) }}</td>
                  <td v-if="!cityReceipt">{{ percentage(rate(city.paid, city.amount)) }}</td>
                  <td>{{ money(city.previous) }}</td>
                  <td
                    :class="{
                      negative:
                        city.previous != null && city.amount != null && city.amount < city.previous,
                    }"
                  >
                    {{
                      city.previous == null || city.amount == null
                        ? '—'
                        : `${city.amount - city.previous > 0 ? '+' : ''}${money(city.amount - city.previous)}`
                    }}
                  </td>
                  <td>{{ money(city.target) }}</td>
                  <td>
                    <div class="city-completion">
                      <b>{{ percentage(rate(city.amount, city.target)) }}</b>
                      <div
                        class="completion-track"
                        role="progressbar"
                        :aria-label="`${city.name}${cityReceipt ? '本期到账' : '交易额'}目标完成进度`"
                        :aria-valuenow="
                          rate(city.amount, city.target) == null
                            ? undefined
                            : Math.min(100, Math.max(0, rate(city.amount, city.target)!))
                        "
                        :aria-valuetext="percentage(rate(city.amount, city.target))"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <i
                          :style="{
                            width: `${Math.max(0, Math.min(100, rate(city.amount, city.target) ?? 0))}%`,
                            background: completionGradient(rate(city.amount, city.target)).css,
                          }"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!cityRows.length" class="empty-data">当前范围暂无城市数据</p>
          </div>
          <div class="ranking-footer">
            <div>
              <span>本期回款及回款率按本期订单统计；本期到账按到账日期统计，包含历史订单。</span>
              <p v-if="nonCitySummary" class="section-description">
                未纳入城市榜：{{ nonCitySummary }}；仍计入全国总额。
              </p>
            </div>
            <div class="table-pager">
              <span>共 {{ cityCount }} 个城市</span>
              <template v-if="cityRows.length > 8">
                <button aria-label="上一页城市" :disabled="cityPage === 0" @click="cityPage--">
                  <ArrowLeft /></button
                ><span>{{ cityPage + 1 }} / {{ Math.ceil(cityRows.length / 8) }}</span
                ><button
                  aria-label="下一页城市"
                  :disabled="(cityPage + 1) * 8 >= cityRows.length"
                  @click="cityPage++"
                >
                  <ArrowRight />
                </button>
              </template>
            </div>
          </div>
        </slot>
      </section>
      <section id="overview-customers" class="overview-customers-products" aria-label="客户与商品">
        <article>
          <h2>客户分析</h2>
          <div class="customer-metrics">
            <div>
              <strong>{{ count(customers) }}</strong
              ><span>成交客户（家）</span>
            </div>
            <div>
              <strong>{{ count(repeat) }}</strong
              ><span>复购客户（家）</span>
            </div>
            <div>
              <strong>{{ percentage(repeatRate) }}</strong
              ><span>复购率</span>
            </div>
            <div>
              <strong>{{ count(newCustomers) }}</strong
              ><span>新增合作客户（家）</span>
            </div>
          </div>
          <p class="section-description">
            新增合作：本期首次有效下单。{{
              annual
                ? '年度复购为各月复购客户的全年去重人数。'
                : '复购：本月下单且月初前已有有效订单。'
            }}
          </p>
        </article>
        <article>
          <div class="section-title">
            <h2>商品贡献</h2>
            <div class="segmented small">
              <button :class="{ active: !categoryMode }" @click="categoryMode = false">商品</button
              ><button :class="{ active: categoryMode }" @click="categoryMode = true">品类</button>
            </div>
          </div>
          <table class="product-table">
            <thead>
              <tr>
                <th>{{ categoryMode ? '品类' : '商品名称' }}</th>
                <th>订货行金额（{{ amountUnit }}）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in products" :key="product.dimensionCode">
                <td>{{ product.dimensionName }}</td>
                <td>{{ money(product.salesAmount) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!products.length" class="empty-data">暂无商品数据</p>
          <p class="section-description">未扣整单优惠；显示金额前6项，不能与折后交易额直接核平。</p>
        </article>
      </section>
      <section id="overview-receipts" class="overview-receipts" aria-label="回款分析">
        <h2>回款分析</h2>
        <div class="receipt-metrics">
          <article class="receipt-rate">
            <h3>本期回款率</h3>
            <div
              role="img"
              :aria-label="`本期回款率 ${percentage(rate(metric('paid_amount'), metric('sales_amount')))}`"
            >
              <EchartsChart :option="collectionDonut(snapshot.current)" :height="210" />
            </div>
            <div class="collection-basis">
              <p>
                <span>本期订单额</span
                ><b
                  >{{ money(metric('sales_amount')) }}<small>{{ amountUnit }}</small></b
                >
              </p>
              <p>
                <span>本期回款额</span
                ><b
                  :style="{
                    color: completionGradient(rate(metric('paid_amount'), metric('sales_amount')))
                      .end,
                  }"
                  >{{ money(metric('paid_amount')) }}<small>{{ amountUnit }}</small></b
                >
              </p>
            </div>
            <p class="collection-note">含这些订单在后续月份收到的款</p>
          </article>
          <article>
            <h3>本期到账</h3>
            <strong class="cyan"
              >{{ money(metric('receipt_amount')) }}<small>{{ amountUnit }}</small></strong
            >
            <p>按到账日期统计，不论订单在哪个月成交。</p>
          </article>
          <article>
            <h3>本期回款</h3>
            <strong
              >{{ money(metric('paid_amount')) }}<small>{{ amountUnit }}</small></strong
            >
            <p>筛选本期订单，累计到账截至查询快照，包含后续月份回款。</p>
          </article>
          <article>
            <h3>本期订单未回款</h3>
            <strong
              >{{ money(metric('unpaid_amount')) }}<small>{{ amountUnit }}</small></strong
            >
            <p>同批订单截至查询快照的未收款，不等于全部历史欠款。</p>
          </article>
        </div>
      </section>
      <footer class="overview-footer">
        <span
          >{{ snapshot.trust?.overallDescription || '数据来源状态未就绪' }} · 查询时间
          {{ businessDateTime(snapshot.current.generatedAt) }}</span
        ><button class="text-button" @click="showDefinitions = true">
          查看统计口径 <ArrowRight />
        </button>
      </footer>
    </template>
    <el-dialog
      v-model="showDefinitions"
      :title="cityContext ? '城市经营统计口径' : '经营总览统计口径'"
      width="min(680px, 92vw)"
      append-to-body
      ><div class="overview-definitions">
        <p>
          本期回款指所选期间订单的累计回款，包含后续月份收到的款；回款和到账均包含待财务确认及已确认金额；本期回款率 = 本期回款 ÷
          本期交易额。交易额按有效订单日期统计折后订单金额；本期到账按实际到账日期统计，包含任意历史月份订单在所选期间到账的金额。
        </p>
        <p>
          只选年份：按全年范围查询，趋势按月；选月份：1–7日、8–14日、15–21日、22日至月底。正在发生的期间按当前截止日对齐比较，未来时间留空。
        </p>
        <p>
          新增合作客户在期间内首次有效下单；复购客户在本月下单且月初前已有有效订单。年度复购为各月符合复购条件的客户全年去重。
        </p>
        <p>
          城市名单来自部门管理中销售部下的启用城市部门，包含零成交城市。交易额及本期到账均归属订单销售所在的城市部门；已冻结订单优先使用冻结部门，历史未冻结订单使用该销售当前部门。非城市部门及缺失销售归属单独列示，不计入城市榜，但保留在全国总额中。目标按授权城市汇总，年度累计12个月；历史年度使用当前开通城市名单。
        </p>
        <p v-if="cityContext">
          销售交易额及本期回款按订单销售汇总；本期到账按逐笔回款人员汇总，均限定所选城市。个人月目标优先采用已配置值；未配置时交易额默认40,000元、到账默认20,000元，年度按12个月累计。
        </p>
        <p>
          城市成交客户不能直接相加替代全国去重客户。查询成功不代表来源已完整同步，缺失数据保持未知。
        </p>
      </div></el-dialog
    >
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, FullScreen, Refresh } from '@element-plus/icons-vue'
import { businessDate, businessDateTime } from '@/utils/business-date'
import {
  changeLabel,
  count,
  finite,
  meetingMetric,
  money as moneyWan,
  moneyYuan,
  percentage,
  rate,
  type MeetingSnapshot,
} from '../meeting-model'
import {
  aggregateGoals,
  collectionDonut,
  completionGradient,
  overviewLine,
  overviewPeriods,
  targetGauge,
} from '../overview-model'
import EchartsChart from './EchartsChart.vue'

const props = defineProps<{
  snapshot: MeetingSnapshot | null
  year: number
  selectedMonth: number | null
  scopeLabel: string
  loading: boolean
  error: string
  initialPage?: number
  cityContext?: { code: string; name: string; options: { code: string; name: string }[] }
}>()
const emit = defineEmits<{
  period: [year: number, month: number | null]
  refresh: []
  city: [code?: string]
}>()
const amountUnit = computed(() => (props.cityContext ? '元' : '万元'))
const shortAmountUnit = computed(() => (props.cityContext ? '元' : '万'))
const money = (value: number | null | undefined) =>
  props.cityContext ? moneyYuan(value) : moneyWan(value)
const root = ref<HTMLElement | null>(null)
const today = businessDate(new Date()),
  thisYear = Number(today.slice(0, 4)),
  thisMonth = Number(today.slice(5, 7))
const years = Array.from({ length: thisYear - 1999 }, (_, i) => thisYear - i)
const annual = computed(() => props.selectedMonth == null)
const receiptMode = ref(false),
  cityReceipt = ref(false),
  cityPage = ref(0),
  categoryMode = ref(false),
  showDefinitions = ref(false),
  activeSection = ref(0)
const sections = computed(() => [
  { id: 'overview-summary', label: '概览' },
  { id: 'overview-trend', label: '趋势与目标' },
  { id: 'overview-cities', label: props.cityContext ? '销售业绩' : '城市对比' },
  { id: 'overview-customers', label: '客户与商品' },
  { id: 'overview-receipts', label: '回款分析' },
])
const metric = (code: string) => meetingMetric(props.snapshot?.current, code)
const comparisonLabel = computed(() => (annual.value ? '较上年同期' : '较上月同期'))
const cutoff = computed(() => (props.snapshot ? businessDate(props.snapshot.current.to) : '—'))
const periodLabel = computed(() =>
  props.snapshot
    ? `${businessDate(props.snapshot.current.from)} — ${cutoff.value}`
    : `${props.year}年${props.selectedMonth ? `${props.selectedMonth}月` : '全年'}`,
)
const previousLabel = computed(() =>
  props.snapshot
    ? `${businessDate(props.snapshot.previousQuery.from!)} — ${businessDate(props.snapshot.previousQuery.to!)}`
    : '',
)
const partial = computed(() => {
  try {
    return overviewPeriods(props.year, props.selectedMonth).partial
  } catch {
    return false
  }
})
const analysisReady = computed(() => metric('sales_amount') != null)
const customers = computed(() =>
  analysisReady.value
    ? finite(props.snapshot?.analysis?.customerRetention?.orderingCustomerCount)
    : null,
)
const repeat = computed(() =>
  analysisReady.value
    ? finite(
        annual.value
          ? props.snapshot?.analysis?.customerRetention?.annualReturningCustomerCount
          : props.snapshot?.analysis?.customerRetention?.returningCustomerCount,
      )
    : null,
)
const newCustomers = computed(() =>
  analysisReady.value
    ? finite(props.snapshot?.analysis?.customerRetention?.newCustomerCount)
    : null,
)
const repeatRate = computed(() => rate(repeat.value, customers.value))
const kpis = computed(() =>
  [
    { code: 'sales_amount', label: '本期交易额' },
    { code: 'receipt_amount', label: '本期到账' },
    { code: 'cooperated_customer_count', label: '成交客户' },
    { code: 'order_count', label: '订单数' },
  ].map((row) => ({
    ...row,
    value: metric(row.code),
    previous: meetingMetric(props.snapshot?.previous, row.code),
  })),
)
const goals = computed(() => aggregateGoals(props.snapshot?.analysis, props.selectedMonth))
const goalCards = computed(() => [
  {
    key: 'sales',
    label: '交易额',
    money: true,
    actual: metric('sales_amount'),
    target: goals.value?.sales ?? null,
    note: annual.value
      ? '12个月城市目标合计'
      : props.cityContext
        ? '单城月默认100,000元'
        : '单城月默认10万元',
  },
  {
    key: 'receipt',
    label: '本期到账',
    money: true,
    actual: metric('receipt_amount'),
    target: goals.value?.receipt ?? null,
    note: '按到账日期统计',
  },
  {
    key: 'newCustomer',
    label: '新增合作客户',
    money: false,
    actual: newCustomers.value,
    target: goals.value?.newCustomer ?? null,
    note: '本期首次有效下单',
  },
  {
    key: 'repeatCustomer',
    label: '复购客户',
    money: false,
    actual: repeat.value,
    target: goals.value?.repeatCustomer ?? null,
    note: annual.value ? '全年去重复购客户' : '月初前已有有效订单',
  },
])
const chart = computed(() =>
  overviewLine(
    props.snapshot?.current || null,
    props.snapshot?.previous || null,
    annual.value,
    receiptMode.value,
    !!props.cityContext,
  ),
)
const allCityRows = computed(() => {
  const rows = new Map<
    string,
    {
      code: string
      name: string
      amount: number | null
      previous: number | null
      paid: number | null
      target: number | null
    }
  >()
  const current = props.snapshot?.current,
    previous = props.snapshot?.previous
  const ready = cityReceipt.value
    ? props.snapshot?.analysis?.cityReceipts != null && metric('receipt_amount') != null
    : metric('sales_amount') != null
  const comparisonReady = cityReceipt.value
    ? props.snapshot?.previousAnalysis?.cityReceipts != null &&
      meetingMetric(previous, 'receipt_amount') != null
    : meetingMetric(previous, 'sales_amount') != null
  const ensure = (code: string, name: string) => {
    if (!rows.has(code))
      rows.set(code, {
        code,
        name,
        amount: ready ? 0 : null,
        previous: comparisonReady ? 0 : null,
        paid: metric('paid_amount') != null ? 0 : null,
        target: null,
      })
    return rows.get(code)!
  }
  goals.value?.cities.forEach((city) => {
    ensure(city.code, city.name).target = cityReceipt.value ? city.receipt : city.sales
  })
  if (cityReceipt.value) {
    props.snapshot?.analysis?.cityReceipts?.forEach((row) => {
      ensure(row.regionCode, row.regionName || row.regionCode).amount = ready
        ? row.receiptAmount
        : null
    })
    props.snapshot?.previousAnalysis?.cityReceipts?.forEach((row) => {
      ensure(row.regionCode, row.regionName || row.regionCode).previous = comparisonReady
        ? row.receiptAmount
        : null
    })
  } else {
    current?.citySalesRanking?.forEach((row) => {
      const city = ensure(row.dimensionCode, row.dimensionName)
      city.amount = ready ? row.salesAmount : null
      city.paid = ready && metric('paid_amount') != null ? finite(row.paidAmount) : null
    })
    previous?.citySalesRanking?.forEach((row) => {
      ensure(row.dimensionCode, row.dimensionName).previous = comparisonReady
        ? row.salesAmount
        : null
    })
  }
  return [...rows.values()].sort(
    (a, b) => (b.amount ?? -Infinity) - (a.amount ?? -Infinity) || a.name.localeCompare(b.name),
  )
})
const cityRows = computed(() =>
  allCityRows.value.filter((city) => goals.value?.cities.has(city.code)),
)
const cityCount = computed(() => goals.value?.cityCount ?? 0)
const nonCitySummary = computed(() =>
  allCityRows.value
    .filter(
      (city) =>
        goals.value &&
        !goals.value.cities.has(city.code) &&
        city.amount != null &&
        city.amount !== 0,
    )
    .map((city) => `${city.name} ${money(city.amount)} 万元`)
    .join('；'),
)
const pageCities = computed(() => cityRows.value.slice(cityPage.value * 8, cityPage.value * 8 + 8))
const products = computed(
  () =>
    (categoryMode.value
      ? props.snapshot?.current.categorySalesRanking
      : props.snapshot?.current.productSalesRanking
    )?.slice(0, 6) || [],
)
function changeCityMetric(receipt: boolean) {
  cityReceipt.value = receipt
  cityPage.value = 0
}
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await root.value?.requestFullscreen?.()
}
function selectYear(event: Event) {
  const year = Number((event.target as HTMLSelectElement).value)
  emit(
    'period',
    year,
    year === thisYear && (props.selectedMonth || 0) > thisMonth ? null : props.selectedMonth,
  )
}
function selectMonth(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('period', props.year, value ? Number(value) : null)
}
function go(index: number) {
  activeSection.value = index
  const el = root.value?.querySelector<HTMLElement>(`#${sections.value[index]?.id}`)
  if (el && root.value)
    root.value.scrollTo({
      top: index === 0 ? 0 : Math.max(0, el.offsetTop - 56),
      behavior: 'smooth',
    })
}
function onScroll() {
  if (!root.value) return
  if (
    root.value.scrollTop > 0 &&
    root.value.scrollTop + root.value.clientHeight >= root.value.scrollHeight - 2
  ) {
    activeSection.value = sections.value.length - 1
    return
  }
  const top = root.value.scrollTop + 80
  let index = 0
  sections.value.forEach((section, position) => {
    const el = root.value?.querySelector<HTMLElement>(`#${section.id}`)
    if (el != null && el.offsetTop <= top) index = position
  })
  activeSection.value = Math.max(0, index)
}
let initialSectionApplied = false
watch(
  () => props.loading,
  async (loading) => {
    if (loading || !props.snapshot) return
    cityPage.value = 0
    await nextTick()
    if (!initialSectionApplied && props.initialPage) go(props.initialPage)
    initialSectionApplied = true
  },
  { immediate: true },
)
onActivated(() => {
  void nextTick(() => window.dispatchEvent(new Event('resize')))
})
</script>

<style lang="scss" src="../overview-board.scss" />
