<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>{{ personal ? '薪酬核对' : '销售薪酬看板' }}</SupplyPageTitle>
    </header>
    <div class="report-filters">
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        :clearable="false"
        aria-label="工资所属月"
      />
      <el-input
        v-if="!personal"
        v-model="term"
        clearable
        placeholder="员工、工号、部门或城市"
        aria-label="筛选员工"
      />
      <el-button :loading="busy" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error" type="error" :closable="false" :title="error" />
    <el-skeleton v-if="busy" :rows="5" animated />
    <el-empty
      v-else-if="!error && !rows.length"
      :description="personal ? '该月暂无已公布工资条' : '该范围没有销售薪酬记录'"
    />
    <template v-if="rows.length">
      <div class="stat-grid">
        <article v-for="card in cards" :key="card.label">
          <span>{{ card.label }}</span
          ><strong>{{ card.value }}</strong>
        </article>
      </div>
      <section class="finance-panel">
        <header>
          <h2>月度核算</h2>
          <small>首次整单结清按所属月归集，已确认工资引用锁定快照。</small>
        </header>
        <el-table :data="rows" row-key="code" @row-click="show">
          <el-table-column label="员工" min-width="115"
            ><template #default="{ row }"
              ><el-button link type="primary" @click.stop="show(row as PayBoardEmployee)">{{
                row.name || row.code
              }}</el-button></template
            ></el-table-column
          >
          <el-table-column prop="city" label="城市" min-width="85" />
          <el-table-column label="结清业绩" min-width="120" align="right"
            ><template #default="{ row }">{{ money(row.basis) }}</template></el-table-column
          >
          <el-table-column label="考核目标" min-width="110" align="right"
            ><template #default="{ row }">{{
              money(row.collectionTarget)
            }}</template></el-table-column
          >
          <el-table-column label="距目标差额" min-width="115" align="right"
            ><template #default="{ row }">{{
              money(
                row.collectionTarget != null && row.basis != null
                  ? row.collectionTarget - row.basis
                  : null,
              )
            }}</template></el-table-column
          >
          <el-table-column label="提成" min-width="105" align="right"
            ><template #default="{ row }">{{ money(row.commission) }}</template></el-table-column
          >
          <el-table-column label="应付工资" min-width="115" align="right"
            ><template #default="{ row }">{{ money(row.net) }}</template></el-table-column
          >
          <el-table-column label="已发放" min-width="110" align="right"
            ><template #default="{ row }">{{ money(row.paid) }}</template></el-table-column
          >
          <el-table-column label="状态" min-width="100"
            ><template #default="{ row }">{{
              status(row as PayBoardEmployee)
            }}</template></el-table-column
          >
          <el-table-column v-if="!personal && canPublish" label="工资条" width="95"
            ><template #default="{ row }"
              ><el-button
                v-if="row.payrollId && ['CONFIRMED', 'PAID'].includes(row.status)"
                link
                type="primary"
                @click.stop="publish(row as PayBoardEmployee)"
                ><SupplyActionLabel
                  code="hr:payroll:publish"
                  fallback="公布工资条" /></el-button></template
          ></el-table-column>
          <el-table-column label="待核项" width="80"
            ><template #default="{ row }">{{ row.issues.length }}</template></el-table-column
          >
        </el-table>
      </section>
    </template>
    <el-drawer
      v-model="opened"
      :title="(active?.name || '') + ' · ' + month"
      size="min(800px, 96vw)"
      destroy-on-close
    >
      <div v-if="active" class="finance-report">
        <small
          >{{ status(active) }} ·
          {{ active.basisSource === 'SNAPSHOT' ? '工资快照' : '订单结清事实'
          }}<template v-if="active.revision">
            · 版本 {{ active.revision }} · {{ businessDateTime(active.updatedAt!) }}</template
          ></small
        >
        <el-tabs
          ><el-tab-pane label="工资构成"
            ><section class="finance-panel">
              <dl>
                <div v-for="[label, value] in amounts" :key="label">
                  <dt>{{ label }}</dt>
                  <dd>{{ money(value) }}</dd>
                </div>
              </dl>
            </section></el-tab-pane
          >
          <el-tab-pane label="整单结清"
            ><el-table :data="active.orders" empty-text="本月没有结清订单">
              <el-table-column prop="orderNo" label="订单"><template #default="{row}"><router-link v-if="row.orderNo && canOrders" :to="{path:'/supply-chain/order/sales-orders',query:{orderNo:row.orderNo}}">{{row.orderNo}}</router-link><span v-else>{{row.orderNo||'—'}}</span></template></el-table-column><el-table-column
                prop="settledOn"
                label="首次结清日"
              /><el-table-column label="业绩基数"
                ><template #default="{ row }">{{
                  row.state === 'REVIEW' ? '待核' : money(row.basis)
                }}</template></el-table-column
              >
            </el-table></el-tab-pane
          >
          <el-tab-pane label="提成明细"
            ><el-table :data="active.details" empty-text="无商品行计提记录">
              <el-table-column prop="orderNo" label="订单"><template #default="{row}"><router-link v-if="row.orderNo && canOrders" :to="{path:'/supply-chain/order/sales-orders',query:{orderNo:row.orderNo}}">{{row.orderNo}}</router-link><span v-else>{{row.orderNo||'—'}}</span></template></el-table-column><el-table-column
                prop="product"
                label="商品"
              /><el-table-column label="规则"
                ><template #default="{ row }"
                  >{{ row.rule || '待核'
                  }}<span v-if="row.ruleVersion"> · v{{ row.ruleVersion }}</span></template
                ></el-table-column
              >
              <el-table-column prop="quantity" label="数量" /><el-table-column label="核定提成"
                ><template #default="{ row }">{{ money(row.released) }}</template></el-table-column
              >
            </el-table></el-tab-pane
          >
          <el-tab-pane label="绩效考核"
            ><el-table :data="active.metrics" empty-text="暂无已核算指标"
              ><el-table-column prop="name" label="考核项" /><el-table-column
                prop="target"
                label="目标" /><el-table-column prop="actual" label="实际" /></el-table
          ></el-tab-pane>
          <el-tab-pane label="跨月更正"
            ><el-table :data="active.corrections || []" empty-text="本月没有已纳入的跨月更正"
              ><el-table-column prop="sourceMonth" label="原所属月" /><el-table-column
                prop="targetMonth"
                label="入薪月" /><el-table-column label="更正金额"
                ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
              ><el-table-column prop="reason" label="依据" min-width="160" /></el-table
          ></el-tab-pane>
          <el-tab-pane label="待核项"
            ><p v-for="issue in active.issues" :key="issue">{{ issue }}</p>
            <el-empty v-if="!active.issues.length" description="暂无待核项" /></el-tab-pane
        ></el-tabs>
      </div>
    </el-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {useNavigationStore} from '@/stores/navigation'
import { useRoute } from 'vue-router'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { businessMonth, businessDateTime } from '@/utils/business-date'
import { getSalesPayrollBoard, type PayBoardEmployee } from '@/api/core/sales-payroll-board'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/core/client'
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'
const canOrders=computed(()=>useNavigationStore().hasPath('SUPPLY_CHAIN','/supply-chain/order/sales-orders'))
const canPublish = computed(() => useAuthStore().hasPermission('hr:payroll:publish'))
async function publish(r: PayBoardEmployee) {
  if (!r.payrollId) return
  try {
    await ElMessageBox.confirm(
      '向 ' + r.name + ' 公布 ' + month.value + ' 的第 ' + r.revision + ' 版工资条？',
      '公布工资条',
    )
    await apiClient.put('/hr/payroll/' + encodeURIComponent(r.payrollId) + '/publication', null, {
      params: { revision: r.revision },
    })
    ElMessage.success('工资条已公布')
  } catch (e) {
    if (e instanceof Error) error.value = e.message
  }
}
const route = useRoute(),
  personal = computed(() => route.meta.routeKey === 'supply.sales.pay-statements')
const month = ref(businessMonth(new Date())),
  term = ref(''),
  source = ref<PayBoardEmployee[]>([]),
  busy = ref(false),
  error = ref('')
const active = ref<PayBoardEmployee>(),
  opened = ref(false)
let request: AbortController | undefined
async function load() {
  request?.abort()
  const controller = new AbortController()
  request = controller
  source.value = []
  active.value = undefined
  opened.value = false
  busy.value = true
  error.value = ''
  try {
    const report = await getSalesPayrollBoard(month.value, personal.value, controller.signal)
    if (!controller.signal.aborted) source.value = report.employees
  } catch (e) {
    if (!controller.signal.aborted)
      error.value = e instanceof Error ? e.message : '薪酬数据读取失败'
  } finally {
    if (!controller.signal.aborted) busy.value = false
  }
}
watch(
  () => route.query.month,
  (value) => {
    if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) month.value = value
  },
  { immediate: true },
)
watch([source,()=>route.query.employee],([available,employee])=>{
  if(!personal.value && typeof employee==='string'){term.value=employee;const match=available.find(p=>p.code===employee);if(match)show(match)}
})
watch([month, personal], load, { immediate: true })
onBeforeUnmount(() => request?.abort())
const rows = computed(() =>
  source.value.filter((e) =>
    [e.name, e.code, e.city, e.department].some((v) => v?.includes(term.value.trim())),
  ),
)
const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function show(row: PayBoardEmployee) {
  active.value = row
  opened.value = true
}
const status = (r: PayBoardEmployee) =>
  r.status === 'CONFIRMED' && r.paid && r.paid > 0
    ? '部分发放'
    : {
        NOT_CALCULATED: '待核算',
        READY: '待确认',
        REVIEW: '待核定',
        CONFIRMED: '待发放',
        PAID: '已发放',
      }[r.status] || r.status
const cards = computed(() => {
  const data = rows.value
  const locked = data.filter((r) => ['CONFIRMED', 'PAID'].includes(r.status))
  const orders = new Map(
    data.flatMap((r) =>
      r.orders.filter((o) => o.basis != null).map((o) => [o.id || o.orderNo, o.basis!] as const),
    ),
  )
  return [
    {
      label: '首次整单结清业绩（元）',
      value: data.some((r) => r.basis === null)
        ? '待核'
        : money([...orders.values()].reduce((a, b) => a + b, 0)),
    },
    { label: '结清单数', value: orders.size },
    {
      label: '核定提成（元）',
      value: locked.some((r) => r.commission == null)
        ? '待核'
        : money(locked.reduce((a, r) => a + (r.commission || 0), 0)),
    },
    { label: '待核项', value: data.reduce((a, r) => a + r.issues.length, 0) },
  ]
})
const amounts = computed<[string, number | null][]>(() => {
  const r = active.value!
  return [
    ['底薪', r.baseSalary],
    ['绩效工资', r.performance],
    ['其中过程绩效', r.processPay],
    ['提成', r.commission],
    ['暂缓提成', r.held],
    ['补贴', r.allowance],
    ['扣款', r.deduction],
    ['跨月更正', r.correction],
    ['应发', r.gross],
    ['应付', r.net],
    ['已登记发放', r.paid],
  ]
})
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
<style scoped>
.report-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.report-filters .el-input {
  width: 200px;
}
</style>
