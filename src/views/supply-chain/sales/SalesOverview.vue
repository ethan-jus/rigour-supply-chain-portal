<template>
  <section class="sales-overview">
    <header class="overview-header">
      <div class="overview-heading">
        <SupplyPageTitle>销售总览</SupplyPageTitle>
        <span>{{ sectionName }}</span>
      </div>
      <div class="overview-filters" aria-label="销售总览筛选">
        <div class="list-filter-field overview-year">
          <el-date-picker
            v-model="year"
            type="year"
            format="YYYY 年"
            value-format="YYYY"
            :clearable="false"
            :disabled-date="futureYear"
            placeholder="年份"
            aria-label="年份"
            @change="changeYear"
          />
        </div>
        <div class="list-filter-field overview-month">
          <el-select v-model="month" aria-label="月份" placeholder="月份">
            <el-option value="all" label="全年" />
            <el-option
              v-for="value in 12"
              :key="value"
              :value="String(value).padStart(2, '0')"
              :label="value + ' 月'"
              :disabled="year === today.slice(0, 4) && value > Number(today.slice(5, 7))"
            />
          </el-select>
        </div>
        <div class="list-filter-group">
          <div class="list-filter-field list-filter-field--select">
            <el-tree-select
              v-model="department"
              :data="departments"
              :props="departmentProps"
              node-key="id"
              check-strictly
              :render-after-expand="false"
              :default-expanded-keys="departments.map((row) => row.id)"
              clearable
              filterable
              placeholder="全部部门"
              aria-label="部门"
              popper-class="order-register-tree-popper"
              @change="employee = ''"
            />
          </div>
          <el-checkbox v-if="department" v-model="includeSubDepartments" @change="employee = ''"
            >含子部门</el-checkbox
          >
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-select
            v-model="employee"
            filterable
            clearable
            placeholder="全部员工"
            aria-label="员工"
          >
            <el-option
              v-for="person in employeeOptions"
              :key="person.code"
              :value="person.code"
              :label="person.name"
            />
          </el-select>
        </div>
      </div>
    </header>

    <div v-if="error" class="overview-panel overview-empty" role="alert">
      {{ error }} <button type="button" class="overview-link" @click="load">重试</button>
    </div>
    <div v-else-if="busy" class="overview-panel overview-empty" role="status">正在读取销售总览</div>
    <template v-else-if="data">
      <div class="overview-top">
        <section
          v-for="card in goalCards"
          :key="card.title"
          class="overview-goal"
          :class="{ 'is-receipts': card.receipts }"
          :aria-label="card.title"
        >
          <header>
            <h2>{{ card.title }}</h2>
            <span>{{ card.note }}</span>
          </header>
          <div class="goal-figure">
            {{ card.goal.percent ?? '—' }}<span v-if="card.goal.percent != null">%</span>
          </div>
          <div class="goal-basis">
            <span>{{ card.actualLabel }} {{ overviewMoney(card.goal.actual) }}</span>
            <span>有效目标 {{ overviewMoney(card.goal.target) }}</span>
          </div>
          <div
            class="goal-progress"
            :role="card.goal.percent == null ? undefined : 'progressbar'"
            :aria-hidden="card.goal.percent == null || undefined"
            :aria-label="card.title"
            :aria-valuenow="card.goal.percent == null ? undefined : card.goal.progress"
            :aria-valuetext="card.goal.percent == null ? undefined : card.goal.percent + '%'"
          >
            <span :style="{ width: card.goal.progress + '%' }" />
          </div>
          <div class="goal-footer">
            <span>{{
              card.status ||
              (card.goal.gap == null ? '尚无可比目标' : '距目标 ' + overviewMoney(card.goal.gap))
            }}</span>
            <span v-if="!card.status && (card.goal.missing || card.goal.zero)">
              <span v-if="card.goal.missing">{{ card.goal.missing }} 人缺目标</span>
              <span v-if="card.goal.missing && card.goal.zero"> · </span>
              <span v-if="card.goal.zero">{{ card.goal.zero }} 人零目标</span>
            </span>
          </div>
        </section>

        <section class="overview-panel overview-followups">
          <h2>主管待跟进</h2>
          <div class="followup-row">
            <div class="followup-text">
              <strong>合同逾期</strong>
              <small>{{
                data.overdueOrders == null
                  ? '应收数据待同步'
                  : data.overdueOrders + ' 笔订单，未收 ' + overviewMoney(data.overdue)
              }}</small>
            </div>
            <router-link
              v-if="canOpen('/supply-chain/sales/risk-cases')"
              class="overview-link"
              :to="{
                name: 'SupplySalesRiskCases',
                query: {
                  ...query,
                  includeSubDepartments: query.includeSubDepartments ? 'true' : undefined,
                  overdue: '1',
                },
              }"
              >看风险</router-link
            >
          </div>
          <div class="followup-row">
            <div class="followup-text">
              <strong>门店下一步</strong><small>按门店查看跟进依据与责任人</small>
            </div>
            <router-link
              v-if="canOpen('/supply-chain/sales/customer-followups')"
              class="overview-link"
              :to="{
                name: 'SupplySalesCustomerFollowups',
                query: { month: query.asOf.slice(0, 7), ownerStaffCode: query.ownerStaffCode },
              }"
              >看跟进</router-link
            >
          </div>
          <div class="followup-row">
            <div class="followup-text">
              <strong>目标差额</strong><small>核对员工目标与核定口径</small>
            </div>
            <router-link
              v-if="canOpen('/supply-chain/sales/performance')"
              class="overview-link"
              :to="performanceLink"
              >看达成</router-link
            >
          </div>
        </section>
      </div>

      <dl class="overview-panel overview-metrics">
        <div v-for="m in metrics" :key="m.label">
          <dt>{{ m.label }}</dt>
          <dd>{{ overviewMoney(m.value) }}</dd>
          <small>{{ m.note }}</small>
        </div>
      </dl>

      <SalesTodayFieldwork
        v-if="canField"
        :department-id="department"
        :include-sub-departments="includeSubDepartments"
        :employee-code="employee"
        :can-open-report="canOpen('/supply-chain/sales')"
      />

      <section class="overview-panel overview-orders">
        <header class="panel-heading">
          <h2>经营业绩</h2>
          <router-link
            v-if="data.canSeeCompanyCash && canOpen('/supply-chain/bi/receivables')"
            class="overview-link"
            :to="{ name: 'SupplyBiReceivables', query: { from: query.from, asOf: query.asOf } }"
            >查看公司到账</router-link
          >
        </header>
        <div class="overview-tabs" role="group" aria-label="经营业绩视图">
          <button
            v-for="view in views"
            :key="view.value"
            :aria-pressed="tab === view.value"
            type="button"
            @click="tab = view.value"
          >
            {{ view.label }}
          </button>
        </div>
        <template v-if="tab === 'people'">
          <div class="overview-table overview-employee-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">员工</th>
                  <th scope="col">城市</th>
                  <th scope="col" class="amount">下单金额</th>
                  <th scope="col" class="amount">订单目标</th>
                  <th scope="col" class="amount">订单差额</th>
                  <th scope="col" class="amount receipt-start">本期回款</th>
                  <th scope="col" class="amount">回款目标</th>
                  <th scope="col" class="amount">回款达成</th>
                  <th scope="col" class="amount">归属核销</th>
                  <th scope="col" class="amount">未收余额</th>
                  <th scope="col" aria-label="操作"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(person, i) in visiblePeople" :key="person.code ?? 'unassigned'">
                  <td>
                    <span class="overview-person">
                      <span
                        class="overview-initial"
                        :class="{ 'is-alt': i % 2 }"
                        aria-hidden="true"
                        >{{ person.name.slice(-1) }}</span
                      >
                      <strong>{{ person.name }}</strong>
                    </span>
                  </td>
                  <td>{{ person.city || '—' }}</td>
                  <td class="amount">{{ overviewMoney(person.booked) }}</td>
                  <td class="amount">{{ overviewMoney(person.target) }}</td>
                  <td class="amount">{{ targetGap(person) }}</td>
                  <td class="amount receipt-start">{{ overviewMoney(person.received) }}</td>
                  <td class="amount">{{ overviewMoney(person.receiptTarget) }}</td>
                  <td class="amount">{{ receiptRate(person) }}</td>
                  <td class="amount">{{ overviewMoney(person.applied) }}</td>
                  <td class="amount">{{ overviewMoney(person.outstanding) }}</td>
                  <td class="detail-cell">
                    <button
                      v-if="person.code"
                      type="button"
                      class="overview-link"
                      :aria-label="person.name + '的经营明细'"
                      @click="selected = person"
                    >
                      明细
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!data.people.length" class="overview-empty">该范围暂无销售业绩</p>
          <ListTableFooter v-if="data.people.length > overviewPageSize">
            <CompactPagination
              v-model:current-page="peoplePage"
              :page-size="overviewPageSize"
              :page-sizes="[overviewPageSize]"
              :total="data.people.length"
            />
          </ListTableFooter>
        </template>
        <SalesOverviewDetails v-else :kind="tab" :query="query" />
      </section>
      <details class="overview-method">
        <summary>口径说明</summary>
        <p>
          下单按订单日归属。经营回款按实际到账日与已确认的回款归属统计，部分到账可计入。
          归属核销按核销生效日、订单归属统计；未收与合同逾期取截至日余额。
        </p>
        <p>
          订单和回款目标取 HR
          生效值。全年合计所查期间各月目标。团队达成率只比较有实绩数据和正目标的员工。
          薪酬用的回款业绩按首次整单结清月计算。今日外勤按北京时间统计。
        </p>
        <p v-if="data.financeAsOf">资金数据截至 {{ displayDateTime(data.financeAsOf) }}。</p>
      </details>
    </template>

    <el-drawer
      :model-value="!!selected"
      :title="selected ? selected.name + '的经营明细' : '经营明细'"
      size="min(680px, 100vw)"
      destroy-on-close
      @close="selected = null"
    >
      <template v-if="selected && selected.code">
        <dl class="detail-totals">
          <div>
            <dt>期间</dt>
            <dd>{{ year }} 年{{ month === 'all' ? '' : ' ' + periodLabel }}</dd>
          </div>
          <div>
            <dt>本期下单</dt>
            <dd>{{ overviewMoney(selected.booked) }}</dd>
          </div>
          <div>
            <dt>本期回款</dt>
            <dd>{{ overviewMoney(selected.received) }}</dd>
          </div>
          <div>
            <dt>回款目标</dt>
            <dd>{{ overviewMoney(selected.receiptTarget) }}</dd>
          </div>
          <div>
            <dt>本期核销</dt>
            <dd>{{ overviewMoney(selected.applied) }}</dd>
          </div>
          <div>
            <dt>期末未收</dt>
            <dd>{{ overviewMoney(selected.outstanding) }}</dd>
          </div>
        </dl>
        <SalesOverviewDetails kind="ORDERS" :query="employeeQuery" />
        <router-link
          v-if="canOpen('/supply-chain/sales/performance')"
          class="overview-link"
          :to="{ ...performanceLink, query: { ...performanceLink.query, employee: selected.code } }"
          >核对绩效</router-link
        >
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { businessDate, businessMonthRange, displayDateTime } from '@/utils/business-date'
import { departmentTree } from '@/utils/hr-department-tree'
import {
  getSalesOverview,
  type SalesOverview,
  type SalesOverviewEmployee,
  type SalesOverviewQuery,
} from '@/api/core/sales-overview'
import SalesOverviewDetails from './SalesOverviewDetails.vue'
import SalesTodayFieldwork from './SalesTodayFieldwork.vue'
import {
  overviewMoney,
  overviewPageSize,
  overviewRate,
  summarizeOverviewGoal,
} from './sales-overview-model'

const auth = useAuthStore()
const nav = useNavigationStore()
const canOpen = (path: string) => nav.hasPath('SUPPLY_CHAIN', path)
const canField = computed(() => auth.hasPermission('sales:dashboard:read'))
const sectionName = computed(() => {
  const module = nav
    .getNavigation('SUPPLY_CHAIN')
    .find((node) => node.code === 'SUPPLY_CHAIN.MENU.SALES')
  return (
    module?.children.find((group) =>
      group.children.some((page) => page.routePath === '/supply-chain/sales/overview'),
    )?.displayName || '团队经营'
  )
})

const today = businessDate(new Date())
const year = ref(today.slice(0, 4)),
  month = ref(today.slice(5, 7))
const department = ref<number>(),
  includeSubDepartments = ref(true),
  employee = ref('')
const departmentProps = { value: 'id', label: 'departmentName', children: 'children' }
const departments = ref<ReturnType<typeof departmentTree<SalesOverview['departments'][number]>>>([])
const employeeOptions = ref<SalesOverview['employees']>([])
const futureYear = (date: Date) => date.getFullYear() > Number(today.slice(0, 4))
function changeYear() {
  if (year.value === today.slice(0, 4) && month.value > today.slice(5, 7)) month.value = 'all'
}
const query = computed<SalesOverviewQuery>(() => {
  const range =
    month.value === 'all'
      ? [year.value + '-01-01', year.value + '-12-31']
      : businessMonthRange(year.value + '-' + month.value)
  return {
    from: range[0]!,
    asOf: range[1]! > today ? today : range[1]!,
    departmentId: department.value || undefined,
    includeSubDepartments: department.value ? includeSubDepartments.value : undefined,
    ownerStaffCode: employee.value || undefined,
  }
})
const periodLabel = computed(() =>
  month.value === 'all' ? year.value + ' 年' : Number(month.value) + ' 月',
)
const performanceLink = computed(() => ({
  name: 'SupplySalesPerformance',
  query: { month: query.value.asOf.slice(0, 7), employee: employee.value || undefined },
}))
const views = [
  { value: 'people', label: '按员工' },
  { value: 'PRODUCTS', label: '按商品' },
  { value: 'APPLICATIONS', label: '核销明细' },
] as const
const tab = ref<(typeof views)[number]['value']>('people')
const peoplePage = ref(1)
const selected = ref<SalesOverviewEmployee | null>(null)
const employeeQuery = computed<SalesOverviewQuery>(() => ({
  ...query.value,
  ownerStaffCode: selected.value?.code || undefined,
}))

const data = ref<SalesOverview>()
const visiblePeople = computed(() => {
  const start = (peoplePage.value - 1) * overviewPageSize
  return data.value?.people.slice(start, start + overviewPageSize) ?? []
})
const busy = ref(true),
  error = ref('')
let active: AbortController | undefined
async function load() {
  active?.abort()
  const current = new AbortController()
  active = current
  data.value = undefined
  peoplePage.value = 1
  selected.value = null
  error.value = ''
  busy.value = true
  try {
    const result = await getSalesOverview(query.value, current.signal)
    if (current.signal.aborted) return
    departments.value = departmentTree(result.departments)
    employeeOptions.value = result.employees
    data.value = result
  } catch (e) {
    if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '销售总览读取失败'
  } finally {
    if (!current.signal.aborted) busy.value = false
  }
}

watch(
  () => [auth.user?.tenantId, auth.user?.id, auth.user?.permissions],
  () => {
    departments.value = []
    employeeOptions.value = []
    department.value = undefined
    employee.value = ''
    void load()
  },
  { deep: true },
)
watch(query, load, { immediate: true })
onBeforeUnmount(() => active?.abort())

const staff = computed(() => data.value?.people.filter((p) => p.code) ?? [])
const goalCards = computed(() => [
  {
    title: '订单目标达成',
    actualLabel: '可比订单额',
    note: staff.value.length + ' 位员工',
    receipts: false,
    status: data.value?.targetsAvailable ? '' : '人事指标待同步',
    goal: summarizeOverviewGoal(staff.value.map((p) => ({ actual: p.booked, target: p.target }))),
  },
  {
    title: '回款目标达成',
    actualLabel: '可比回款额',
    note: '按实际到账日',
    receipts: true,
    status:
      data.value?.received == null
        ? '回款数据待同步'
        : data.value.targetsAvailable
          ? ''
          : '人事指标待同步',
    goal: summarizeOverviewGoal(
      staff.value.map((p) => ({ actual: p.received, target: p.receiptTarget })),
    ),
  },
])
const metrics = computed(() => [
  {
    label: month.value === 'all' ? '本年下单' : '当月下单',
    value: data.value?.booked,
    note: '按下单日',
  },
  { label: '本期回款', value: data.value?.received, note: '按到账日与回款归属' },
  { label: '归属订单核销', value: data.value?.applied, note: '按核销生效日' },
  {
    label: '期末未收',
    value: data.value?.outstanding,
    note:
      query.value.asOf === today
        ? '截至 ' + today.slice(5)
        : month.value === 'all'
          ? '按年末余额'
          : '按月末余额',
  },
  { label: '其中合同逾期', value: data.value?.overdue, note: '按约定到期日' },
])
function targetGap(person: SalesOverviewEmployee) {
  if (!person.code) return '—'
  if (!data.value?.targetsAvailable) return '待同步'
  if (person.target == null)
    return month.value === 'all' ? '缺 ' + person.missingTargetMonths + ' 月目标' : '待设'
  if (person.target === 0) return '零目标'
  return overviewMoney(Math.max(0, person.target - person.booked))
}
function receiptRate(person: SalesOverviewEmployee) {
  if (!person.code || data.value?.received === undefined) return '—'
  if (!data.value?.targetsAvailable) return '待同步'
  if (person.receiptTarget == null)
    return month.value === 'all' && person.missingReceiptTargetMonths != null
      ? '缺 ' + person.missingReceiptTargetMonths + ' 月目标'
      : '待设'
  if (person.receiptTarget === 0) return '零目标'
  const rate = overviewRate(person.received, person.receiptTarget)
  return rate == null ? '—' : rate + '%'
}
</script>

<style scoped lang="scss" src="./sales-overview-table.scss"></style>
<style scoped lang="scss" src="./sales-overview.scss"></style>
