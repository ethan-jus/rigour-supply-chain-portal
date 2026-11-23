<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>{{ risk ? '回款风险' : '回款与应收' }}</SupplyPageTitle>
      <small v-if="data"
        >数据更新于 {{ businessDateTime(data.projectedAt) }} · 版本
        {{ data.version?.slice(0, 8) }}</small
      >
    </header>
    <OrderRegisterFilterCard
      class="order-register-filter--compact"
      :loading="busy"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <div class="list-filter-field list-filter-field--date-range">
          <el-date-picker
            v-model="dates"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="统计起日"
            end-placeholder="余额截至日"
            aria-label="统计期间及余额截至日"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select v-model="city" clearable filterable aria-label="城市" placeholder="城市"
            ><el-option
              v-for="v in options?.regions"
              :key="v.optionValue"
              :label="v.optionLabel"
              :value="v.optionValue"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-select v-model="owner" clearable filterable aria-label="业务员" placeholder="业务员"
            ><el-option
              v-for="v in options?.salesOwners"
              :key="v.optionValue"
              :label="v.optionLabel"
              :value="v.optionValue"
          /></el-select>
        </div>
        <el-tag v-if="customer" closable @close="clearCustomer">{{ customer.name }}</el-tag>
      </template>
    </OrderRegisterFilterCard>
    <div v-if="companyReport" class="report-versions">
      <el-select
        v-model="archived"
        aria-label="数据版本"
        placeholder="当前重述版"
        clearable
        @visible-change="listVersions"
        @change="load"
      >
        <el-option
          v-for="v in revisions"
          :key="v.version"
          :label="businessDateTime(v.archivedAt) + ' · ' + v.version.slice(0, 8)"
          :value="v.version"
        /> </el-select
      ><el-button v-if="!risk && !archived && canArchive" @click="freeze" :loading="archiving"
        ><SupplyActionLabel code="analytics:receivables:archive" fallback="归档"
      /></el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="busy" :aria-busy="busy">
      <template v-if="data">
        <div class="stat-grid">
          <article v-for="card in cards" :key="card.label">
            <span>{{ card.label }}</span
            ><strong>{{ money(card.value) }}</strong
            ><small>{{ card.note }}</small>
          </article>
        </div>
        <section class="finance-panel" v-if="risk">
          <header>
            <h2>应收到期分布</h2>
            <span
              >逾期率
              {{
                percent(data.totals.overdue, data.totals.outstanding - data.totals.missingDue)
              }}</span
            >
          </header>
          <div class="age-bands">
            <button
              v-for="b in data.aging"
              :key="b.code"
              :aria-pressed="band === b.code"
              @click="filterBand(b.code)"
            >
              <span>{{ agingLabels[b.code] }}</span
              ><b>{{ money(b.amount) }}</b
              ><i
                :style="{
                  width:
                    (data.totals.outstanding ? (b.amount / data.totals.outstanding) * 100 : 0) +
                    '%',
                }"
              />
            </button>
          </div>
          <small
            >逾期率分母为已知合同到期日的未收余额。未结清订单原额
            {{ money(data.totals.openOrderAmount) }} 元。</small
          >
        </section>
        <section v-else class="finance-panel">
          <h2>期间收支与应收余额</h2>
          <dl>
            <template v-for="[k, v] in bridge" :key="k"
              ><div>
                <dt>{{ k }}</dt>
                <dd>{{ money(v) }}</dd>
              </div></template
            >
          </dl>
          <el-alert
            v-if="Math.abs(difference) > 0.00001"
            type="warning"
            :closable="false"
            :title="'应收勾稽差异 ' + money(difference) + ' 元，需核对期初、调整或超额核销'"
          />
          <small v-if="!data.completeCashScope"
            >当前按可见订单的核销份额统计，可查看授权范围内的已归单资金。</small
          >
        </section>
        <section class="finance-panel">
          <el-tabs v-model="tab" @tab-change="changeTab">
            <el-tab-pane v-if="!risk" label="到账与退款" name="receipts" />
            <el-tab-pane :label="risk ? '跟款队列' : '订单余额'" name="balances" />
            <el-tab-pane v-if="!risk" label="按资金来源" name="sources" />
            <el-tab-pane label="按客户核对" name="customers" />
            <el-tab-pane v-if="!risk" label="核销明细" name="applications" />
          </el-tabs>
          <el-tag v-if="tab === 'balances' && band" closable @close="filterBand(band)">{{
            agingLabels[band]
          }}</el-tag>
          <div class="queue-filters" v-if="risk && tab === 'balances'">
            <el-select
              v-model="collector"
              clearable
              filterable
              placeholder="跟款人"
              aria-label="跟款人筛选"
              @change="turn(1)"
              ><el-option
                v-for="v in options?.salesOwners"
                :key="v.optionValue"
                :label="v.optionLabel"
                :value="v.optionValue"
            /></el-select>
            <el-select
              v-model="dispute"
              clearable
              placeholder="争议状态"
              aria-label="争议状态"
              @change="turn(1)"
              ><el-option label="有争议" value="yes" /><el-option label="已核无争议" value="no"
            /></el-select>
          </div>
          <el-table v-if="tab === 'balances'" :data="data.balances" empty-text="该范围没有未收余额">
            <el-table-column label="订单号" min-width="160"
              ><template #default="{ row }"
                ><router-link v-if="canReadOrder" :to="orderLink(row.orderNo)">{{
                  row.orderNo
                }}</router-link
                ><span v-else>{{ row.orderNo }}</span></template
              ></el-table-column
            >
            <el-table-column label="客户" min-width="145"
              ><template #default="{ row }">{{
                row.customer || row.customerId || '待认领'
              }}</template></el-table-column
            >
            <el-table-column prop="installment" label="期次" width="66" />
            <el-table-column label="剩余应收" min-width="110" align="right"
              ><template #default="{ row }">{{ money(row.remaining) }}</template></el-table-column
            >
            <el-table-column label="订单原额" min-width="110" align="right"
              ><template #default="{ row }">{{ money(row.original) }}</template></el-table-column
            >
            <el-table-column label="订单累计已抵" min-width="120" align="right"
              ><template #default="{ row }">{{ money(row.paid) }}</template></el-table-column
            >
            <el-table-column label="到期日" min-width="112"
              ><template #default="{ row }">{{ row.dueDate || '待核' }}</template></el-table-column
            >
            <el-table-column label="逾期天数" width="96"
              ><template #default="{ row }">{{
                row.overdueDays == null ? '待核' : Math.max(0, row.overdueDays)
              }}</template></el-table-column
            >
            <el-table-column label="订单归属" min-width="90"
              ><template #default="{ row }">{{
                row.owner || row.employeeCode || '待核'
              }}</template></el-table-column
            ><el-table-column label="城市" min-width="90"
              ><template #default="{ row }">{{
                row.region || row.regionCode || '待核'
              }}</template></el-table-column
            >
            <template v-if="risk">
              <el-table-column label="跟款人" min-width="95"
                ><template #default="{ row }">{{
                  row.followOwner || '待分派'
                }}</template></el-table-column
              >
              <el-table-column label="承诺还款日" min-width="110"
                ><template #default="{ row }">{{
                  row.promisedOn || '未登记'
                }}</template></el-table-column
              >
              <el-table-column label="争议" width="80"
                ><template #default="{ row }">{{
                  row.disputed == null ? '未核实' : row.disputed ? '有争议' : '无争议'
                }}</template></el-table-column
              >
              <el-table-column label="最近跟进" min-width="160" show-overflow-tooltip
                ><template #default="{ row }">{{
                  row.followedAt
                    ? businessDateTime(row.followedAt) + ' ' + (row.followNote || '')
                    : '暂无记录'
                }}</template></el-table-column
              >
              <el-table-column label="下次跟进" min-width="150"
                ><template #default="{ row }">{{
                  row.nextDue ? businessDateTime(row.nextDue) : '—'
                }}</template></el-table-column
              >
            </template>
            <el-table-column v-if="risk && canAct" label="操作" width="85"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="follow(row as Balance)"
                  >跟进</el-button
                ></template
              ></el-table-column
            >
          </el-table>
          <template v-else-if="tab === 'sources'">
            <el-radio-group v-model="cashDimension" aria-label="资金汇总维度"
              ><el-radio-button value="CHANNEL">收款渠道</el-radio-button
              ><el-radio-button value="PAYEE">凭据收款方</el-radio-button
              ><el-radio-button value="COLLECTOR">流水跟款归属</el-radio-button></el-radio-group
            >
            <el-table
              :data="(data.cashGroups || []).filter((g) => g.dimension === cashDimension)"
              empty-text="期间没有已核实流水"
              ><el-table-column prop="label" label="归属" min-width="130" /><el-table-column
                v-for="[key, label] in cashColumns"
                :key="key"
                :label="label"
                align="right"
                ><template #default="{ row }">{{ money(row[key]) }}</template></el-table-column
              ></el-table
            >
          </template>
          <el-table
            v-else-if="tab === 'customers'"
            :data="data.customers"
            empty-text="暂无客户资金记录"
          >
            <el-table-column label="客户" min-width="140"
              ><template #default="{ row }"
                ><el-button
                  v-if="row.id"
                  link
                  type="primary"
                  @click="chooseCustomer({ id: row.id, name: row.name })"
                  >{{ row.name || row.id }}</el-button
                ><span v-else>客户待认领</span></template
              ></el-table-column
            >
            <el-table-column
              v-for="[key, label] in customerColumns"
              :key="key"
              :label="label"
              min-width="110"
              align="right"
              ><template #default="{ row }">{{
                money(key === 'unapplied' && !data.completeCashScope ? null : row[key])
              }}</template></el-table-column
            >
          </el-table>
          <el-table
            v-else-if="tab === 'receipts'"
            :data="data.receipts"
            empty-text="期间无到账或退款记录"
          >
            <el-table-column
              prop="reference"
              label="流水或凭据号"
              min-width="170"
            /><el-table-column prop="date" label="业务日" width="112" />
            <el-table-column label="客户" min-width="130"
              ><template #default="{ row }">{{
                row.customer || row.customerId || '待认领'
              }}</template></el-table-column
            >
            <el-table-column label="方向" width="80"
              ><template #default="{ row }">{{
                row.kind === 'REFUND' ? '退款' : '到账'
              }}</template></el-table-column
            >
            <el-table-column label="证据状态" width="100"
              ><template #default="{ row }">{{
                row.verified ? '已核实' : '待核实'
              }}</template></el-table-column
            >
            <el-table-column
              v-for="[key, label] in receiptColumns"
              :label="label"
              :key="key"
              min-width="110"
              align="right"
              ><template #default="{ row }">{{
                money(key === 'available' && !data.completeCashScope ? null : row[key])
              }}</template></el-table-column
            >
            <el-table-column label="收款渠道" min-width="110"
              ><template #default="{ row }">{{ row.channel || '待核' }}</template></el-table-column
            >
            <el-table-column label="凭据收款方" min-width="140" show-overflow-tooltip
              ><template #default="{ row }">{{ row.payee || '待核' }}</template></el-table-column
            >
            <el-table-column label="流水跟款归属" min-width="110"
              ><template #default="{ row }">{{
                row.ownerCode || '待核'
              }}</template></el-table-column
            >
            <el-table-column label="核实时间" min-width="150"
              ><template #default="{ row }">{{
                row.verifiedAt ? businessDateTime(row.verifiedAt) : '未记录'
              }}</template></el-table-column
            >
          </el-table>
          <el-table v-else :data="data.applications" empty-text="期间无生效核销">
            <el-table-column prop="reference" label="来源流水" min-width="160" /><el-table-column
              prop="date"
              label="核销生效日"
              width="120"
            />
            <el-table-column label="订单号" min-width="155"
              ><template #default="{ row }"
                ><router-link v-if="canReadOrder" :to="orderLink(row.orderNo)">{{
                  row.orderNo
                }}</router-link
                ><span v-else>{{ row.orderNo }}</span></template
              ></el-table-column
            >
            <el-table-column label="分配金额" align="right"
              ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
            >
          </el-table>
          <ListTableFooter v-if="tab !== 'sources'"
            ><template #actions
              ><el-button
                v-if="risk && tab === 'balances'"
                :loading="exporting"
                :disabled="!data.balanceCount"
                @click="download"
                >导出明细</el-button
              ></template
            ><CompactPagination
              :current-page="page"
              :page-size="size"
              :total="total"
              @current-change="turn"
              @size-change="resize"
          /></ListTableFooter>
        </section> </template
      ><el-skeleton v-else-if="busy" :rows="4" animated />
    </div>
    <el-drawer v-model="drawer" title="回款跟进" size="min(760px, 95vw)" destroy-on-close
      ><BiOperationsWorkbench
        v-if="drawer"
        kind="COLLECTION"
        :action-seed="seed"
        :region-code="query?.regionCode"
        :owner-staff-code="query?.ownerStaffCode"
        @open-business="drawer = false"
        @changed="load"
    /></el-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import {
  getReceivables,
  getArchivedReport,
  getReportRevisions,
  archiveReport,
  type ReportRevision,
  agingLabels,
  type Balance,
  type ReceivableQuery,
  type ReceivablesReport,
} from '@/api/core/receivables'
import { getSupplyDashboardFilterOptions, type SupplyDashboardFilterOptions } from '@/api/core/bi'
import type { BiActionSeed } from '@/api/core/bi-operations'
import { useAuthStore } from '@/stores/auth'
import {
  businessDateTime,
  businessPeriodRange,
  businessMonthRange,
  businessDate,
} from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import BiOperationsWorkbench from './components/BiOperationsWorkbench.vue'
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'
import { ElMessageBox, ElMessage } from 'element-plus'
const archived = ref(''),
  revisions = ref<ReportRevision[]>([]),
  archiving = ref(false)
const route = useRoute(),
  auth = useAuthStore()
const risk = computed(() => route.meta.dashboardSection === 'payment-risk')
const dates = ref<[string, string] | null>(businessPeriodRange('month')),
  city = ref(''),
  owner = ref(''),
  customer = ref<{ id: string; name: string } | null>(null)
const options = ref<SupplyDashboardFilterOptions>(),
  data = ref<ReceivablesReport>(),
  busy = ref(false),
  error = ref(''),
  band = ref(''),
  tab = ref(risk.value ? 'balances' : 'receipts')
const companyReport = computed(
  () =>
    data.value?.completeCashScope &&
    query.value &&
    !query.value.customerId &&
    !query.value.regionCode &&
    !query.value.ownerStaffCode,
)
const canArchive = computed(() => auth.hasPermission('analytics:receivables:archive'))
async function listVersions(open: boolean) {
  const q = query.value
  if (!open || !q) return
  try {
    const v = await getReportRevisions(q.from, q.asOf)
    if (query.value === q) revisions.value = v
  } catch (e) {
    error.value = e instanceof Error ? e.message : '版本读取失败'
  }
}
async function freeze() {
  const q = query.value
  if (!q || archiving.value) return
  try {
    await ElMessageBox.confirm('归档 ' + q.from + ' 至 ' + q.asOf + ' 的公司资金报表？', '归档')
    archiving.value = true
    const version = await archiveReport(q.from, q.asOf)
    if (q !== query.value) return
    archived.value = version
    await listVersions(true)
    await load()
    ElMessage.success('已归档')
  } catch (e) {
    if (e instanceof Error) error.value = e.message
  } finally {
    archiving.value = false
  }
}
function readReport(q: ReceivableQuery, signal?: AbortSignal) {
  return archived.value ? getArchivedReport(archived.value, q, signal) : getReceivables(q, signal)
}
const page = ref(1),
  size = ref(50),
  seed = ref<BiActionSeed | null>(null),
  drawer = ref(false),
  exporting = ref(false)
const canAct = computed(() => auth.hasPermission('analytics:operations:write'))
const money = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = (a: number, b: number) => (b > 0 ? ((100 * a) / b).toFixed(1) + '%' : '—')
const cards = computed(() => {
  const t = data.value!.totals
  return (
    risk.value
      ? [
          ['应收未收', t.outstanding, '截至所选期末'],
          ['已逾期未收', t.overdue, '已过合同到期日'],
          ['未来 7 天到期', t.dueSoon, '含截至日当天'],
          ['到期日待核', t.missingDue, '尚缺有效账期'],
        ]
      : [
          ['本期实际到账', t.receipts, '按可信到账凭据'],
          [
            '累计实际到账',
            t.cumulativeReceipts,
            '首笔可核实资金 ' + (data.value!.coverageStart || '—'),
          ],
          ['期末应收未收', t.outstanding, '含以前期间余额'],
          ['到账待核销', t.unapplied, '截至所选期末'],
        ]
  ).map(([label, value, note]) => ({ label: String(label), value: value as number | null, note }))
})
const bridge = computed<[string, number][]>(() => {
  const t = data.value!.totals
  return [
    ['期初未收', t.opening],
    ['新增应收', t.newReceivables],
    ['调整及期初补录', t.adjustments],
    ['有效核销', t.applied],
    ['期末未收', t.outstanding],
    ['本期退付', t.refunds],
    ['本期净到账', t.net],
    ['累计净到账', t.cumulativeNet],
    ['业务登记待核', t.pending],
  ]
})
const difference = computed(() => {
  const t = data.value!.totals
  return t.opening + t.newReceivables + t.adjustments - t.applied - t.outstanding
})
const customerColumns = [
  ['receipts', '本期到账'],
  ['cumulativeReceipts', '累计到账'],
  ['unpaid', '期末未收'],
  ['overdue', '已逾期'],
  ['unapplied', '待核销'],
] as const
const receiptColumns = [
  ['amount', '金额'],
  ['allocated', '已核销'],
  ['available', '待核销'],
] as const
const collector = ref(''),
  dispute = ref(''),
  cashDimension = ref('CHANNEL')
const cashColumns = [
  ['received', '期间到账'],
  ['refunded', '期间退付'],
  ['net', '期间净到账'],
] as const
const queueFilter = () => ({
  collector: collector.value || undefined,
  disputed: dispute.value ? dispute.value === 'yes' : undefined,
})
const total = computed(() =>
  !data.value
    ? 0
    : {
        balances: data.value.balanceCount,
        customers: data.value.customerCount,
        receipts: data.value.receiptCount,
        applications: data.value.applicationCount,
        sources: 0,
      }[tab.value] || 0,
)
const canReadOrder = computed(() =>
  useNavigationStore().hasPath('SUPPLY_CHAIN', '/supply-chain/order/sales-orders'),
)
const orderLink = (orderNo: string) => ({
  path: '/supply-chain/order/sales-orders',
  query: { orderNo },
})
function follow(row: Balance) {
  seed.value = {
    kind: 'COLLECTION',
    businessRef: 'order-id:' + row.orderId,
    businessLabel: row.orderNo,
    cityCode: row.regionCode,
    employeeCode: row.employeeCode,
    assignee: row.followOwner || row.employeeCode,
  }
  drawer.value = true
}
let active: AbortController | undefined
const query = ref<ReceivableQuery>()
async function load() {
  active?.abort()
  if (!query.value) return
  const token = new AbortController()
  active = token
  busy.value = true
  error.value = ''
  data.value = undefined
  try {
    const r = await readReport(
      {
        ...query.value,
        page: page.value,
        size: size.value,
        aging: band.value || undefined,
        ...queueFilter(),
      },
      token.signal,
    )
    if (!token.signal.aborted) data.value = r
  } catch (e) {
    if (!token.signal.aborted) error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    if (!token.signal.aborted) busy.value = false
  }
}
function search() {
  archived.value = ''
  revisions.value = []
  if (!dates.value) {
    error.value = '请选择统计期间'
    return
  }
  page.value = 1
  query.value = {
    from: dates.value[0],
    asOf: dates.value[1],
    regionCode: city.value || undefined,
    ownerStaffCode: owner.value || undefined,
    customerId: customer.value?.id,
    page: 1,
    size: size.value,
  }
  void load()
}
function reset() {
  dates.value = businessPeriodRange('month')
  city.value = ''
  owner.value = ''
  collector.value = ''
  dispute.value = ''
  customer.value = null
  band.value = ''
  search()
}
function clearCustomer() {
  customer.value = null
  search()
}
function chooseCustomer(row: { id: string; name: string }) {
  customer.value = row
  tab.value = 'balances'
  search()
}
function turn(v: number) {
  page.value = v
  void load()
}
function resize(v: number) {
  size.value = v
  turn(1)
}
function changeTab() {
  if (page.value !== 1) turn(1)
}
function filterBand(v: string) {
  band.value = band.value === v ? '' : v
  tab.value = 'balances'
  turn(1)
}
async function download() {
  if (!data.value || !query.value) return
  const stamp = data.value.version,
    count = data.value.balanceCount,
    filters = { ...query.value, aging: band.value || undefined, ...queueFilter() }
  exporting.value = true
  try {
    const { default: ExcelJS } = await import('exceljs')
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet('逾期及未收明细')
    sheet.addRow([
      '订单号',
      '客户',
      '期次',
      '订单原额',
      '本期应收',
      '订单累计已抵',
      '剩余未收',
      '合同到期日',
      '到期依据',
      '逾期天数',
      '订单归属',
      '跟款人',
      '承诺还款日',
      '争议',
      '最近跟进',
      '处理记录',
      '下次跟进',
    ])
    for (let n = 1; n <= Math.ceil(count / 200); n++) {
      const r = await readReport({ ...filters, page: n, size: 200 })
      if (r.version !== stamp || r.balanceCount !== count) throw Error('数据已刷新，请重新导出')
      r.balances.forEach((b) =>
        sheet.addRow([
          b.orderNo,
          b.customer,
          b.installment,
          b.original,
          b.installmentAmount,
          b.paid,
          b.remaining,
          b.dueDate,
          b.dueSource,
          b.overdueDays == null ? null : Math.max(0, b.overdueDays),
          b.owner || b.employeeCode,
          b.followOwner,
          b.promisedOn,
          b.disputed == null ? '未核实' : b.disputed ? '有争议' : '无争议',
          b.followedAt,
          b.followNote,
          b.nextDue,
        ]),
      )
    }
    sheet.columns.forEach((c) => (c.width = 18))
    const url = URL.createObjectURL(new Blob([new Uint8Array(await book.xlsx.writeBuffer())]))
    const a = document.createElement('a')
    a.href = url
    a.download = '回款风险-' + filters.asOf + '.xlsx'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导出失败'
  } finally {
    exporting.value = false
  }
}
watch(
  () => [route.path, route.query.regionCode, route.query.ownerStaffCode, route.query.month,
    route.query.from, route.query.asOf],
  () => {
    const month = String(route.query.month || '')
    const from = String(route.query.from || ''), asOf = String(route.query.asOf || '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
        && from <= asOf && asOf <= businessDate(new Date())) {
      dates.value = [from, asOf]
    } else if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      const r = businessMonthRange(month)
      dates.value = [r[0], r[1] < businessDate(new Date()) ? r[1] : businessDate(new Date())]
    }
    city.value = String(route.query.regionCode || '')
    owner.value = String(route.query.ownerStaffCode || '')
    tab.value = risk.value ? 'balances' : 'receipts'
    search()
  },
  { immediate: true },
)
void getSupplyDashboardFilterOptions()
  .then((v) => {
    options.value = v
  })
  .catch(() => {})
onBeforeUnmount(() => active?.abort())
</script>
<style scoped lang="scss" src="./finance-report.scss"></style>
