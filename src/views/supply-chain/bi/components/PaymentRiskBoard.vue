<template>
  <main ref="boardElement" class="payment-risk-board" :aria-busy="loading">
    <div class="filter-toolbar">
      <form class="risk-filters" @submit.prevent="reload">
        <div class="month-filter filter-field">
          <el-config-provider :locale="zhCn">
            <div class="month-range" role="group" aria-label="订单月份">
              <el-date-picker
                v-model="start"
                type="month"
                format="YYYY年MM月"
                value-format="YYYY-MM"
                :clearable="false"
                :teleported="false"
                aria-label="订单开始月份"
                placeholder="开始月份"
                popper-class="risk-month-popper"
              />
              <span>至</span>
              <el-date-picker
                v-model="end"
                type="month"
                format="YYYY年MM月"
                value-format="YYYY-MM"
                :clearable="false"
                :teleported="false"
                aria-label="订单结束月份"
                placeholder="结束月份"
                popper-class="risk-month-popper"
              />
            </div>
          </el-config-provider>
        </div>
        <div class="dimension-filter">
          <el-select
            v-model="queryFilters.region"
            aria-label="城市"
            placeholder="全部城市"
            filterable
            clearable
            value-on-clear=""
            :teleported="false"
            :fit-input-width="true"
            popper-class="risk-dimension-popper"
            no-match-text="未找到匹配城市"
            no-data-text="暂无城市"
          >
            <el-option label="全部城市" value="" />
            <el-option
              v-for="city in cities"
              :key="city.key"
              :value="city.key"
              :label="city.name"
              :title="city.name"
            />
          </el-select>
        </div>
        <div class="dimension-filter owner-filter">
          <el-select
            v-model="queryFilters.owner"
            aria-label="业务员"
            placeholder="全部业务员"
            filterable
            clearable
            value-on-clear=""
            :teleported="false"
            :fit-input-width="true"
            popper-class="risk-dimension-popper"
            no-match-text="未找到匹配业务员"
            no-data-text="暂无业务员"
          >
            <el-option label="全部业务员" value="" />
            <el-option
              v-for="person in people"
              :key="person.key"
              :value="person.key"
              :label="person.name"
              :title="person.name"
            />
          </el-select>
        </div>
        <div class="category-filter">
          <el-tree-select
            v-model="queryFilters.categories"
            :data="categoryTree"
            multiple
            show-checkbox
            check-strictly
            node-key="value"
            collapse-tags
            collapse-tags-tooltip
            clearable
            filterable
            placeholder="全部分类（可多选）"
            aria-label="产品分类（多选）"
            :teleported="false"
            :fit-input-width="true"
            popper-class="risk-category-popper"
          />
        </div>
        <div class="dimension-filter risk-filter">
          <el-select
            v-model="queryFilters.risk"
            aria-label="风险等级"
            placeholder="全部风险"
            clearable
            value-on-clear=""
            :teleported="false"
            :fit-input-width="true"
            popper-class="risk-dimension-popper"
          >
            <el-option label="全部风险" value="" />
            <el-option
              v-for="level in riskLevels"
              :key="level.key"
              :value="level.key"
              :label="level.name"
            />
          </el-select>
        </div>
        <div class="query-actions">
          <button type="submit" :disabled="loading" class="primary query-button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" /></svg
            >查询
          </button>
          <button type="button" :disabled="loading" class="outline" @click="resetQuery">
            重置
          </button>
        </div>
      </form>
      <div class="header-actions">
        <button type="button" class="outline" :disabled="!data || loading" @click="showDetails">
          查看订单明细
        </button>
        <button
          type="button"
          class="outline icon-button"
          :disabled="loading"
          aria-label="刷新数据"
          title="刷新当前查询结果"
          @click="refreshData"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
          </svg>
        </button>
        <button
          type="button"
          class="outline icon-button"
          :aria-label="fullscreen ? '退出全屏' : '看板全屏'"
          :title="fullscreen ? '退出全屏（Esc）' : '看板全屏'"
          :aria-pressed="fullscreen"
          @click="toggleFullscreen"
        >
          <svg v-if="!fullscreen" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" />
          </svg>
        </button>
      </div>
    </div>
    <p v-if="fullscreenError" role="alert" class="error">{{ fullscreenError }}</p>
    <p v-if="rangeError" role="alert" class="error">{{ rangeError }}</p>
    <div class="selection-line">
      <span v-if="demo" class="demo-label">演示数据</span>
      <span>订单月份 {{ initialRange[0] }} — {{ initialRange[1] }} · 账龄截至 {{ asOf }}</span>
      <button v-if="hasFilters" class="link" @click="reset">清除筛选与下钻</button>
      <span v-if="filters.month" class="chip"
        >订单月份 {{ filters.month }}
        <button aria-label="清除月份下钻" @click="filters.month = ''">×</button></span
      >
      <span v-if="filters.product" class="chip"
        >已选具体产品
        <button aria-label="清除产品下钻" @click="filters.product = ''">×</button></span
      >
    </div>
    <p v-if="loading" role="status" class="state">正在读取未结清订单…</p>
    <p v-else-if="error" role="alert" class="error state">
      {{ error }} <button class="outline" @click="refreshData">重试</button>
    </p>
    <template v-else-if="data">
      <section class="risk-kpis" aria-label="未结清订单指标">
        <article>
          <h2>未收款总额</h2>
          <strong class="cyan">{{ wan(total) }}<small>万元</small></strong>
          <p title="未结清订单按整单应收金额计入，不扣部分回款">整单金额</p>
        </article>
        <article v-for="level in risks.filter((level) => level.key !== 'UNKNOWN')" :key="level.key">
          <h2>{{ level.name }}金额</h2>
          <strong :style="{ color: level.color }"
            >{{ wan(level.amount) }}<small>万元</small></strong
          >
          <p>{{ level.count.toLocaleString() }} 单</p>
        </article>
        <article>
          <h2>未结清订单数</h2>
          <strong>{{ orders.length.toLocaleString() }}<small>单</small></strong>
          <p>订单去重</p>
        </article>
      </section>
      <p v-if="!orders.length" class="empty" role="status">
        当前范围没有未结清订单。可调整月份或清除筛选。
      </p>
      <div class="risk-main-grid">
        <section class="risk-panel matrix-panel">
          <div class="section-title">
            <div>
              <h2 title="按订单月份统计未结清订单全额，点击单元格查看订单">城市月度未回款</h2>
            </div>
            <div class="segmented">
              <button :class="{ active: !countMode }" @click="countMode = false">金额</button>
              <button :class="{ active: countMode }" @click="countMode = true">订单数</button>
            </div>
          </div>
          <div
            class="matrix-risk-legend"
            aria-label="城市月份风险颜色说明"
            title="按单元格内最高风险着色，0 表示正常"
          >
            <span class="normal-key"><i />正常（0）</span>
            <span v-for="level in riskLevels" :key="level.key"
              ><i :style="{ background: level.color }" />{{ level.name }}</span
            >
            <span class="matrix-unit">单位：{{ countMode ? '单' : '万元' }}</span>
          </div>
          <div class="matrix-scroll">
            <table class="risk-matrix">
              <thead>
                <tr>
                  <th>城市</th>
                  <th v-for="month in months" :key="month">
                    {{ month.slice(2).replace('-', '/') }}
                  </th>
                  <th>合计</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="city in matrix" :key="city.key">
                  <th>
                    <button @click="filters.region = city.key">{{ city.name }}</button>
                  </th>
                  <td
                    v-for="cell in city.cells"
                    :key="cell.month"
                    :style="riskCellStyle(cell.risk)"
                    :data-risk="cell.risk"
                  >
                    <button
                      :aria-label="`${city.name} ${cell.month} ${countMode ? '订单数' : '订单金额'}`"
                      :title="`${cell.risk === 'NORMAL' ? '正常，无未结清订单' : '最高风险：' + riskLevels.find((level) => level.key === cell.risk)?.name} · ${yuan(cell.amount)}元 · ${cell.count}单`"
                      @click="drillCity(city.key, cell.month)"
                    >
                      {{ countMode ? cell.count : wan(cell.amount) }}
                    </button>
                  </td>
                  <td class="total">{{ countMode ? city.count : wan(city.amount) }}</td>
                  <td>
                    {{
                      percentage(
                        countMode ? city.count : city.amount,
                        countMode ? orders.length : total,
                      )
                    }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>合计</th>
                  <td v-for="month in months" :key="month">
                    {{
                      countMode
                        ? orders.filter((o) => o.orderDate.startsWith(month)).length
                        : wan(orderAmount(orders.filter((o) => o.orderDate.startsWith(month))))
                    }}
                  </td>
                  <td>{{ countMode ? orders.length : wan(total) }}</td>
                  <td>{{ total ? '100.0%' : '—' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section class="risk-panel composition-panel">
          <div class="section-title">
            <div>
              <h2 title="整单取最高风险，每单只计一次">未回款风险分布</h2>
            </div>
          </div>
          <div class="panel-meta"><span>整单最高风险</span><span>单位：万元</span></div>
          <div class="risk-composition">
            <EchartsChart :option="riskChart" :height="270" @chart-click="onRiskChartClick" />
            <div class="risk-legend">
              <div class="legend-heading">
                <span>风险等级</span><span>金额</span><span>占比</span>
              </div>
              <button
                v-for="level in risks"
                :key="level.key"
                class="legend-row"
                @click="filters.risk = level.key"
              >
                <span><i :style="{ background: level.color }" />{{ level.name }}</span>
                <b>{{ wan(level.amount) }}</b
                ><span>{{ percentage(level.amount, total) }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <div class="risk-secondary-grid">
        <section class="risk-panel">
          <div class="section-title">
            <div>
              <h2 title="点击业务员筛选对应订单">业务员未回款</h2>
            </div>
          </div>
          <div class="panel-meta">
            <span class="amount-key"><i />金额占比</span><span>单位：万元</span>
          </div>
          <div class="ranking-scroll">
            <table class="ranking sales-ranking">
              <thead>
                <tr>
                  <th>业务员</th>
                  <th>金额</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="person in salesRanking" :key="person.key">
                  <th>
                    <button @click="filters.owner = person.key">{{ person.name }}</button>
                  </th>
                  <td>{{ wan(person.amount) }}</td>
                  <td>
                    <div class="share-cell">
                      <span class="share-track"
                        ><span :style="{ width: percentage(person.amount, total) }" /></span
                      ><span>{{ percentage(person.amount, total) }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="risk-panel">
          <div class="section-title">
            <div>
              <h2>{{ productMode ? '产品未回款' : '产品分类未回款' }}</h2>
            </div>
            <div class="segmented">
              <button :class="{ active: !productMode }" @click="productMode = false">分类</button
              ><button :class="{ active: productMode }" @click="productMode = true">产品</button>
            </div>
          </div>
          <div
            class="panel-meta"
            title="每单归属最高风险产品；同风险取商品金额最大者。点击分类可查看产品。"
          >
            <span class="amount-key"><i />金额占比</span><span>单位：万元</span>
          </div>
          <div class="product-composition">
            <EchartsChart :option="productChart" :height="240" @chart-click="onProductChartClick" />
            <div class="ranking-scroll">
              <table class="ranking product-ranking">
                <thead>
                  <tr>
                    <th>{{ productMode ? '产品' : '产品分类' }}</th>
                    <th>金额</th>
                    <th>占比</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(product, index) in productRanking" :key="product.key">
                    <th>
                      <button :title="product.name" @click="drillProduct(product.key)">
                        <i class="category-dot" :style="{ background: productColor(index) }" />{{
                          product.name
                        }}
                      </button>
                    </th>
                    <td>{{ wan(product.amount) }}</td>
                    <td>
                      {{ percentage(product.amount, total) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      <section class="risk-panel rules">
        <div class="section-title">
          <h2>风险判定规则</h2>
        </div>
        <div class="panel-meta"><span>订单日起算</span><span>单位：天</span></div>
        <table>
          <thead>
            <tr>
              <th>产品分类</th>
              <th class="low">低风险</th>
              <th class="medium">中风险</th>
              <th class="high">高风险</th>
              <th class="severe">严重风险</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>台呢（含子分类）</th>
              <td>≤10天</td>
              <td>11–20天</td>
              <td>21–30天</td>
              <td>&gt;30天</td>
            </tr>
            <tr>
              <th>其他产品</th>
              <td>≤30天</td>
              <td>31–60天</td>
              <td>61–90天</td>
              <td>&gt;90天</td>
            </tr>
          </tbody>
        </table>
        <details class="calculation-notes">
          <summary>统计口径</summary>
          <p>
            未结清订单按整单应收金额计入，不扣部分回款。每单取最高风险；并列时归属商品金额最大的产品。分类、产品和风险金额合计均等于未收款总额。分类缺失归待确认，账龄按北京时间自然日计算。
          </p>
        </details>
      </section>
      <section v-if="detailsOpen" ref="detailSection" class="risk-panel detail-panel">
        <div class="section-title">
          <div>
            <h2>未结清订单明细</h2>
            <p>{{ orders.length }} 单 · 单位：元</p>
          </div>
          <button class="outline" @click="detailsOpen = false">收起明细</button>
        </div>
        <div class="detail-scroll">
          <table>
            <thead>
              <tr>
                <th>订单号 / 客户</th>
                <th>城市 / 业务员</th>
                <th>订单日期</th>
                <th>账龄</th>
                <th>订单应收（统计金额）</th>
                <th>已回款（不抵扣）</th>
                <th>归属产品与整单风险</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in pagedOrders" :key="order.orderId">
                <td>
                  <b>{{ order.orderNo }}</b
                  ><small>{{ order.customerName || '客户待确认' }}</small>
                </td>
                <td>
                  {{ order.regionName || '城市待确认'
                  }}<small>{{ order.ownerStaffName || '业务员待确认' }}</small>
                </td>
                <td>{{ order.orderDate }}</td>
                <td>{{ order.ageDays }}天</td>
                <td>{{ yuan(order.orderAmount) }}</td>
                <td>{{ yuan(order.paidAmount) }}</td>
                <td>
                  <span
                    v-for="(product, index) in order.products"
                    :key="index"
                    class="product-risk"
                  >
                    {{ product.productName || product.categoryName || '产品待确认' }}
                    <b
                      :style="{ color: riskLevels.find((l) => l.key === product.riskLevel)?.color }"
                      >{{ riskLevels.find((l) => l.key === product.riskLevel)?.name }}</b
                    >
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="outline" :disabled="page <= 1" @click="page--">上一页</button>
          <span>{{ page }} / {{ Math.max(1, Math.ceil(orders.length / 20)) }}</span>
          <button class="outline" :disabled="page * 20 >= orders.length" @click="page++">
            下一页
          </button>
        </div>
      </section>
      <footer>订单记录最近同步 {{ updated }}；查询时间不代表来源已完整同步。</footer>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import type { EChartsCoreOption } from 'echarts/core'
import type { PaymentRiskData } from '@/api/core/payment-risk'
import {
  emptyRiskFilters,
  groupRiskOrders,
  activeOrderMonths,
  matrixCellRisk,
  orderAmount,
  percentage,
  riskGroups,
  riskLevels,
  unknownKey,
  wan,
} from '../payment-risk-model'
import { selectRiskOrders } from '../payment-risk-model'
import EchartsChart from './EchartsChart.vue'

const props = withDefaults(
  defineProps<{
    data: PaymentRiskData | null
    initialRange: [string, string]
    loading?: boolean
    error?: string
    demo?: boolean
  }>(),
  { loading: false, error: '', demo: false },
)
const emit = defineEmits<{ load: [months: [string, string]] }>()
const defaultRange: [string, string] = [...props.initialRange]
const start = ref(props.initialRange[0])
const end = ref(props.initialRange[1])
const rangeError = ref('')
const filters = ref(emptyRiskFilters())
const queryFilters = ref(emptyRiskFilters())
const boardElement = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
const fullscreenError = ref('')
function updateFullscreen() {
  fullscreen.value = document.fullscreenElement === boardElement.value
}
async function toggleFullscreen() {
  fullscreenError.value = ''
  try {
    if (document.fullscreenElement === boardElement.value) await document.exitFullscreen()
    else await boardElement.value?.requestFullscreen()
  } catch {
    fullscreenError.value = '当前浏览器未能进入全屏，请在支持全屏的浏览器中打开看板。'
  }
}
function handleFullscreenKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && document.fullscreenElement === boardElement.value)
    void toggleFullscreen()
}
onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreen)
  document.addEventListener('keydown', handleFullscreenKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', updateFullscreen)
  document.removeEventListener('keydown', handleFullscreenKey)
})
watch(
  filters,
  (value) => {
    queryFilters.value = { ...value, categories: [...value.categories] }
  },
  { deep: true, flush: 'sync' },
)
const countMode = ref(false)
const productMode = ref(false)
const detailsOpen = ref(false)
const detailSection = ref<HTMLElement | null>(null)
const page = ref(1)
const orders = computed(() => (props.data ? selectRiskOrders(props.data, filters.value) : []))
const total = computed(() => orderAmount(orders.value))
const risks = computed(() => riskGroups(orders.value))
const cities = computed(() =>
  groupRiskOrders(props.data?.orders || [], (o) => [
    { key: o.regionCode || unknownKey, name: o.regionName || '城市待确认' },
  ]),
)
const people = computed(() =>
  groupRiskOrders(props.data?.orders || [], (o) => [
    { key: o.ownerStaffCode || unknownKey, name: o.ownerStaffName || '业务员待确认' },
  ]),
)
const salesRanking = computed(() =>
  groupRiskOrders(orders.value, (o) => [
    { key: o.ownerStaffCode || unknownKey, name: o.ownerStaffName || '业务员待确认' },
  ]),
)
const productRanking = computed(() =>
  groupRiskOrders(orders.value, (o) =>
    o.products.map((p) => ({
      key: (productMode.value ? p.productId : p.categoryId) || unknownKey,
      name: (productMode.value ? p.productName : p.categoryName) || '待确认',
    })),
  ),
)
const months = computed(() => activeOrderMonths(orders.value, ...props.initialRange))
const matrix = computed(() =>
  groupRiskOrders(orders.value, (o) => [
    { key: o.regionCode || unknownKey, name: o.regionName || '城市待确认' },
  ]).map((city) => ({
    ...city,
    cells: months.value.map((month) => {
      const matching = orders.value.filter(
        (o) => (o.regionCode || unknownKey) === city.key && o.orderDate.startsWith(month),
      )
      const amount = orderAmount(matching)
      return {
        month,
        amount,
        count: matching.length,
        risk: matrixCellRisk(matching),
      }
    }),
  })),
)
const hasFilters = computed(() =>
  Object.values(filters.value).some((v) => (Array.isArray(v) ? v.length : v)),
)
const pagedOrders = computed(() =>
  [...orders.value]
    .sort((a, b) => b.ageDays - a.ageDays || b.orderAmount - a.orderAmount)
    .slice((page.value - 1) * 20, page.value * 20),
)
const dateText = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value))
    : '—'
const asOf = computed(() => dateText(props.data?.generatedAt))
const updated = computed(() =>
  props.data?.dataUpdatedAt
    ? new Date(props.data.dataUpdatedAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
      })
    : '—',
)
interface CategoryNode {
  value: string
  label: string
  children: CategoryNode[]
}
const categoryTree = computed(() => {
  const nodes = new Map(
    (props.data?.categories || []).map((c) => [
      c.id,
      { value: c.id, label: c.name, children: [] } as CategoryNode,
    ]),
  )
  const roots: CategoryNode[] = []
  for (const category of props.data?.categories || []) {
    const node = nodes.get(category.id)!
    const parent =
      category.parentId && category.parentId !== category.id ? nodes.get(category.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  roots.push({ value: unknownKey, label: '分类待确认', children: [] })
  return roots
})
const riskChart = computed<EChartsCoreOption>(() => ({
  animationDuration: 250,
  tooltip: {
    trigger: 'item',
    renderMode: 'richText',
    formatter: '{b}\n订单金额：{c} 万元\n占未结清总额：{d}%',
  },
  graphic: [
    {
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: `{amount|${(total.value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}}{unit|万元}`,
        rich: {
          amount: { fill: '#edf5ff', font: '600 26px sans-serif', verticalAlign: 'bottom' },
          unit: {
            fill: '#bdd0e1',
            font: '14px sans-serif',
            padding: [0, 0, 2, 4],
            verticalAlign: 'bottom',
          },
        },
      },
    },
    {
      type: 'text',
      left: 'center',
      top: '55%',
      style: {
        text: '未收款',
        fill: '#c7d9ea',
        font: '16px sans-serif',
        textAlign: 'center',
        lineHeight: 14,
      },
    },
  ],
  series: [
    {
      type: 'pie',
      radius: ['64%', '88%'],
      center: ['50%', '50%'],
      label: { show: false },
      itemStyle: { borderColor: '#0b1929', borderWidth: 2 },
      data: risks.value
        .filter((r) => r.amount > 0)
        .map((r) => ({
          name: r.name,
          value: r.amount / 10000,
          id: r.key,
          itemStyle: { color: r.color },
        })),
    },
  ],
}))
const productColors = [
  '#13cde1',
  '#ffd144',
  '#ff8c35',
  '#ff555c',
  '#6f8df5',
  '#47c7a6',
  '#c886e7',
  '#9ab2cb',
]
const productColor = (index: number) => productColors[index % productColors.length]
const productChart = computed<EChartsCoreOption>(() => ({
  animationDuration: 250,
  tooltip: {
    trigger: 'item',
    renderMode: 'richText',
    formatter: '{b}\n订单金额：{c} 万元\n占未结清总额：{d}%',
  },
  graphic: [
    {
      type: 'text',
      left: 'center',
      top: '40%',
      style: {
        text: `{amount|${(total.value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}}{unit|万元}`,
        rich: {
          amount: { fill: '#edf5ff', font: '600 26px sans-serif', verticalAlign: 'bottom' },
          unit: {
            fill: '#bdd0e1',
            font: '14px sans-serif',
            padding: [0, 0, 2, 4],
            verticalAlign: 'bottom',
          },
        },
      },
    },
    {
      type: 'text',
      left: 'center',
      top: '55%',
      style: {
        text: '未收款',
        fill: '#c7d9ea',
        font: '16px sans-serif',
        textAlign: 'center',
        lineHeight: 17,
      },
    },
  ],
  series: [
    {
      type: 'pie',
      radius: ['64%', '88%'],
      center: ['50%', '50%'],
      label: { show: false },
      itemStyle: { borderColor: '#0b1929', borderWidth: 1 },
      data: productRanking.value.map((row, index) => ({
        name: row.name,
        value: row.amount / 10000,
        id: row.key,
        itemStyle: { color: productColor(index) },
      })),
    },
  ],
}))
function onProductChartClick(params: unknown) {
  const key = (params as { data?: { id?: string } }).data?.id
  if (key) drillProduct(key)
}
function onRiskChartClick(params: unknown) {
  const name = (params as { name?: string }).name
  const level = riskLevels.find((l) => l.name === name)
  if (level) filters.value.risk = level.key
}
function riskCellStyle(risk: ReturnType<typeof matrixCellRisk>) {
  const level = riskLevels.find((level) => level.key === risk)
  return level ? { backgroundColor: `${level.color}30`, color: level.color } : {}
}
function drillCity(city: string, month: string) {
  filters.value.region = city
  filters.value.month = month
}
function drillProduct(key: string) {
  if (productMode.value) filters.value.product = key
  else {
    filters.value.categories = [key]
    filters.value.product = ''
    productMode.value = true
  }
}
function reset() {
  filters.value = emptyRiskFilters()
  productMode.value = false
}
function resetQuery() {
  start.value = defaultRange[0]
  end.value = defaultRange[1]
  rangeError.value = ''
  reset()
  emit('load', [...defaultRange])
}
function refreshData() {
  emit('load', [...props.initialRange])
}
function reload() {
  if (!start.value || !end.value || start.value > end.value) {
    rangeError.value = '开始月份不能晚于结束月份'
    return
  }
  rangeError.value = ''
  filters.value = {
    ...queryFilters.value,
    categories: [...queryFilters.value.categories],
    month: '',
    product: '',
  }
  emit('load', [start.value, end.value])
}
async function showDetails() {
  detailsOpen.value = true
  await nextTick()
  detailSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function yuan(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
watch(orders, () => {
  page.value = 1
})
</script>

<style scoped>
.payment-risk-board {
  --line: #213b50;
  --muted: #bdd0e1;
  box-sizing: border-box;
  background: #0b1929;
  color: #e9f2fc;
  padding: 16px;
  min-height: 100%;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color-scheme: dark;
  font-size: 14px;
  line-height: 1.4;
}
.payment-risk-board * {
  box-sizing: border-box;
}
.filter-toolbar {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px 16px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.header-actions > button {
  height: 34px;
  padding: 0 10px;
  font-size: 14px;
}
.demo-label {
  color: #39c9e5;
}
.payment-risk-board:fullscreen {
  height: 100vh;
  width: 100vw;
  overflow: auto;
}
.risk-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 0;
  margin: 0;
}
.risk-filters > .dimension-filter,
.risk-filters > .category-filter,
.filter-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b8ccde;
  font-size: 14px;
  white-space: nowrap;
}
.month-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
.month-range > span {
  color: #8faac2;
}
.risk-filters {
  --el-fill-color-blank: #102438;
  --el-bg-color-overlay: #102438;
  --el-fill-color-light: #1d3b54;
  --el-border-color: #304d65;
  --el-border-color-light: #304d65;
  --el-border-color-lighter: #304d65;
  --el-border-color-hover: #6b93b4;
  --el-text-color-regular: #f1f6fc;
  --el-text-color-primary: #e7eff8;
  --el-text-color-placeholder: #c7d9ea;
  --el-text-color-secondary: #a3b9ce;
  --el-color-primary: #268eff;
}
.risk-filters :deep(.el-select__wrapper),
.month-range :deep(.el-input__wrapper) {
  min-height: 34px;
  border-radius: 4px;
  font-size: 14px;
}
.month-range :deep(.el-date-editor.el-input) {
  width: 142px;
  height: 34px;
  --el-input-text-color: #f1f6fc;
}
.category-filter :deep(.el-select) {
  width: 190px;
}
.dimension-filter :deep(.el-select) {
  width: 150px;
}
.owner-filter :deep(.el-select) {
  width: 160px;
}
.risk-filter :deep(.el-select) {
  width: 120px;
}
.risk-filters :deep(.el-select-dropdown__wrap) {
  max-height: 240px;
}
.risk-filters :deep(.el-select-dropdown__item) {
  height: 36px;
  line-height: 36px;
  font-size: 14px;
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.risk-filters :deep(.el-select-dropdown__item.is-selected) {
  font-weight: 600;
  color: #57c7ff;
}
.risk-filters :deep(.el-select-dropdown__empty) {
  font-size: 14px;
  color: #a3b9ce;
}
.category-filter :deep(.el-tree) {
  background: #102438;
  color: #e7eff8;
  --el-tree-node-hover-bg-color: #1d3b54;
}
.category-filter :deep(.el-tree-node__content) {
  height: 36px;
}
.category-filter :deep(.el-tree-node__label) {
  font-size: 14px;
}
.month-range :deep(.risk-month-popper) {
  --el-datepicker-off-text-color: #718aa1;
  --el-datepicker-hover-text-color: #57c7ff;
  --el-datepicker-border-color: #304d65;
  --el-datepicker-inner-border-color: #304d65;
}
.query-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.query-actions button {
  height: 34px;
  padding: 0 12px;
  font-size: 14px;
}
.query-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.icon-button {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}
.header-actions svg,
.query-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.category-filter :deep(.el-tag) {
  --el-tag-bg-color: #183d5e;
  --el-tag-text-color: #e7eff8;
  --el-tag-border-color: #315f7d;
}
button {
  font: inherit;
  cursor: pointer;
  color: inherit;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #4cd8ed;
  outline-offset: 3px;
}
.primary,
.outline {
  border: 1px solid #2b465c;
  border-radius: 4px;
  padding: 9px 14px;
  background: #102438;
  white-space: nowrap;
}
.primary {
  background: #0878ed;
  border-color: #268eff;
  color: #fff;
  font-weight: 600;
}
.primary:hover:not(:disabled) {
  background: #238aff;
}
.outline:hover:not(:disabled) {
  background: #1b3850;
  border-color: #6b93b4;
}
.link {
  background: none;
  border: 0;
  color: #4ec9ff;
  padding: 0;
}
.selection-line {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 14px;
  min-height: 38px;
}
.chip {
  background: #183d5e;
  padding: 4px 7px;
  border-radius: 4px;
}
.chip button {
  background: transparent;
  border: 0;
  margin-left: 7px;
}
.risk-kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 12px 0 20px;
}
.risk-kpis article {
  padding: 0 18px;
  border-right: 1px solid var(--line);
}
.risk-kpis article:first-child {
  padding-left: 12px;
}
.risk-kpis article:last-child {
  border: 0;
}
.risk-kpis h2 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 4px;
}
.risk-kpis strong {
  font-size: clamp(28px, 2.7vw, 46px);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.risk-kpis strong small {
  font-size: 14px;
  font-weight: 400;
  color: var(--muted);
  margin-left: 8px;
}
.risk-kpis p {
  font-size: 14px;
  color: var(--muted);
  margin: 4px 0 0;
}
.cyan {
  color: #24d0e3;
}
.risk-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 12px;
}
.risk-secondary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 12px;
  margin-top: 12px;
}
.risk-panel {
  border: 1px solid var(--line);
  padding: 14px 18px;
  min-width: 0;
}
.section-title {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.section-title h2 {
  font-size: 20px;
  margin: 0;
  font-weight: 600;
}
.section-title p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}
.segmented {
  display: flex;
  white-space: nowrap;
  border: 1px solid #2b465c;
  border-radius: 4px;
  overflow: hidden;
}
.segmented button {
  border: 0;
  background: #102438;
  padding: 8px 14px;
  font-size: 14px;
}
.segmented button.active {
  background: #0878ed;
  color: white;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}
th,
td {
  text-align: right;
  padding: 11px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 16px;
  white-space: nowrap;
}
thead th {
  font-weight: 500;
  color: #cbdbea;
  background: #102438;
}
th:first-child,
td:first-child {
  text-align: left;
}
tbody th {
  font-weight: 400;
}
table button {
  background: none;
  border: 0;
  color: inherit;
  padding: 0;
  text-align: inherit;
  font: inherit;
}
table button:hover {
  color: #65ddf5;
  text-decoration: underline;
}
.matrix-risk-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 14px;
}
.matrix-risk-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.matrix-risk-legend .matrix-unit {
  margin-left: auto;
}
.matrix-risk-legend i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.normal-key i {
  border: 1px solid #668198;
  background: transparent;
}
.matrix-scroll {
  overflow: auto;
  max-height: 390px;
}
.risk-matrix th,
.risk-matrix td {
  border: 1px solid var(--line);
  padding: 9px;
}
.risk-matrix td button {
  display: block;
  width: 100%;
  min-width: 42px;
}
.risk-matrix tbody th button,
.sales-ranking tbody th button {
  font-weight: 700;
  color: #f1f6fc;
}
.risk-matrix tfoot {
  font-weight: 600;
  background: #102438;
}
.total {
  font-weight: 650;
}
.risk-composition {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  align-items: center;
  gap: 6px;
  min-height: 290px;
}
.risk-legend {
  min-width: 0;
}
.legend-heading,
.legend-row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.75fr;
  gap: 9px;
  align-items: center;
  width: 100%;
  font-size: 16px;
}
.legend-heading {
  color: var(--muted);
  margin-bottom: 9px;
  text-align: right;
  font-size: 14px;
}
.legend-heading span:first-child {
  text-align: left;
}
.legend-row {
  border: 0;
  background: none;
  padding: 13px 0;
  text-align: right;
}
.legend-row:hover {
  background: #142e43;
}
.legend-row span:first-child {
  text-align: left;
  white-space: nowrap;
}
.legend-row i {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-right: 6px;
}
.legend-row b {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.panel-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 14px;
}
.amount-key {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.amount-key i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #13cde1;
}
.calculation-notes {
  margin-top: 14px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}
.calculation-notes summary {
  cursor: pointer;
}
.calculation-notes p {
  margin: 8px 0 0;
}
.ranking-scroll {
  max-height: 300px;
  overflow: auto;
}
.ranking th:first-child {
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ranking th,
.ranking td {
  border: 1px solid var(--line);
  padding: 12px;
}
.ranking tbody td {
  font-weight: 600;
}
.product-ranking tbody th {
  font-weight: 600;
}
.sales-ranking td:last-child {
  width: 65%;
}
.share-cell {
  display: flex;
  align-items: center;
  gap: 16px;
}
.share-cell > span:last-child {
  min-width: 48px;
}
.share-track {
  display: block;
  flex: 1;
  min-width: 90px;
  height: 20px;
  background: #16344b;
  border-radius: 2px;
  overflow: hidden;
}
.share-track > span {
  display: block;
  height: 100%;
  background: #13cde1;
  border-radius: 2px;
}
.product-composition {
  display: grid;
  grid-template-columns: minmax(170px, 0.9fr) minmax(0, 2fr);
  gap: 16px;
  align-items: center;
}
.product-ranking th:first-child {
  max-width: 160px;
}
.category-dot {
  display: inline-block;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  margin-right: 9px;
  vertical-align: -3px;
}
.rules {
  margin-top: 12px;
}
.rules .section-title {
  margin-bottom: 12px;
}
.rules th,
.rules td {
  text-align: center;
  padding: 8px 12px;
  border: 1px solid var(--line);
}
.rules table {
  table-layout: fixed;
}
.rules th:first-child {
  text-align: left;
  width: 16%;
}
.rules .low {
  background: #4ade80;
  color: #071a2c;
  font-weight: 600;
}
.rules .medium {
  background: #ffd144;
  color: #071a2c;
  font-weight: 600;
}
.rules .high {
  background: #ff8c35;
  color: #071a2c;
  font-weight: 600;
}
.rules .severe {
  background: #ff555c;
  color: #071a2c;
  font-weight: 600;
}
.state {
  padding: 70px 20px;
  text-align: center;
}
.error {
  color: #ff8990;
}
.empty {
  padding: 18px;
  text-align: center;
  background: #102438;
  color: #a3c7e1;
}
.detail-panel {
  margin-top: 16px;
  scroll-margin-top: 18px;
}
.detail-scroll {
  overflow: auto;
}
.detail-scroll td {
  vertical-align: top;
}
.detail-scroll td:first-child {
  text-align: left;
}
.detail-scroll small {
  display: block;
  color: var(--muted);
  margin-top: 6px;
}
.product-risk {
  display: block;
  margin-bottom: 5px;
}
.product-risk b {
  font-weight: 500;
  margin-left: 8px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  align-items: center;
  margin-top: 16px;
}
footer {
  font-size: 14px;
  color: #8da8c0;
  padding-top: 18px;
}
@media (min-width: 1600px) {
  .risk-composition {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 1200px) {
  .payment-risk-board {
    padding: 20px;
  }
  .risk-main-grid {
    grid-template-columns: 1fr;
  }
  .risk-composition {
    grid-template-columns: 270px 1fr;
    min-height: 260px;
  }
  .risk-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 22px 0;
  }
  .risk-kpis article {
    padding: 0 14px;
  }
  .risk-kpis article:nth-child(3n) {
    border-right: 0;
  }
  .risk-secondary-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .payment-risk-board {
    padding: 14px;
  }
  .risk-kpis {
    grid-template-columns: repeat(2, 1fr);
    gap: 22px 0;
  }
  .risk-kpis article:nth-child(3n) {
    border-right: 1px solid var(--line);
  }
  .risk-kpis article:nth-child(2n) {
    border-right: 0;
  }
  .risk-kpis strong {
    font-size: 30px;
  }
  .risk-kpis h2 {
    font-size: 14px;
  }
  .risk-secondary-grid {
    grid-template-columns: 1fr;
  }
  .risk-panel {
    padding: 14px;
  }
  .section-title h2 {
    font-size: 20px;
  }
  .risk-composition {
    grid-template-columns: 1fr;
  }
  .product-composition {
    grid-template-columns: 1fr;
  }
  .risk-legend {
    padding: 0 8px;
  }
  .share-cell {
    gap: 6px;
  }
  .share-track {
    min-width: 35px;
  }
  .sales-ranking th,
  .sales-ranking td {
    padding: 8px 6px;
  }
  .rules {
    overflow: auto;
  }
  .rules table {
    min-width: 600px;
  }
  .rules th:first-child {
    width: 130px;
  }
  .risk-filters {
    gap: 12px;
  }
  .risk-kpis p {
    line-height: 1.6;
  }
}
</style>
