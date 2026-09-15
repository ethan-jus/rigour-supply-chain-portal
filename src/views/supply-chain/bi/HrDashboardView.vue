<template>
  <PeopleDashboardFrame
    title="HR 人事看板"
    description="查看人员规模、城市和岗位结构，以及入离职与员工业务表现。"
    year-to-date
    :synced-at="data?.syncedAt"
    @change="load"
  >
    <div v-loading="loading" class="dashboard-body">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-empty
        v-else-if="data?.status === 'NOT_READY'"
        description="员工数据尚未同步，请完成 HR 数据接入后刷新"
      />
      <el-empty v-else-if="data?.status === 'EMPTY'" description="当前范围暂无员工档案" />
      <template v-else-if="data?.summary">
        <dl class="metric-grid">
          <div v-for="metric in metrics" :key="metric.label">
            <dt>{{ metric.label }}</dt>
            <dd>{{ metric.value }}<small>人</small></dd>
          </div>
        </dl>
        <p class="scope-note">
          停用 {{ data.summary.inactive }} 人 · 待确认 {{ data.summary.pending }} 人 · 期间有订单
          {{ data.summary.orderingEmployees ?? '—' }} 人
        </p>
        <el-alert
          v-if="qualityNote"
          :title="qualityNote"
          type="warning"
          :closable="false"
          show-icon
        />
        <div class="chart-grid">
          <section class="dashboard-panel">
            <h2>当前城市人员结构</h2>
            <p class="scope-note">包含当前在职、离职及其他状态；单位：人</p>
            <div class="chart-scroll">
              <EchartsChart :option="cityChart" :height="chartHeight(data.cities)" />
            </div>
          </section>
          <section class="dashboard-panel">
            <h2>当前岗位人员结构</h2>
            <p class="scope-note">按 HR 当前岗位分组；单位：人</p>
            <EchartsChart :option="positionChart" :height="chartHeight(data.positions)" />
          </section>
        </div>
        <div class="chart-grid">
          <section class="dashboard-panel">
            <h2>期间入离职趋势</h2>
            <p class="scope-note">按档案中的入职、离职日期分月统计；边界月份仅计入所选日期。</p>
            <EchartsChart :option="movementChart" :height="300" />
          </section>
          <section class="dashboard-panel">
            <h2>员工订单应收 · 前 10 名</h2>
            <p class="scope-note">所选期间未取消订单的应收金额，按员工编码关联；单位：元</p>
            <EchartsChart
              v-if="performanceRows.length"
              :option="performanceChart"
              :height="300"
            /><el-empty v-else description="当前范围暂无已关联的订单业绩" />
          </section>
        </div>
        <section class="dashboard-panel">
          <div class="record-toolbar">
            <div>
              <h2>员工档案与业务明细</h2>
              <p class="scope-note">当前归属客户；期间订单应收及这些订单的累计回款。</p>
            </div>
            <el-input
              v-model="search"
              clearable
              placeholder="搜索员工编码、姓名、城市或岗位"
              aria-label="搜索员工"
            />
          </div>
          <el-table :data="pageRows" max-height="480" empty-text="没有匹配的员工">
            <el-table-column prop="employeeName" label="员工" min-width="100" fixed />
            <el-table-column prop="employeeCode" label="员工编码" min-width="150" />
            <el-table-column label="当前状态" width="95"
              ><template #default="{ row }">{{
                statusName(row.employmentStatus)
              }}</template></el-table-column
            >
            <el-table-column prop="cityName" label="当前城市" min-width="100" />
            <el-table-column prop="positionName" label="当前岗位" min-width="110" />
            <el-table-column label="归属客户数" width="110" align="right"
              ><template #default="{ row }">{{
                row.customerCount ?? '—'
              }}</template></el-table-column
            >
            <el-table-column label="期间订单数" width="110" align="right"
              ><template #default="{ row }">{{ row.orderCount ?? '—' }}</template></el-table-column
            >
            <el-table-column label="期间订单应收" min-width="130" align="right"
              ><template #default="{ row }">{{ money(row.salesAmount) }}</template></el-table-column
            >
            <el-table-column label="对应累计回款" min-width="130" align="right"
              ><template #default="{ row }">{{ money(row.paidAmount) }}</template></el-table-column
            >
            <el-table-column label="入职日期" width="120"
              ><template #default="{ row }">{{ date(row.entryDate) }}</template></el-table-column
            >
            <el-table-column label="离职日期" width="120"
              ><template #default="{ row }">{{ date(row.leaveDate) }}</template></el-table-column
            >
          </el-table>
          <el-pagination
            v-model:current-page="page"
            :page-size="20"
            :total="filtered.length"
            layout="total, prev, pager, next"
          />
        </section>
        <p class="scope-note">
          员工快照：{{
            timestamp(data.syncedAt)
          }}。当前人员结构不代表历史期间在岗人数；缺少离职日期的记录不计入期间离职数。订单或客户未同步时，相关指标显示“—”。
        </p>
      </template>
    </div>
  </PeopleDashboardFrame>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getEmployeeAnalytics, type EmployeeStructure } from '@/api/core/bi-employees'
import EchartsChart from './components/EchartsChart.vue'
import PeopleDashboardFrame from './components/PeopleDashboardFrame.vue'
import { usePeopleDashboard, snapshotTime as timestamp } from './use-people-dashboard'

const { data, loading, error, load } = usePeopleDashboard(getEmployeeAnalytics)
const search = ref(''),
  page = ref(1)
watch(data, () => {
  page.value = 1
})
watch(search, () => {
  page.value = 1
})
const metrics = computed(() => {
  const s = data.value?.summary
  return s
    ? [
        { label: '员工档案', value: s.total },
        { label: '当前在职', value: s.active },
        { label: '当前离职', value: s.left },
        { label: '期间入职', value: s.joinedInPeriod },
        { label: '期间离职', value: s.leftInPeriod },
      ]
    : []
})
const qualityNote = computed(() => {
  const s = data.value?.summary
  if (!s) return ''
  return [
    s.missingEntryDate ? `${s.missingEntryDate} 人缺入职日期` : '',
    s.missingDepartment ? `${s.missingDepartment} 人未填写部门` : '',
    s.unmappedCity ? `${s.unmappedCity} 人的城市尚未关联城市编码，仅在全租户范围展示` : '',
  ]
    .filter(Boolean)
    .join('；')
})
const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return (data.value?.employees || []).filter((row) =>
    [row.employeeCode, row.employeeName, row.cityName, row.positionName].some((value) =>
      value?.toLowerCase().includes(keyword),
    ),
  )
})
const pageRows = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20))
function structureChart(rows: EmployeeStructure[]) {
  return {
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    legend: { bottom: 0 },
    grid: { left: 10, right: 24, top: 12, bottom: 40, containLabel: true },
    xAxis: { type: 'value' as const, minInterval: 1 },
    yAxis: { type: 'category' as const, inverse: true, data: rows.map((row) => row.name) },
    series: [
      {
        name: '在职',
        type: 'bar' as const,
        stack: 'people',
        data: rows.map((row) => row.active),
        itemStyle: { color: '#2f8f83' },
      },
      {
        name: '离职',
        type: 'bar' as const,
        stack: 'people',
        data: rows.map((row) => row.left),
        itemStyle: { color: '#8a98ad' },
      },
      {
        name: '停用或待确认',
        type: 'bar' as const,
        stack: 'people',
        data: rows.map((row) => row.total - row.active - row.left),
        itemStyle: { color: '#d9a64b' },
      },
    ],
  }
}
const cityChart = computed(() => structureChart(data.value?.cities || []))
const positionChart = computed(() => structureChart(data.value?.positions || []))
const chartHeight = (rows: EmployeeStructure[]) => Math.max(230, rows.length * 28 + 60)
const statusName = (value: string) =>
  ({ ACTIVE: '在职', LEFT: '离职', INACTIVE: '停用', PENDING: '待确认' })[value] || '待确认'
const money = (value: string | number | null) =>
  value === null
    ? '—'
    : Number(value).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date(value))
    : '未填写'
const movementChart = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  legend: { bottom: 0 },
  grid: { top: 20, left: 12, right: 16, bottom: 50, containLabel: true },
  xAxis: { type: 'category' as const, data: data.value?.months.map((row) => row.month) || [] },
  yAxis: { type: 'value' as const, minInterval: 1 },
  series: [
    {
      name: '入职',
      type: 'bar' as const,
      data: data.value?.months.map((row) => row.joined) || [],
      itemStyle: { color: '#2864e8' },
    },
    {
      name: '离职',
      type: 'bar' as const,
      data: data.value?.months.map((row) => row.left) || [],
      itemStyle: { color: '#a9b6c8' },
    },
  ],
}))
const performanceRows = computed(() =>
  (data.value?.employees || [])
    .filter((row) => row.salesAmount !== null && Number(row.salesAmount) > 0)
    .sort((a, b) => Number(b.salesAmount) - Number(a.salesAmount))
    .slice(0, 10),
)
const performanceChart = computed(() => ({
  tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
  grid: { top: 10, left: 10, right: 28, bottom: 24, containLabel: true },
  xAxis: { type: 'value' as const },
  yAxis: {
    type: 'category' as const,
    inverse: true,
    data: performanceRows.value.map((row) => row.employeeName),
  },
  series: [
    {
      name: '订单应收（元）',
      type: 'bar' as const,
      data: performanceRows.value.map((row) => Number(row.salesAmount)),
      itemStyle: { color: '#2864e8' },
      barMaxWidth: 20,
    },
  ],
}))
</script>
