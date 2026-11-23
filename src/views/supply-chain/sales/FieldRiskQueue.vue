<template>
  <section class="finance-panel">
    <header class="queue-tools">
      <h2>外勤疑点</h2>
      <el-date-picker
        v-model="date"
        type="date"
        :clearable="false"
        value-format="YYYY-MM-DD"
        aria-label="核查工作日"
        @change="resetScope"
      />
      <el-select
        v-model="city"
        clearable
        filterable
        placeholder="全部城市"
        aria-label="城市"
        @change="changeCity"
        ><el-option
          v-for="c in options.cities"
          :key="c.name"
          :label="cityName(c.name)"
          :value="c.name"
      /></el-select>
      <el-select
        v-model="dept"
        clearable
        filterable
        placeholder="全部部门"
        aria-label="部门"
        @change="changeDept"
        ><el-option v-for="d in options.departments" :key="d.id" :label="d.name" :value="d.id"
      /></el-select>
      <el-select
        v-model="person"
        clearable
        filterable
        placeholder="全部销售"
        aria-label="销售"
        @change="search"
        ><el-option v-for="p in options.people" :key="p.id" :label="p.name" :value="p.id"
      /></el-select>
      <span v-if="data">{{ data.total }} 人有未结事项</span>
    </header>
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <el-table
      v-else
      v-loading="busy"
      :data="issues"
      size="small"
      row-key="id"
      empty-text="所选范围暂无未结事项"
    >
      <el-table-column prop="employee" label="销售" min-width="98" /><el-table-column
        prop="city"
        label="城市"
        width="92"
      />
      <el-table-column prop="title" label="待核事实" min-width="170" /><el-table-column
        label="进度"
        width="100"
        ><template #default="{ row }">{{ caseStatus(row.status) }}</template></el-table-column
      >
      <el-table-column label="操作" min-width="125"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="open(row as QueueRow)">核查</el-button
          ><router-link
            v-if="board"
            :to="{
              name: 'SupplySalesDashboard',
              query: { date, person: row.profile, visit: row.visitId || undefined },
            }"
            >人员日报</router-link
          ></template
        ></el-table-column
      >
    </el-table>
    <CompactPagination
      v-if="data && data.total > limit"
      :current-page="page"
      :page-size="limit"
      :page-sizes="[limit]"
      :total="data.total"
      @current-change="turn"
    />
    <el-drawer v-model="drawer" title="核查事项" destroy-on-close size="min(500px,96vw)"
      ><el-alert v-if="caseError" type="error" :title="caseError" /><el-skeleton
        v-else-if="reading"
        :rows="3" /><SalesFieldworkCasePanel v-else :cases="cases" @changed="updated"
    /></el-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { businessDate } from '@/utils/business-date'
import { readFieldReport, cityName, type DailyReport } from '@/api/core/sales-fieldwork-report'
import { caseStatus, dayCases, type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
interface QueueRow {
  id: string
  employee: string
  city: string
  profile: string
  day: string
  visitId: string | null
  title: string
  status: string
}
const auth = useAuthStore(),
  nav = useNavigationStore(),
  board = computed(() => nav.hasPath('SUPPLY_CHAIN', '/supply-chain/sales'))
const date = ref(businessDate(new Date())),
  city = ref(''),
  dept = ref(''),
  person = ref(''),
  page = ref(1),
  limit = 20
const options = ref<Pick<DailyReport, 'cities' | 'departments' | 'people'>>({
    cities: [],
    departments: [],
    people: [],
  }),
  data = ref<DailyReport | null>(null),
  busy = ref(false),
  error = ref('')
const issues = computed<QueueRow[]>(
  () =>
    data.value?.items.flatMap((p) =>
      p.workDayId
        ? p.issues.map((i) => ({
            ...i,
            employee: p.employeeName || p.employeeCode || '未关联',
            profile: p.salesProfileId,
            city: cityName(p.city),
            day: p.workDayId!,
          }))
        : [],
    ) || [],
)
const drawer = ref(false),
  cases = ref<FieldworkCase[]>([]),
  caseError = ref(''),
  reading = ref(false)
let active: AbortController | undefined, lookup: AbortController | undefined
async function load() {
  active?.abort()
  const req = new AbortController()
  active = req
  busy.value = true
  data.value = null
  error.value = ''
  try {
    const result = await readFieldReport(
      {
        date: date.value,
        city: city.value,
        departmentId: dept.value,
        person: person.value || undefined,
        pendingOnly: true,
        riskQueue: true,
        includeDescendants: true,
        page: page.value,
        size: limit,
      },
      req.signal,
    )
    if (!req.signal.aborted) {
      if (!result.items.length && result.total && page.value > 1) {
        turn(Math.ceil(result.total / limit))
        return
      }
      options.value = result
      data.value = result
    }
  } catch (e) {
    if (!req.signal.aborted) error.value = e instanceof Error ? e.message : '核查队列读取失败'
  } finally {
    if (!req.signal.aborted) busy.value = false
  }
}
function turn(n: number) {
  page.value = n
  void load()
}
function search() {
  turn(1)
}
function changeDept() {
  person.value = ''
  search()
}
function changeCity() {
  dept.value = ''
  changeDept()
}
function resetScope() {
  city.value = ''
  changeCity()
}
async function open(row: QueueRow) {
  lookup?.abort()
  const req = new AbortController()
  lookup = req
  cases.value = []
  caseError.value = ''
  drawer.value = true
  reading.value = true
  try {
    const list = await dayCases(row.profile, row.day, req.signal)
    if (!req.signal.aborted) {
      cases.value = list.filter((c) => c.id === row.id)
      if (!cases.value.length) caseError.value = '事项已变更，请刷新队列'
    }
  } catch (e) {
    if (!req.signal.aborted) caseError.value = e instanceof Error ? e.message : '核查事项读取失败'
  } finally {
    if (!req.signal.aborted) reading.value = false
  }
}
function updated(item: FieldworkCase) {
  cases.value = [item]
  void load()
}
watch(
  () => [auth.user?.id, auth.user?.tenantId, auth.user?.permissions],
  () => {
    drawer.value = false
    lookup?.abort()
    options.value = { cities: [], departments: [], people: [] }
    resetScope()
  },
  { immediate: true, deep: true },
)
onBeforeUnmount(() => {
  active?.abort()
  lookup?.abort()
})
</script>
<style scoped>
.queue-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.queue-tools h2 {
  margin: 0 auto 0 0;
}
.queue-tools .el-select {
  width: 126px;
}
.queue-tools :deep(.el-date-editor) {
  width: 141px;
}
.queue-tools span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
