<template>
  <div ref="root" class="sales-dashboard" :class="{ embedded }">
    <header class="sales-dashboard-header">
      <div>
        <h1>供应链数字化平台 <span>销售业绩</span></h1>
        <p>
          {{ period.from }} — {{ period.to }} · {{ comparison
          }}{{ dataCutoff ? ` · 数据截至 ${dataCutoff}` : '' }}
        </p>
      </div>
      <div class="sales-controls">
        <span>{{ scopeLabel }}</span>
        <select :value="year" aria-label="年份" @change="setYear(Number(value($event)))">
          <option v-for="y in years" :key="y" :value="y">{{ y }}年</option>
        </select>
        <select
          :value="month ?? ''"
          aria-label="月份"
          @change="setMonth(value($event) ? Number(value($event)) : null)"
        >
          <option value="">全年</option>
          <option
            v-for="m in 12"
            :key="m"
            :value="m"
            :disabled="year === Number(maxDate.slice(0, 4)) && m > Number(maxDate.slice(5, 7))"
          >
            {{ m }}月
          </option>
        </select>
        <button :class="{ active: annual && !dayMode }" @click="setMonth(null)">全年</button>
        <button :class="{ active: dayMode }" @click="emit('day', period.to)">按日</button>
        <input
          v-if="dayMode"
          type="date"
          :value="period.from"
          :max="maxDate"
          aria-label="统计日期"
          @change="emit('day', value($event))"
        />
        <button aria-label="刷新" :disabled="loading || detailLoading" @click="emit('refresh')">
          <Refresh />
        </button>
        <button aria-label="全屏" @click="fullscreen"><FullScreen /></button>
        <button v-if="!embedded" aria-label="关闭" @click="emit('close')"><Close /></button>
      </div>
    </header>
    <div v-if="error" class="sales-state error" role="alert">
      {{ error }}<button @click="emit('refresh')">重新加载</button>
    </div>
    <template v-else-if="!selectedCode">
      <div class="sales-team-heading">
        <h2>销售业绩对比</h2>
        <div class="sales-controls">
          <select :value="regionCode" aria-label="城市" @change="emit('city', value($event))">
            <option value="">全部授权城市</option>
            <option v-for="city in cities" :key="city.code" :value="city.code">
              {{ city.name }}
            </option></select
          ><label class="sales-search"
            ><Search /><input
              v-model="search"
              placeholder="搜索销售姓名或城市"
              aria-label="搜索销售"
          /></label>
        </div>
      </div>
      <div v-if="loading" class="sales-state" role="status">正在读取真实经营数据…</div>
      <template v-else>
        <div class="sales-kpis">
          <article>
            <h3>本期交易额</h3>
            <strong class="blue">{{ moneyYuan(metric('sales_amount')) }}<small>元</small></strong>
            <p>{{ comparison }} {{ change('sales_amount') }}</p>
          </article>
          <article>
            <h3>本期到账</h3>
            <strong class="mint">{{ moneyYuan(metric('receipt_amount')) }}<small>元</small></strong>
            <p>{{ comparison }} {{ change('receipt_amount') }}</p>
          </article>
          <article>
            <h3>成交客户</h3>
            <strong>{{ integer(customers.customers) }}<small>家</small></strong>
            <p>新增合作客户 {{ integer(customers.newCustomers) }} 家</p>
          </article>
          <article>
            <h3>复购率</h3>
            <strong>{{ percentage(customers.rate) }}</strong>
            <p>复购客户 {{ integer(customers.returning) }} 家</p>
          </article>
        </div>
        <section class="sales-ranking">
          <div class="sales-section-heading">
            <div class="sales-tabs">
              <button
                :class="{ active: !receiptRank }"
                @click="
                  () => {
                    receiptRank = false
                    rankPage = 0
                  }
                "
              >
                本期交易额排名</button
              ><button
                :class="{ active: receiptRank }"
                @click="
                  () => {
                    receiptRank = true
                    rankPage = 0
                  }
                "
              >
                本期到账排名
              </button>
            </div>
            <span>点击销售姓名查看个人详情</span>
          </div>
          <div class="sales-table-scroll">
            <table class="sales-rank-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>销售 / 城市</th>
                  <th>{{ receiptRank ? '本期到账' : '本期交易额' }}(元)</th>
                  <template v-if="!receiptRank"
                    ><th>本期回款额(元)</th>
                    <th>本期回款率</th></template
                  >
                  <th>{{ comparison }}(元)</th>
                  <th>增减额(元)</th>
                  <th v-if="!dayMode">{{ annual ? '年' : '月' }}目标(元)</th>
                  <th v-if="!dayMode">目标完成率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pageRows" :key="row.code">
                  <td class="sales-rank">
                    <span v-if="row.rank <= 3" class="medal">{{ medals[row.rank - 1] }}</span
                    ><b v-else>{{ row.rank }}</b>
                  </td>
                  <td>
                    <button class="sales-person-link" @click="emit('select', row.code)">
                      {{ row.name
                      }}<small v-if="row.employmentStatus === 'LEFT'">已离职</small></button
                    ><span class="sales-person-city">{{ row.city }}</span>
                  </td>
                  <td :class="receiptRank ? 'mint' : 'blue'">{{ moneyYuan(row.amount) }}</td>
                  <template v-if="!receiptRank"
                    ><td>{{ moneyYuan(row.paid) }}</td>
                    <td>{{ percentage(row.collectionRate) }}</td></template
                  >
                  <td>{{ moneyYuan(row.previous) }}</td>
                  <td :class="deltaClass(row.delta)">{{ signed(row.delta) }}</td>
                  <td v-if="!dayMode">{{ moneyYuan(row.target) }}</td>
                  <td v-if="!dayMode">
                    <div class="sales-completion">
                      <b>{{ percentage(rate(row.amount, row.target)) }}</b>
                      <div
                        class="sales-progress"
                        :aria-label="`目标完成率 ${percentage(rate(row.amount, row.target))}`"
                      >
                        <i :style="progressStyle(rate(row.amount, row.target))" />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!rows.length" class="sales-state">暂无匹配销售</p>
          </div>
          <div class="sales-table-footer">
            <p>
              {{
                receiptRank
                  ? '本期到账按到账日期统计，包含历史订单。'
                  : '本期回款按本期订单累计统计，包含后续月份回款；回款和到账均包含待财务确认及已确认金额。'
              }}
            </p>
            <div class="sales-pagination">
              <span>共 {{ rows.length }} 位销售</span
              ><button :disabled="rankPage === 0" aria-label="排名上一页" @click="rankPage--">
                <ArrowLeft /></button
              ><span>{{ rankPage + 1 }} / {{ Math.max(1, Math.ceil(rows.length / 8)) }}</span
              ><button
                :disabled="(rankPage + 1) * 8 >= rows.length"
                aria-label="排名下一页"
                @click="rankPage++"
              >
                <ArrowRight />
              </button>
            </div>
          </div>
          <p v-if="!dayMode" class="sales-note">
            个人默认月目标：交易额 40,000.00 元、本期到账 20,000.00 元；新增合作客户 200
            家、复购客户 100 家。正式配置优先，年度目标逐月累计。
          </p>
        </section>
      </template>
    </template>
    <template v-else>
      <div class="sales-person-heading">
        <div>
          <button class="sales-link" @click="emit('select', '')">销售业绩对比</button
          ><span> / {{ person?.name || selectedCode }}</span>
          <h2>
            {{ person?.name || selectedCode }} <small>{{ person?.city }}</small
            ><em v-if="person?.employmentStatus === 'LEFT'">已离职</em>
          </h2>
          <p>同范围交易第 {{ personRank(false) }} 名 · 到账第 {{ personRank(true) }} 名</p>
        </div>
        <button class="sales-back" @click="emit('select', '')"><ArrowLeft />返回销售对比</button>
      </div>
      <nav class="sales-anchor-nav">
        <button
          v-for="item in sections"
          :key="item.id"
          :class="{ active: activeSection === item.id }"
          @click="jump(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
      <div v-if="detailLoading" class="sales-state" role="status">正在读取个人业绩…</div>
      <div v-else-if="detailError" class="sales-state error" role="alert">
        {{ detailError }}<button @click="emit('select', selectedCode)">重新加载</button>
      </div>
      <template v-else-if="detail">
        <section id="sales-performance" class="sales-kpis">
          <article>
            <h3>本期交易额</h3>
            <strong class="blue">{{ moneyYuan(metric('sales_amount')) }}<small>元</small></strong>
            <p>
              {{ comparison }} {{ moneyYuan(previousMetric('sales_amount')) }} 元
              <b>{{ change('sales_amount') }}</b>
            </p>
          </article>
          <article>
            <h3>本期到账</h3>
            <strong class="mint">{{ moneyYuan(personalReceipts) }}<small>元</small></strong>
            <p>
              {{ comparison }} {{ moneyYuan(previousReceipts) }} 元
              <b>{{ percentageChange(personalReceipts, previousReceipts) }}</b>
            </p>
          </article>
          <article>
            <h3>成交客户</h3>
            <strong>{{ integer(customers.customers) }}<small>家</small></strong>
            <p>新增客户 {{ integer(customers.newCustomers) }} 家</p>
          </article>
          <article>
            <h3>复购率</h3>
            <strong>{{ percentage(customers.rate) }}</strong>
            <p>复购客户 {{ integer(customers.returning) }} 家</p>
          </article>
        </section>
        <section v-if="!dayMode" class="sales-performance-grid">
          <article class="sales-trend">
            <div class="sales-section-heading">
              <h2>{{ receiptTrend ? '本期到账' : '交易额' }}趋势</h2>
              <div class="sales-tabs">
                <button :class="{ active: !receiptTrend }" @click="receiptTrend = false">
                  交易额</button
                ><button :class="{ active: receiptTrend }" @click="receiptTrend = true">
                  本期到账
                </button>
              </div>
            </div>
            <EchartsChart :option="trendChart" height="360px" /><button
              class="sales-link"
              @click="showMonths = !showMonths"
            >
              {{ showMonths ? '收起' : '查看' }}月度明细 <ArrowRight />
            </button>
          </article>
          <article class="sales-goals">
            <h2>{{ annual ? '年度' : '本月' }}目标达成</h2>
            <div class="sales-goal-grid">
              <article v-for="goal in goals" :key="goal.metric">
                <h3>{{ goal.label }}</h3>
                <EchartsChart
                  :option="targetGauge(goal.actual, goal.value, 16)"
                  height="145px"
                /><strong :class="goal.metric === 'RECEIPT_AMOUNT' ? 'mint' : 'blue'"
                  >{{ goal.unit === '元' ? moneyYuan(goal.actual) : integer(goal.actual)
                  }}<small>{{ goal.unit }}</small></strong
                >
                <p v-if="goal.value != null">
                  目标 {{ goal.unit === '元' ? moneyYuan(goal.value) : integer(goal.value)
                  }}{{ goal.unit }}
                  <span
                    >· {{ goal.actual != null && goal.actual > goal.value ? '超额' : '差额' }}
                    {{
                      goal.actual == null
                        ? '—'
                        : goal.unit === '元'
                          ? moneyYuan(Math.abs(goal.value - goal.actual))
                          : integer(Math.abs(goal.value - goal.actual))
                    }}{{ goal.unit }}</span
                  >
                </p>
                <p v-else>目标待配置 · 已完成 {{ integer(goal.actual) }} 家</p>
              </article>
            </div>
            <p class="sales-note">
              默认月目标：交易 40,000 元、到账 20,000 元、新增 200 家、复购 100
              家。正式配置优先；年度逐月累计。
            </p>
          </article>
        </section>
        <section v-if="showMonths && !dayMode" class="sales-month-detail">
          <h2>{{ year }} 年月度明细</h2>
          <div class="sales-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>月份</th>
                  <th>交易额(元)</th>
                  <th>本期到账(元)</th>
                  <th>本期回款额(元)</th>
                  <th>交易目标完成率</th>
                  <th>到账目标完成率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in monthlyRows" :key="item.month">
                  <td>
                    <button class="sales-link" @click="setMonth(item.number)">
                      {{ item.number }}月
                    </button>
                  </td>
                  <td>{{ moneyYuan(item.sales) }}</td>
                  <td class="mint">{{ moneyYuan(item.receipts) }}</td>
                  <td>{{ moneyYuan(item.received) }}</td>
                  <td>
                    {{
                      percentage(
                        rate(
                          item.sales,
                          personalGoal(detail.sales, selectedCode, 'SALES_AMOUNT', item.number)
                            .value,
                        ),
                      )
                    }}
                  </td>
                  <td>
                    {{
                      percentage(
                        rate(
                          item.receipts,
                          personalGoal(detail.sales, selectedCode, 'RECEIPT_AMOUNT', item.number)
                            .value,
                        ),
                      )
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section id="sales-customers" class="sales-customer-grid">
          <article>
            <h2>客户经营</h2>
            <div class="sales-customer-stats">
              <div v-for="stat in customerCards" :key="stat.label">
                <span>{{ stat.label }}</span
                ><strong>{{ stat.value }}</strong>
              </div>
            </div>
            <p class="sales-note">
              新增：首次有效订单在本期；复购：本期下单且此前已有有效订单，年度按客户去重。
            </p>
          </article>
          <article>
            <h2>重点客户 <small>按本期交易额排序</small></h2>
            <div class="sales-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>客户名称</th>
                    <th>本期交易额(元)</th>
                    <th>本期回款额(元)</th>
                    <th>回款率</th>
                    <th>未回款额(元)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleCustomers" :key="row.code">
                    <td>{{ row.name || row.code }}</td>
                    <td class="blue">{{ moneyYuan(row.sales) }}</td>
                    <td>{{ moneyYuan(row.received) }}</td>
                    <td>{{ percentage(rate(row.received, row.sales)) }}</td>
                    <td>{{ moneyYuan(row.sales - row.received) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!visibleCustomers.length" class="sales-state">本期暂无成交客户</p>
            </div>
            <div class="sales-pagination">
              <span>共 {{ detail.sales?.customers.length || 0 }} 家</span
              ><button
                :disabled="customerPage === 0"
                @click="customerPage--"
                aria-label="客户上一页"
              >
                <ArrowLeft /></button
              ><button
                :disabled="(customerPage + 1) * 5 >= (detail.sales?.customers.length || 0)"
                @click="customerPage++"
                aria-label="客户下一页"
              >
                <ArrowRight />
              </button>
            </div>
          </article>
        </section>
        <section id="sales-products" class="sales-products">
          <div class="sales-section-heading">
            <h2>商品贡献</h2>
            <div class="sales-controls">
              <select
                v-model="category"
                aria-label="商品品类"
                @change="
                  () => {
                    product = ''
                    sku = ''
                    productPage = 0
                  }
                "
              >
                <option value="">全部品类</option>
                <option v-for="item in categories" :key="item.code" :value="item.code">
                  {{ item.name }}
                </option></select
              ><select
                v-model="product"
                aria-label="商品"
                @change="
                  () => {
                    sku = ''
                    productPage = 0
                  }
                "
              >
                <option value="">全部商品</option>
                <option v-for="item in products" :key="item.code" :value="item.code">
                  {{ item.name }}
                </option></select
              ><select v-model="sku" aria-label="型号" @change="productPage = 0">
                <option value="">全部型号</option>
                <option v-for="item in skus" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
          </div>
          <div v-if="!detail.sales?.productSyncedAt" class="sales-state">
            商品分摊尚未完成同步，请刷新后重试。
          </div>
          <template v-else
            ><div class="sales-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>商品 / 型号</th>
                    <th>售卖数量</th>
                    <th>本期交易额(元)</th>
                    <th>本期到账分摊(元)</th>
                    <th>本期回款额(元)</th>
                    <th>本期回款率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleProducts" :key="`${row.productId}:${row.sku}`">
                    <td>
                      {{ row.product }}<small class="sales-person-city">{{ row.sku }}</small>
                    </td>
                    <td>
                      {{
                        row.quantity == null
                          ? '—'
                          : row.quantity.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
                      }}
                    </td>
                    <td class="blue">{{ moneyYuan(row.sales) }}</td>
                    <td class="mint">{{ moneyYuan(row.receipts) }}</td>
                    <td>{{ moneyYuan(row.received) }}</td>
                    <td>
                      {{ row.allocated ? percentage(rate(row.received, row.sales)) : '无法分摊' }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!filteredProducts.length" class="sales-state">暂无匹配商品</p>
            </div>
            <div class="sales-table-footer">
              <p>数量按本期订单统计；到账含历史订单分摊；商品筛选不改变个人目标。</p>
              <div class="sales-pagination">
                <span>共 {{ filteredProducts.length }} 项</span
                ><button
                  :disabled="productPage === 0"
                  @click="productPage--"
                  aria-label="商品上一页"
                >
                  <ArrowLeft /></button
                ><button
                  :disabled="(productPage + 1) * 5 >= filteredProducts.length"
                  @click="productPage++"
                  aria-label="商品下一页"
                >
                  <ArrowRight />
                </button>
              </div></div
          ></template>
        </section>
        <section id="sales-collections" class="sales-collections">
          <h2>回款分析</h2>
          <div class="sales-collection-grid">
            <template v-for="item in collectionCards" :key="item.title">
              <article>
                <h3>{{ item.title }}</h3>
                <div class="sales-donut-content">
                  <EchartsChart :option="donut(item.amount, item.received)" height="165px" />
                  <dl>
                    <div>
                      <dt>{{ item.history ? '历史订单额' : '本期订单额' }}</dt>
                      <dd>{{ moneyYuan(item.amount) }} 元</dd>
                    </div>
                    <div>
                      <dt>{{ item.history ? '累计回款额' : '本期回款额' }}</dt>
                      <dd class="mint">{{ moneyYuan(item.received) }} 元</dd>
                    </div>
                    <div>
                      <dt>未回款额</dt>
                      <dd>
                        {{
                          moneyYuan(
                            item.amount != null && item.received != null
                              ? item.amount - item.received
                              : null,
                          )
                        }}
                        元
                      </dd>
                    </div>
                  </dl>
                </div>
                <p>
                  {{
                    item.history
                      ? '不受本期订单日期限制，保留当前授权与城市范围。'
                      : '包含这些订单在后续月份收到的款。'
                  }}
                </p>
              </article>
              <article v-if="!item.history" class="sales-cash-split">
                <h3>本期到账</h3>
                <strong class="mint">{{ moneyYuan(personalReceipts) }}<small>元</small></strong>
                <dl>
                  <div>
                    <dt>本期订单到账</dt>
                    <dd>{{ moneyYuan(detail.sales?.receiptSplit?.currentOrders ?? null) }} 元</dd>
                  </div>
                  <div>
                    <dt>历史订单到账</dt>
                    <dd>
                      {{ moneyYuan(detail.sales?.receiptSplit?.historicalOrders ?? null) }} 元
                    </dd>
                  </div>
                  <div v-if="detail.sales?.receiptSplit?.otherOrders">
                    <dt>其他订单到账</dt>
                    <dd>{{ moneyYuan(detail.sales.receiptSplit.otherOrders) }} 元</dd>
                  </div>
                </dl>
              </article>
            </template>
          </div>
        </section>
      </template>
    </template>
    <footer class="sales-dashboard-footer">
      <span>{{
        active?.notice || '交易按订单销售归属；到账优先回款经办人，缺失时按客户当前归属业务员。'
      }}</span
      ><button class="sales-link" @click="showDefinitions = !showDefinitions">
        {{ showDefinitions ? '收起' : '查看' }}统计口径
      </button>
      <p v-if="showDefinitions">
        本期交易额按订单日期；本期到账按到账日期，包含历史订单；本期回款为本期订单累计回款，包含后续月份回款；回款和到账均包含待财务确认及已确认金额。复购客户按期间去重；没有有效分母时完成率显示“—”。
      </p>
    </footer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Close, FullScreen, Refresh, Search } from '@element-plus/icons-vue'
import EchartsChart from './EchartsChart.vue'
import { businessMonthRange } from '@/utils/business-date'
import { meetingMetric, moneyYuan, percentage, rate } from '../meeting-model'
import { overviewLine, targetGauge, collectionDonut, completionGradient } from '../overview-model'
import {
  personalGoal,
  salesCustomerStats,
  salesDashboardRows,
  type SalesDashboardSnapshot,
} from '../sales-dashboard-model'
import type { SalesPeriod } from '../sales-meeting-model'
const props = withDefaults(
  defineProps<{
    annualMode?: boolean
    dayMode?: boolean
    embedded?: boolean
    snapshot: SalesDashboardSnapshot | null
    detail: SalesDashboardSnapshot | null
    selectedCode: string
    period: SalesPeriod
    maxDate: string
    scopeLabel: string
    regionCode: string
    cities: { code: string; name: string }[]
    loading?: boolean
    detailLoading?: boolean
    error?: string
    detailError?: string
  }>(),
  { error: '', detailError: '' },
)
const emit = defineEmits<{
  day: [string]
  period: [SalesPeriod, boolean?]
  city: [string]
  select: [string]
  refresh: []
  close: []
}>()
const root = ref<HTMLElement>(),
  search = ref(''),
  receiptRank = ref(false),
  rankPage = ref(0),
  receiptTrend = ref(false),
  showMonths = ref(false),
  showDefinitions = ref(false)
const category = ref(''),
  product = ref(''),
  sku = ref(''),
  productPage = ref(0),
  customerPage = ref(0),
  activeSection = ref('sales-performance')
const medals = ['🥇', '🥈', '🥉']
const sections = computed(() => [
  { id: 'sales-performance', label: props.dayMode ? '业绩概况' : '业绩与目标' },
  { id: 'sales-customers', label: '客户经营' },
  { id: 'sales-products', label: '商品分析' },
  { id: 'sales-collections', label: '回款分析' },
])
const year = computed(() => Number(props.period.from.slice(0, 4)))
const annual = computed(
  () => props.annualMode ?? props.period.from.slice(0, 7) !== props.period.to.slice(0, 7),
)
const month = computed(() => (annual.value ? null : Number(props.period.from.slice(5, 7))))
const years = computed(() =>
  Array.from(
    { length: Math.max(8, Number(props.maxDate.slice(0, 4)) - year.value + 1) },
    (_, i) => Number(props.maxDate.slice(0, 4)) - i,
  ),
)
const comparison = computed(() =>
  props.dayMode ? '前一天' : annual.value ? '上年同期' : '上月同期',
)
const active = computed(() => (props.selectedCode ? props.detail : props.snapshot))
const customers = computed(() => salesCustomerStats(active.value, annual.value))
const person = computed(
  () =>
    props.detail?.sales?.people.find((p) => p.code === props.selectedCode) ||
    props.snapshot?.sales?.people.find((p) => p.code === props.selectedCode),
)
const rows = computed(() =>
  salesDashboardRows(props.snapshot, receiptRank.value, month.value, search.value),
)
const pageRows = computed(() => rows.value.slice(rankPage.value * 8, rankPage.value * 8 + 8))
const metric = (code: string) => meetingMetric(active.value?.current, code)
const previousMetric = (code: string) => meetingMetric(active.value?.previous, code)
const personalReceipts = computed(() =>
  metric('receipt_amount') != null
    ? (props.detail?.sales?.people.find((p) => p.code === props.selectedCode)?.receipts ?? 0)
    : null,
)
const previousReceipts = computed(() =>
  previousMetric('receipt_amount') != null && props.detail?.previousSales
    ? (props.detail.previousSales.people.find((p) => p.code === props.selectedCode)?.receipts ?? 0)
    : null,
)
const dataCutoff = computed(() =>
  active.value?.current.definitions
    .find((d) => d.metricCode === 'sales_amount')
    ?.dataCutoffTime?.slice(0, 10),
)
const integer = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('zh-CN'))
const value = (event: Event) => (event.target as HTMLInputElement).value
const signed = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${moneyYuan(n)}`)
const deltaClass = (n: number | null) => (n == null ? '' : n > 0 ? 'mint' : n < 0 ? 'negative' : '')
const percentageChange = (a: number | null, b: number | null) =>
  a == null || b == null || b === 0
    ? '—'
    : `${a >= b ? '+' : ''}${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%`
const change = (code: string) => percentageChange(metric(code), previousMetric(code))
const progressStyle = (n: number | null) => ({
  width: `${Math.max(0, Math.min(100, n ?? 0))}%`,
  background: completionGradient(n).css,
})
function setYear(y: number) {
  setPeriod(y, null)
}
function setMonth(m: number | null) {
  setPeriod(year.value, m)
}
function setPeriod(y: number, m: number | null) {
  const [from, to] = m
    ? businessMonthRange(`${y}-${String(m).padStart(2, '0')}`)
    : [`${y}-01-01`, `${y}-12-31`]
  emit('period', { from, to: to > props.maxDate ? props.maxDate : to }, m === null)
}
function jump(id: string) {
  activeSection.value = id
  root.value?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function fullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await root.value?.requestFullscreen?.()
}
const personRank = (receipt: boolean) =>
  salesDashboardRows(props.snapshot, receipt, month.value).find(
    (p) => p.code === props.selectedCode,
  )?.rank ?? '—'
const trendChart = computed(() =>
  overviewLine(
    props.detail?.current ?? null,
    props.detail?.previous ?? null,
    annual.value,
    receiptTrend.value,
    true,
  ),
)
const goals = computed(() =>
  [
    { metric: 'SALES_AMOUNT', label: '交易额', actual: metric('sales_amount'), unit: '元' },
    { metric: 'RECEIPT_AMOUNT', label: '本期到账', actual: personalReceipts.value, unit: '元' },
    {
      metric: 'NEW_CUSTOMER',
      label: '新增合作客户数',
      actual: customers.value.newCustomers,
      unit: '家',
    },
    {
      metric: 'REPEAT_CUSTOMER',
      label: '复购客户数',
      actual: customers.value.returning,
      unit: '家',
    },
  ].map((g) => ({
    ...g,
    ...personalGoal(props.detail?.sales, props.selectedCode, g.metric, month.value),
  })),
)
const customerCards = computed(() => [
  { label: '成交客户', value: integer(customers.value.customers) },
  { label: '新增合作客户', value: integer(customers.value.newCustomers) },
  { label: '复购客户', value: integer(customers.value.returning) },
  { label: '复购率', value: percentage(customers.value.rate) },
])
const visibleCustomers = computed(
  () =>
    props.detail?.sales?.customers.slice(customerPage.value * 5, customerPage.value * 5 + 5) ?? [],
)
const allProducts = computed(() => props.detail?.sales?.products ?? [])
const categories = computed(() => [
  ...new Map(
    allProducts.value.map((p) => [p.categoryId, { code: p.categoryId, name: p.category }]),
  ).values(),
])
const products = computed(() => [
  ...new Map(
    allProducts.value
      .filter((p) => !category.value || p.categoryId === category.value)
      .map((p) => [p.productId, { code: p.productId, name: p.product }]),
  ).values(),
])
const skus = computed(() => [
  ...new Set(
    allProducts.value
      .filter(
        (p) =>
          (!category.value || p.categoryId === category.value) &&
          (!product.value || p.productId === product.value),
      )
      .map((p) => p.sku),
  ),
])
const filteredProducts = computed(() =>
  allProducts.value.filter(
    (p) =>
      (!category.value || p.categoryId === category.value) &&
      (!product.value || p.productId === product.value) &&
      (!sku.value || p.sku === sku.value),
  ),
)
const visibleProducts = computed(() =>
  filteredProducts.value.slice(productPage.value * 5, productPage.value * 5 + 5),
)
const monthlyRows = computed(() =>
  Array.from(
    {
      length:
        year.value === Number(props.maxDate.slice(0, 4)) ? Number(props.maxDate.slice(5, 7)) : 12,
    },
    (_, i) => {
      const key = `${year.value}-${String(i + 1).padStart(2, '0')}`,
        p = props.detail?.sales?.months.find((p) => p.month === key)
      return {
        month: key,
        number: i + 1,
        sales: metric('sales_amount') == null ? null : (p?.sales ?? 0),
        received: metric('paid_amount') == null ? null : (p?.received ?? 0),
        receipts: metric('receipt_amount') == null ? null : (p?.receipts ?? 0),
      }
    },
  ),
)
const collectionCards = computed(() => [
  {
    title: '本期回款率',
    amount: metric('sales_amount'),
    received: metric('paid_amount'),
    history: false,
  },
  {
    title: '全部历史订单回款率',
    amount: metric('sales_amount') == null ? null : (props.detail?.sales?.history?.amount ?? null),
    received:
      metric('paid_amount') == null ? null : (props.detail?.sales?.history?.received ?? null),
    history: true,
  },
])
function donut(amount: number | null, received: number | null) {
  const current = props.detail?.current
  if (!current) return collectionDonut(null)
  return collectionDonut({
    ...current,
    metrics: current.metrics.map((m) =>
      m.metricCode === 'sales_amount'
        ? { ...m, value: amount! }
        : m.metricCode === 'paid_amount'
          ? { ...m, value: received! }
          : m,
    ),
  })
}
watch(search, () => {
  rankPage.value = 0
})
watch(
  () => props.snapshot,
  () => {
    rankPage.value = Math.min(rankPage.value, Math.max(0, Math.ceil(rows.value.length / 8) - 1))
  },
)
watch(
  () => props.selectedCode,
  () => {
    category.value = ''
    product.value = ''
    sku.value = ''
    customerPage.value = 0
    productPage.value = 0
    activeSection.value = 'sales-performance'
    if (root.value) root.value.scrollTop = 0
  },
)
watch(
  () => props.period,
  () => {
    customerPage.value = 0
    productPage.value = 0
  },
)
</script>
<style lang="scss" src="../sales-meeting-board.scss"></style>
