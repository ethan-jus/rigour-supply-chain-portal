<template>
  <div
    ref="root"
    class="meeting-board"
    :class="{ 'is-embedded': embedded }"
    tabindex="-1"
    :aria-label="embedded ? '经营总览看板' : '供应链数字化平台会议大屏'"
    @keydown="onKey"
  >
    <header class="meeting-header">
      <div class="meeting-brand">
        <strong>供应链数字化平台</strong><span>{{ meetingPages[page] }}</span>
      </div>
      <div class="meeting-context">
        <label class="meeting-month"
          ><span class="sr-only">看板月份</span
          ><input
            type="month"
            :value="month"
            :max="maxMonth"
            aria-label="看板月份"
            :disabled="loading"
            @change="changeMonth"
        /></label>
        <span>{{ scopeLabel }}</span>
        <button
          class="icon-button"
          aria-label="刷新经营数据"
          title="刷新经营数据"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <Refresh />
        </button>
        <button class="icon-button" aria-label="切换全屏" title="切换全屏" @click="fullscreen">
          <FullScreen />
        </button>
        <button
          class="icon-button"
          v-if="!embedded"
          aria-label="退出会议大屏"
          title="退出会议大屏"
          @click="emit('close')"
        >
          <Close />
        </button>
      </div>
      <div class="meeting-dates">
        <span
          >{{ rangeLabel }}<template v-if="snapshot">　|　对比 {{ previousLabel }}</template></span
        ><span v-if="demo" class="demo-badge">设计演示 · 非真实经营数据</span
        ><span v-else>{{ snapshotLabel }}</span>
      </div>
    </header>

    <div v-if="error || !snapshot" class="meeting-load" role="status">
      <h2>{{ loading ? '正在读取经营数据' : '经营数据暂不可用' }}</h2>
      <p>{{ error || '等待当前期间与比较期间的数据。' }}</p>
      <button v-if="!loading" class="meeting-primary" @click="emit('refresh')">重新读取</button>
    </div>
    <div
      v-else
      ref="stage"
      class="meeting-stage"
      aria-label="向下滚动查看五页经营看板"
      @scroll.passive="onScroll"
    >
      <section class="meeting-page overview-page" aria-label="经营总览">
        <div class="meeting-kpis">
          <button
            v-for="(item, i) in kpis"
            :key="item.code"
            class="meeting-kpi"
            :class="`tone-${i}`"
            @click="go(item.page)"
          >
            <span class="kpi-name">{{ item.label }}</span>
            <span class="kpi-number"
              >{{ item.unit === '万元' ? money(item.value) : count(item.value)
              }}<small>{{ item.unit }}</small></span
            >
            <span class="kpi-change">较上月同期　{{ changeLabel(item.value, item.previous) }}</span>
            <span v-if="i === 0" class="kpi-target">{{
              targets[0].target == null
                ? '订单目标未设置'
                : `已设目标范围达成 ${percentage(targets[0].rate)}`
            }}</span>
          </button>
        </div>
        <div class="overview-charts">
          <article class="meeting-panel">
            <h2>本期订单金额趋势</h2>
            <EchartsChart v-if="sales != null" :option="salesChart" height="100%" />
            <p v-else class="meeting-empty">订单数据未就绪</p>
          </article>
          <article class="meeting-panel contribution">
            <div class="panel-heading">
              <h2>城市增长贡献</h2>
              <span>万元</span>
            </div>
            <p class="panel-subtitle">较上月同期 · 增减额前六项</p>
            <EchartsChart
              v-if="snapshot.previous && contributions.length"
              :option="contributionChart"
              height="100%"
              @chart-click="inspectChart($event, contributions, '城市增长贡献')"
            />
            <p v-else class="meeting-empty">
              {{ snapshot.comparisonError || '暂无可比较的城市数据' }}
            </p>
          </article>
        </div>
        <div class="meeting-attention">
          <h2>本月重点关注</h2>
          <button @click="go(2)">
            <WarningFilled /><span
              >{{ declining ? `${declining.name}订单金额下降` : '城市经营变化'
              }}<strong>{{
                declining ? `${money(declining.amount)} 万元` : '查看城市对比'
              }}</strong></span
            >
          </button>
          <button @click="go(4)">
            <WarningFilled /><span
              >本期订单未回款<strong>{{ money(unpaid) }} 万元</strong></span
            >
          </button>
          <button class="attention-neutral" @click="go(3)">
            <InfoFilled /><span
              >复购率 {{ percentage(retention.rate)
              }}<strong
                >成交 {{ count(retention.customers) }} / 复购
                {{ count(repeatCustomers) }} 家</strong
              ></span
            >
          </button>
        </div>
      </section>

      <section class="meeting-page target-page" aria-label="目标达成">
        <div class="page-intro">
          <div>
            <span class="eyebrow">MONTHLY TARGETS</span>
            <h2>目标完成多少，还差多少？</h2>
          </div>
          <p>月目标不按天折算；仅汇总已正式设置目标的{{ targets[0].level }}。</p>
        </div>
        <div class="target-columns">
          <article
            v-for="(target, i) in targets"
            :key="i"
            class="target-panel"
            :class="{ cyan: i === 1 }"
          >
            <h3>{{ i === 0 ? '订单目标完成率' : '本期到账目标完成率' }}</h3>
            <p class="target-definition">
              {{
                i === 0
                  ? '目标月份订单金额 / 对应订单目标'
                  : '按到账日期的本月回款 / 月本期到账目标'
              }}
            </p>
            <div class="target-number">
              {{ target.target == null ? '未设置' : percentage(target.rate) }}
            </div>
            <progress
              :value="target.rate ?? 0"
              max="100"
              :aria-label="i === 0 ? '订单目标进度' : '本期到账目标进度'"
            />
            <dl class="target-values">
              <div>
                <dt>已完成</dt>
                <dd>{{ money(target.actual) }}<small>万元</small></dd>
              </div>
              <div>
                <dt>正式目标</dt>
                <dd>{{ money(target.target) }}<small>万元</small></dd>
              </div>
              <div>
                <dt>{{ (target.rate ?? 0) > 100 ? '超额完成' : '目标缺口' }}</dt>
                <dd>
                  {{
                    money(
                      target.target == null || target.actual == null
                        ? null
                        : Math.abs(target.target - target.actual),
                    )
                  }}<small>万元</small>
                </dd>
              </div>
            </dl>
            <p class="target-coverage">
              {{
                target.count
                  ? `已设置 ${target.count} 个${target.level}目标${target.incomplete ? ' · 部分月份缺失或覆盖待核对' : ''}`
                  : '暂无正式目标，完成率和缺口不计算。'
              }}
            </p>
            <button class="meeting-link" @click="showTargets(i)">
              查看目标明细 <ArrowRight />
            </button>
          </article>
        </div>
        <div class="meeting-callout">
          <InfoFilled /><span
            >本期到账目标包含历史订单本期到账；未配置时不借用订单累计回款目标。</span
          >
        </div>
      </section>

      <section class="meeting-page cities-page" aria-label="城市经营">
        <button class="meeting-link" @click="emit('city')">进入城市经营看板 <ArrowRight /></button>
        <div class="page-intro">
          <div>
            <span class="eyebrow">CITY PERFORMANCE</span>
            <h2>找到增长城市，也看见经营缺口</h2>
          </div>
          <p>按本期订单金额排序 · 点击城市查看核对数据</p>
        </div>
        <div class="cities-content">
          <article class="meeting-panel">
            <h3>城市订单金额 <small>万元</small></h3>
            <EchartsChart
              v-if="cities.length"
              :option="cityChart"
              height="100%"
              @chart-click="inspectChart($event, cityPageRows, '城市经营')"
            />
            <p v-else class="meeting-empty">暂无城市订单记录</p>
          </article>
          <article class="city-scorecard">
            <table>
              <caption class="sr-only">
                城市经营比较
              </caption>
              <thead>
                <tr>
                  <th>城市</th>
                  <th>较上月同期</th>
                  <th>成交客户</th>
                  <th>订单回款率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in cityPageRows" :key="row.code">
                  <th>
                    <button @click="inspectRows([row], '城市经营')">{{ row.name }}</button>
                  </th>
                  <td :class="{ negative: (row.amount ?? 0) < (row.previous ?? 0) }">
                    {{ changeLabel(row.amount, row.previous ?? null) }}
                  </td>
                  <td>{{ count(row.customers) }}</td>
                  <td>{{ percentage(rate(row.paid ?? null, row.amount)) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="!cities.length" class="meeting-empty">暂无城市数据</p>
            <div class="table-pager">
              <button :disabled="cityPage === 0" aria-label="上一组城市" @click="cityPage--">
                <ArrowLeft /></button
              ><span
                >{{ cities.length ? cityPage + 1 : 0 }} /
                {{ Math.ceil(cities.length / 8) }} 组</span
              ><button
                :disabled="(cityPage + 1) * 8 >= cities.length"
                aria-label="下一组城市"
                @click="cityPage++"
              >
                <ArrowRight />
              </button>
            </div>
          </article>
        </div>
        <div class="meeting-callout">
          <InfoFilled /><span
            >城市成交客户数不可相加代替全国去重客户数；缺少前期数据时不生成增长率。</span
          >
        </div>
      </section>

      <section class="meeting-page customers-page" aria-label="客户与商品">
        <div class="customer-summary">
          <div>
            <span>成交客户</span><strong>{{ count(customers) }}<small>家</small></strong>
          </div>
          <div>
            <span>本月复购率</span><strong>{{ percentage(retention.rate) }}</strong
            ><small>本月下单且月初前已有有效订单</small>
          </div>
          <div>
            <span>客单价</span><strong>{{ averageOrder }}<small>元 / 单</small></strong>
          </div>
        </div>
        <div class="customer-charts">
          <article class="meeting-panel">
            <div class="panel-heading">
              <h2>商品贡献</h2>
              <button class="meeting-link" @click="productMode = !productMode">
                {{ productMode ? '切换品类' : '切换商品' }}
              </button>
            </div>
            <p class="panel-subtitle">
              {{ productMode ? '商品' : '品类' }}订货行金额 · 未扣整单优惠 · 万元
            </p>
            <EchartsChart
              v-if="products.length"
              :option="productChart"
              height="100%"
              @chart-click="inspectChart($event, products, '商品贡献')"
            />
            <p v-else class="meeting-empty">商品关联或明细数据未就绪</p>
          </article>
          <article class="meeting-panel">
            <h2>客户订单贡献</h2>
            <p class="panel-subtitle">当前返回的重点客户 · 万元</p>
            <EchartsChart
              v-if="customerRows.length"
              :option="customerChart"
              height="100%"
              @chart-click="inspectChart($event, customerRows, '客户贡献')"
            />
            <p v-else class="meeting-empty">当前范围暂无可用客户贡献明细</p>
          </article>
        </div>
        <div class="meeting-callout">
          <InfoFilled /><span
            >商品图按订单行金额展示，不能与扣除整单优惠后的订单金额直接核平；{{
              embedded ? '可通过商品销售统计菜单核对明细。' : '点击“核对业务明细”查看商品报表。'
            }}</span
          >
        </div>
      </section>

      <section class="meeting-page receipts-page" aria-label="回款风险">
        <div class="receipt-summary">
          <div>
            <span>本期到账</span
            ><strong class="cyan-text">{{ money(receipts) }}<small>万元</small></strong
            ><small>按回款发生日期，含历史订单到账</small>
          </div>
          <div>
            <span>本期回款</span><strong>{{ money(paid) }}<small>万元</small></strong
            ><small>按订单日期选取，累计至当前快照</small>
          </div>
          <div>
            <span>本期订单未回款</span
            ><strong class="amber-text">{{ money(unpaid) }}<small>万元</small></strong
            ><small>同一批有效订单的未收金额</small>
          </div>
        </div>
        <div class="receipt-charts">
          <article class="meeting-panel">
            <h2>本期到账趋势</h2>
            <EchartsChart v-if="receipts != null" :option="receiptChart" height="100%" />
            <p v-else class="meeting-empty">期间到账数据未就绪或当前权限不支持</p>
          </article>
          <article class="meeting-panel">
            <h2>本期订单未回款分布</h2>
            <p class="panel-subtitle">按城市 · 万元</p>
            <EchartsChart
              v-if="unpaidCities.length"
              :option="unpaidChart"
              height="100%"
              @chart-click="inspectChart($event, unpaidCities, '本期订单未回款')"
            />
            <p v-else class="meeting-empty">当前期间暂无城市未回款明细</p>
          </article>
        </div>
        <div class="meeting-callout">
          <InfoFilled /><span
            >这里展示本期订单未回款，不是全部历史欠款；历史欠款暂未纳入此屏。缺少确认账期时不标记为逾期。</span
          >
        </div>
      </section>
    </div>

    <nav v-if="snapshot" class="meeting-dots" aria-label="看板页码">
      <button
        v-for="(name, i) in meetingPages"
        :key="name"
        :class="{ active: page === i }"
        :aria-label="`第${i + 1}页 ${name}`"
        :aria-current="page === i ? 'page' : undefined"
        :title="name"
        @click="go(i)"
      />
    </nav>
    <footer class="meeting-footer">
      <div class="meeting-freshness" role="status">
        <span>{{ loading ? '正在更新，保留上一批快照…' : freshnessLabel }}</span
        ><button v-if="snapshot" class="meeting-link" @click="showSources">查看数据口径</button>
      </div>
      <div class="meeting-navigation">
        <nav aria-label="看板专题">
          <button
            v-for="(name, i) in meetingPages"
            :key="name"
            :class="{ active: page === i }"
            :aria-current="page === i ? 'page' : undefined"
            @click="i === 2 ? emit('city') : go(i)"
          >
            {{ name }}
          </button>
        </nav>
        <div class="meeting-actions">
          <button
            v-if="!embedded"
            class="meeting-link"
            :disabled="!snapshot"
            @click="emit('open-report', page)"
          >
            核对业务明细</button
          ><button
            class="meeting-primary"
            :disabled="!snapshot"
            @click="go(page === 4 ? 0 : page + 1)"
          >
            {{ page === 4 ? '返回经营总览' : `下滑查看${meetingPages[page + 1]}`
            }}<ArrowDown v-if="page < 4" /><ArrowUp v-else />
          </button>
        </div>
      </div>
    </footer>

    <div
      v-if="detail"
      class="meeting-modal-backdrop"
      @click.self="detail = null"
      @keydown.stop="detailKey"
    >
      <section
        ref="detailPanel"
        class="meeting-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="detail.title"
        tabindex="-1"
      >
        <header>
          <h2>{{ detail.title }}</h2>
          <button class="icon-button" aria-label="关闭核对明细" @click="closeDetail">
            <Close />
          </button>
        </header>
        <p>{{ detail.note }}</p>
        <div class="meeting-detail-scroll">
          <table>
            <thead>
              <tr>
                <th v-for="column in detail.columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in detail.rows" :key="i">
                <td v-for="(value, j) in row" :key="j">{{ value }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!detail.rows.length">暂无可用记录；未设置或未接入不代表真实为零。</p>
        </div>
      </section>
    </div>
    <p v-if="fullscreenError" class="meeting-toast" role="status">{{ fullscreenError }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Refresh,
  FullScreen,
  Close,
  InfoFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import EchartsChart from './EchartsChart.vue'
import { customerRetention } from '../city-meeting-model'
import { businessDate, businessDateTime } from '@/utils/business-date'
import {
  meetingPages,
  meetingMetric,
  money,
  count,
  percentage,
  rate,
  changeLabel,
  cityRows,
  meetingTarget,
  meetingLine,
  meetingBars,
  finite,
  type MeetingSnapshot,
  type MeetingRow,
} from '../meeting-model'

const props = withDefaults(
  defineProps<{
    snapshot: MeetingSnapshot | null
    month: string
    maxMonth: string
    scopeLabel: string
    loading?: boolean
    error?: string
    embedded?: boolean
    initialPage?: number
    demo?: boolean
  }>(),
  { loading: false, error: '', demo: false },
)
const emit = defineEmits<{
  city: [code?: string]
  close: []
  refresh: []
  month: [value: string]
  'open-report': [page: number]
}>()
const root = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const detailPanel = ref<HTMLElement>()
const page = ref(props.initialPage || 0)
const cityPage = ref(0)
const productMode = ref(true)
const fullscreenError = ref('')
const detail = ref<{ title: string; note: string; columns: string[]; rows: string[][] } | null>(
  null,
)
let previousFocus: HTMLElement | null = null
const data = computed(() => props.snapshot?.current)
const metric = (code: string) => meetingMetric(data.value, code)
const sales = computed(() => metric('sales_amount'))
const paid = computed(() => metric('paid_amount'))
const unpaid = computed(() => metric('unpaid_amount'))
const receipts = computed(() => metric('receipt_amount'))
const customers = computed(() => metric('cooperated_customer_count'))
const retention = computed(() => customerRetention(props.snapshot))
const repeatCustomers = computed(() => retention.value.returning)
const averageOrder = computed(() =>
  sales.value == null || !metric('order_count')
    ? '—'
    : (sales.value / metric('order_count')!).toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
)
const rangeLabel = computed(() =>
  data.value ? `${businessDate(data.value.from)} — ${businessDate(data.value.to)}` : props.month,
)
const previousLabel = computed(() =>
  props.snapshot
    ? `${businessDate(props.snapshot.previousQuery.from!)} — ${businessDate(props.snapshot.previousQuery.to!)}`
    : '',
)
const snapshotLabel = computed(() =>
  data.value ? `查询快照 ${businessDateTime(data.value.generatedAt).slice(5, 16)}` : '',
)
const freshnessLabel = computed(() => {
  if (props.demo) return '演示数据仅用于布局与交互验证。'
  if (!props.snapshot) return '尚未读取数据。'
  const trust = props.snapshot.trust
  return trust
    ? `${trust.overallDescription} · 快照更新时间不代表来源已完整同步。`
    : '来源完整性尚未核验 · 查询成功不代表同步完整。'
})
const kpis = computed(() =>
  [
    { code: 'sales_amount', label: '本期订单金额', unit: '万元', page: 1 },
    { code: 'receipt_amount', label: '本期到账', unit: '万元', page: 4 },
    { code: 'cooperated_customer_count', label: '成交客户', unit: '家', page: 3 },
    { code: 'order_count', label: '订单数', unit: '单', page: 2 },
  ].map((row) => ({
    ...row,
    value: metric(row.code),
    previous: meetingMetric(props.snapshot?.previous, row.code),
  })),
)
const targets = computed(() =>
  (['SALES_AMOUNT', 'RECEIPT_AMOUNT'] as const).map((code) =>
    meetingTarget(data.value!, code, props.snapshot?.query.ownerStaffCode),
  ),
)
const cities = computed(() =>
  data.value ? cityRows(data.value, props.snapshot?.previous || null) : [],
)
const contributions = computed(() =>
  cities.value
    .map((row) => ({
      ...row,
      amount: row.amount == null || row.previous == null ? null : row.amount - row.previous,
    }))
    .sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0))
    .slice(0, 6),
)
const declining = computed(
  () =>
    [...contributions.value]
      .filter((row) => (row.amount ?? 0) < 0)
      .sort((a, b) => a.amount! - b.amount!)[0],
)
const cityPageRows = computed(() =>
  cities.value.slice(cityPage.value * 8, (cityPage.value + 1) * 8),
)
const products = computed<MeetingRow[]>(
  () =>
    (productMode.value ? data.value?.productSalesRanking : data.value?.categorySalesRanking)
      ?.slice(0, 6)
      .map((row) => ({
        code: row.dimensionCode,
        name: row.dimensionName,
        amount: finite(row.salesAmount),
        orders: finite(row.orderCount),
        customers: finite(row.customerCount),
      })) || [],
)
const customerRows = computed<MeetingRow[]>(() =>
  [...(data.value?.customerActivityRanking || [])]
    .sort((a, b) => b.salesAmount - a.salesAmount)
    .slice(0, 6)
    .map((row) => ({
      code: row.customerCode,
      name: row.customerName,
      amount: finite(row.salesAmount),
      paid: finite(row.paidAmount),
      unpaid: finite(row.unpaidAmount),
      orders: finite(row.orderCount),
    })),
)
const unpaidCities = computed(() =>
  cities.value
    .map((row) => ({ ...row, amount: row.unpaid ?? null }))
    .filter((row) => (row.amount ?? 0) > 0)
    .sort((a, b) => b.amount! - a.amount!)
    .slice(0, 6),
)
const salesChart = computed(() =>
  data.value ? meetingLine(data.value, props.snapshot?.previous || null) : {},
)
const receiptChart = computed(() =>
  data.value ? meetingLine(data.value, props.snapshot?.previous || null, true) : {},
)
const contributionChart = computed(() => meetingBars(contributions.value, true))
const cityChart = computed(() => meetingBars(cityPageRows.value))
const productChart = computed(() => meetingBars(products.value))
const customerChart = computed(() => meetingBars(customerRows.value, false, '#46d9eb'))
const unpaidChart = computed(() => meetingBars(unpaidCities.value, false, '#ffbe50'))

function go(index: number, instant = false) {
  page.value = Math.max(0, Math.min(4, index))
  const child = stage.value?.children[page.value] as HTMLElement | undefined
  if (child && stage.value)
    stage.value.scrollTo({
      top: child.offsetTop - (stage.value.children[0] as HTMLElement).offsetTop,
      behavior:
        instant || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
    })
}
function onScroll() {
  if (!stage.value) return
  const start = (stage.value.children[0] as HTMLElement)?.offsetTop || 0
  const offsets = [...stage.value.children].map((item) =>
    Math.abs((item as HTMLElement).offsetTop - start - stage.value!.scrollTop),
  )
  page.value = offsets.indexOf(Math.min(...offsets))
}
function onKey(event: KeyboardEvent) {
  if (detail.value || (event.target as HTMLElement).closest('input, select, textarea')) return
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  const index = ['ArrowDown', 'PageDown'].includes(event.key)
    ? page.value + 1
    : ['ArrowUp', 'PageUp'].includes(event.key)
      ? page.value - 1
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 4
          : null
  if (index != null) {
    event.preventDefault()
    go(index)
  }
}
function changeMonth(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) emit('month', value)
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await root.value?.requestFullscreen()
  } catch {
    fullscreenError.value = '浏览器未开启全屏，可继续使用当前会议视图。'
  }
}
function inspectRows(rows: MeetingRow[], title: string) {
  detail.value = {
    title,
    note: `${rangeLabel.value} · ${props.scopeLabel} · 金额单位：万元`,
    columns: ['对象', '本页金额', '累计回款', '未回款', '订单数', '成交客户'],
    rows: rows.map((row) => [
      row.name,
      money(row.amount),
      money(row.paid),
      money(row.unpaid),
      count(row.orders),
      count(row.customers),
    ]),
  }
}
function inspectChart(event: unknown, rows: MeetingRow[], title: string) {
  const index = (event as { dataIndex?: number }).dataIndex
  if (index != null && rows[index]) inspectRows([rows[index]], title)
}
function showTargets(index: number) {
  const target = targets.value[index]
  detail.value = {
    title: index === 0 ? '订单目标明细' : '本期到账目标明细',
    note: `${rangeLabel.value} · 仅已配置目标范围；本期到账按实际到账日期统计。`,
    columns: [target.level, '实际（万元）', '目标（万元）', '完成率', '月份覆盖'],
    rows: target.rows.map((row) => [
      row.dimensionName,
      money(finite(row.actualValue)),
      row.targetValue > 0 ? money(row.targetValue) : '未设置',
      percentage(rate(finite(row.actualValue), finite(row.targetValue))),
      row.configuredMonthCount != null && row.periodMonthCount != null
        ? `${row.configuredMonthCount}/${row.periodMonthCount}`
        : '待核对',
    ]),
  }
}
function showSources() {
  detail.value = {
    title: '数据口径与来源',
    note: '会议固定前端加载批次；多个查询并非跨服务原子快照。本期到账按收款日期，累计回款按所选订单归属。',
    columns: ['来源', '最近更新', '状态', '说明'],
    rows: (data.value?.freshness || []).map((row) => [
      row.sourceName,
      row.latestUpdatedTime ? businessDateTime(row.latestUpdatedTime) : '未知',
      row.status,
      row.description || '—',
    ]),
  }
}
function closeDetail() {
  detail.value = null
  void nextTick(() => previousFocus?.focus())
}
function detailKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDetail()
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    detailPanel.value?.querySelector<HTMLButtonElement>('button')?.focus()
  }
}
watch(detail, (value) => {
  if (value) {
    previousFocus = document.activeElement as HTMLElement
    void nextTick(() => detailPanel.value?.focus())
  }
})
watch(
  () => props.snapshot,
  () => {
    cityPage.value = 0
    void nextTick(() => go(page.value))
  },
)
onMounted(() => root.value?.focus())
onBeforeUnmount(() => {
  if (document.fullscreenElement === root.value)
    void document.exitFullscreen().catch(() => undefined)
})
onActivated(() => {
  void nextTick(() => go(page.value, true))
})
</script>

<style src="../meeting-board.scss" lang="scss" scoped />
