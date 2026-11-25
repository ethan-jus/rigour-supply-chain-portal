<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>风险处置</SupplyPageTitle>
    </header>
    <el-radio-group v-model="tab" size="small" aria-label="风险分类">
      <el-radio-button value="main">回款风险</el-radio-button>
      <el-radio-button v-if="canRisk" value="field">外勤疑点</el-radio-button>
      <el-radio-button value="actions">催收记录</el-radio-button>
    </el-radio-group>
    <FieldRiskQueue v-if="tab === 'field' && canRisk" />
    <section v-if="tab === 'main'" class="finance-panel">
      <header>
        <h2>{{ overdueOnly ? '合同逾期' : '待处置对象' }}</h2>
        <label
          >截至日
          <el-date-picker
            v-model="cutoff"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :disabled-date="future"
            aria-label="回款风险截至日"
            @change="turn(1)"
        /></label>
        <router-link
          v-if="overdueOnly"
          class="risk-show-all"
          :to="{ name: 'SupplySalesRiskCases', query: { asOf: cutoff } }"
          >查看全部风险</router-link
        >
        <el-button text :loading="busy" @click="load">刷新</el-button>
      </header>
      <el-alert v-if="error" type="error" :title="error" />
      <el-table
        v-if="!error"
        v-loading="busy"
        :data="candidates"
        empty-text="暂无逾期、近期到期或账期待核的订单"
      >
        <el-table-column prop="object" label="订单" min-width="125" /><el-table-column
          prop="reason"
          label="待办原因"
          min-width="150"
        />
        <el-table-column label="合同到期" width="123"
          ><template #default="{ row }">{{
            row.dueDate || '到期日待核'
          }}</template></el-table-column
        >
        <el-table-column label="截至日未收（元）" align="right" min-width="135"
          ><template #default="{ row }">{{
            row.balance?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
          }}</template></el-table-column
        >
        <el-table-column prop="owner" label="负责人" min-width="100" />
        <el-table-column v-if="write" label="操作" width="100"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="start(row.seed)">发起跟进</el-button></template
          ></el-table-column
        >
      </el-table>
      <CompactPagination
        v-if="total > 25"
        :current-page="page"
        :page-size="25"
        :page-sizes="[25]"
        :total="total"
        @current-change="turn"
      />
    </section>
    <section v-if="tab === 'actions'" class="finance-panel">
      <h2>催收记录</h2>
      <BiOperationsWorkbench kind="COLLECTION" :action-seed="seed" />
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FieldRiskQueue from './FieldRiskQueue.vue'
import { useAuthStore } from '@/stores/auth'
import { businessDate } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import BiOperationsWorkbench from '../bi/components/BiOperationsWorkbench.vue'
import { getReceivables } from '@/api/core/receivables'
import type { BiActionSeed } from '@/api/core/bi-operations'
const route = useRoute(),
  auth = useAuthStore()
const tab = ref('main'),
  cutoff = ref(businessDate(new Date()))
const future = (date: Date) => businessDate(date) > businessDate(new Date())
const overdueOnly = computed(() => route.query.overdue === '1')
function cutoffFromRoute() {
  const value = String(route.query.asOf || '')
  try {
    return businessDate(value) === value && value <= businessDate(new Date())
      ? value
      : businessDate(new Date())
  } catch {
    return businessDate(new Date())
  }
}
const canRisk = computed(
    () => auth.hasPermission('sales:fieldwork:read') && auth.hasPermission('sales:risk:read'),
  ),
  write = computed(() => auth.hasPermission('analytics:operations:write'))
const candidates = ref<
    {
      object: string
      reason: string
      owner: string | null
      seed: BiActionSeed
      dueDate?: string | null
      balance?: number
    }[]
  >([]),
  seed = ref<BiActionSeed | null>(null),
  busy = ref(false),
  error = ref(''),
  page = ref(1),
  total = ref(0)
let run = 0
async function load() {
  const token = ++run
  busy.value = true
  error.value = ''
  candidates.value = []
  seed.value = null
  try {
    const requestedFrom = String(route.query.from || '')
    const departmentId = Number(route.query.departmentId)
    const report = await getReceivables({
      from:
        /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) && requestedFrom <= cutoff.value
          ? requestedFrom
          : cutoff.value.slice(0, 7) + '-01',
      asOf: cutoff.value,
      ownerStaffCode:
        typeof route.query.ownerStaffCode === 'string' ? route.query.ownerStaffCode : undefined,
      departmentId:
        Number.isSafeInteger(departmentId) && departmentId > 0 ? departmentId : undefined,
      includeSubDepartments: route.query.includeSubDepartments === 'true',
      aging: overdueOnly.value ? 'OVERDUE' : 'ACTIONABLE',
      page: page.value,
      size: 25,
    })
    if (token !== run) return
    total.value = report.balanceCount
    candidates.value = report.balances.map((r) => ({
      object: r.orderNo,
      reason: !r.dueDate
        ? '缺少合同到期日'
        : r.overdueDays && r.overdueDays > 0
          ? '已逾期 ' + r.overdueDays + ' 天'
          : '近期到期',
      dueDate: r.dueDate,
      balance: r.remaining,
      owner: r.owner,
      seed: {
        kind: 'COLLECTION',
        businessRef: 'order-id:' + r.orderId,
        businessLabel: r.orderNo,
        cityCode: r.regionCode,
        employeeCode: r.employeeCode,
        assignee: r.employeeCode,
      },
    }))
  } catch (e) {
    if (token === run) error.value = e instanceof Error ? e.message : '对象列表读取失败'
  } finally {
    if (token === run) busy.value = false
  }
}
function start(value: BiActionSeed) {
  seed.value = { ...value }
  tab.value = 'actions'
}
function turn(v: number) {
  page.value = v
  void load()
}
watch(
  [
    () => route.fullPath,
    () => auth.user?.tenantId,
    () => auth.user?.id,
    () => auth.user?.permissions,
  ],
  () => {
    tab.value = 'main'
    cutoff.value = cutoffFromRoute()
    page.value = 1
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => run++)
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
