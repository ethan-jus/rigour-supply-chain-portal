<template>
  <PeopleDashboardFrame
    title="销售拜访看板"
    description="跟踪已提交拜访、建联门店和人员覆盖，定位城市执行与关联缺口。"
    :synced-at="data?.syncedAt"
    @change="load"
  >
    <div v-loading="loading" class="dashboard-body">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-empty
        v-else-if="data?.status === 'NOT_READY'"
        description="拜访及业务关联快照尚未就绪，请完成同步后更新显示"
      />
      <el-empty
        v-else-if="data?.status === 'EMPTY'"
        description="当前范围没有已提交拜访，请调整日期、城市或员工"
      />
      <template v-else-if="data?.summary">
        <dl class="metric-grid">
          <div v-for="metric in metrics" :key="metric.label">
            <dt>{{ metric.label }}</dt>
            <dd>
              {{ metric.value.toLocaleString('zh-CN') }}<small>{{ metric.unit }}</small>
            </dd>
            <p class="scope-note">{{ metric.note }}</p>
          </div>
        </dl>
        <div class="chart-grid">
          <section class="dashboard-panel">
            <h2>每日拜访与建联门店</h2>
            <p class="scope-note">
              按提交日期统计；同一门店跨日出现时，每天分别去重，总计重新去重。
            </p>
            <EchartsChart :option="trendChart" :height="310" />
          </section>
          <section class="dashboard-panel">
            <h2>拜访审核状态</h2>
            <p class="scope-note">按提交记录计次；标记待核查仍计入已提交拜访与建联。</p>
            <EchartsChart :option="reviewChart" :height="310" />
          </section>
        </div>
        <div class="chart-grid">
          <section class="dashboard-panel">
            <h2>城市拜访与建联分布</h2>
            <p class="scope-note">当前门店所属城市；单位：次 / 家</p>
            <div class="chart-scroll">
              <EchartsChart
                :option="cityChart"
                :height="Math.max(280, data.cities.length * 36 + 60)"
              />
            </div>
          </section>
          <section class="dashboard-panel">
            <h2>拜访人员 · 前 10 名</h2>
            <p class="scope-note">按 Sales 人员 ID 统计；有效拜访指已提交记录。</p>
            <EchartsChart :option="peopleChart" :height="380" />
          </section>
        </div>
        <section class="dashboard-panel">
          <h2>业务关联覆盖</h2>
          <p class="scope-note">关联后可按 HR 员工和 CRM 客户查询；关联覆盖不代表成交转化。</p>
          <div class="coverage-grid">
            <div>
              <p class="coverage-value">
                {{ data.summary.visits - data.summary.unlinkedEmployeeVisits }} /
                {{ data.summary.visits }} 次
              </p>
              <el-progress
                :percentage="
                  percent(
                    data.summary.visits - data.summary.unlinkedEmployeeVisits,
                    data.summary.visits,
                  )
                "
                :stroke-width="8"
              />
              <p class="scope-note">
                已关联 HR 员工的拜访；{{ data.summary.unlinkedEmployeeVisits }} 次尚未关联，单独保留
                Sales 人员 ID。
              </p>
            </div>
            <div>
              <p class="coverage-value">
                {{ data.summary.crmLinkedStores }} / {{ data.summary.contactedStores }} 家
              </p>
              <el-progress
                :percentage="percent(data.summary.crmLinkedStores, data.summary.contactedStores)"
                color="#18a999"
                :stroke-width="8"
              />
              <p class="scope-note">
                已关联 CRM 的建联门店；{{
                  data.summary.contactedStores - data.summary.crmLinkedStores
                }}
                家尚未关联。
              </p>
            </div>
          </div>
        </section>
        <section class="dashboard-panel">
          <div class="record-toolbar">
            <div>
              <h2>拜访人员明细</h2>
              <p class="scope-note">不同人员可能拜访同一门店，人员去重门店数不可直接相加。</p>
            </div>
            <el-input
              v-model="search"
              clearable
              placeholder="搜索姓名、HR 编码或 Sales 人员 ID"
              aria-label="搜索拜访人员"
            />
          </div>
          <el-table :data="pageRows" max-height="510" empty-text="没有匹配的拜访人员">
            <el-table-column label="拜访人员" min-width="170" fixed
              ><template #default="{ row }">{{ row.displayName }}</template></el-table-column
            >
            <el-table-column label="HR 员工编码" min-width="155"
              ><template #default="{ row }">{{
                row.employeeCode || '未关联 HR'
              }}</template></el-table-column
            >
            <el-table-column label="拜访次数" prop="visits" width="110" align="right" />
            <el-table-column label="建联门店" prop="contactedStores" width="110" align="right" />
            <el-table-column label="拜访天数" prop="activeDays" width="110" align="right" />
            <el-table-column label="已通过" prop="approvedVisits" width="100" align="right" />
            <el-table-column label="待审核" prop="pendingVisits" width="100" align="right" />
            <el-table-column label="标记待核查" prop="flaggedVisits" width="110" align="right" />
            <el-table-column label="Sales 人员 ID" prop="salespersonId" min-width="300" />
          </el-table>
          <el-pagination
            v-model:current-page="page"
            :page-size="20"
            :total="filtered.length"
            layout="total, prev, pager, next"
          />
        </section>
        <p class="scope-note">
          数据快照：{{ snapshotTime(data.syncedAt) }}。来源为 Sales
          临时打卡中已提交、未删除且有提交时间的拜访；建联客户按所选期间去重门店，不要求微信截图。重复拜访门店指期间提交超过一次的门店。拜访天数不代表考勤出勤。数据随
          BI 定时同步更新，“更新显示”重新读取最新快照。
        </p>
      </template>
    </div>
  </PeopleDashboardFrame>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getVisitAnalytics, type VisitAnalytics } from '@/api/core/bi-visits'
import PeopleDashboardFrame from './components/PeopleDashboardFrame.vue'
import EchartsChart from './components/EchartsChart.vue'
import { usePeopleDashboard, snapshotTime } from './use-people-dashboard'
const { data, loading, error, load } = usePeopleDashboard(getVisitAnalytics)
const search = ref(''),
  page = ref(1)
watch([search, data], () => {
  page.value = 1
})
const metrics = computed(() => {
  const s = data.value?.summary
  return s
    ? [
        { label: '已提交拜访', value: s.visits, unit: '次', note: '按有效提交记录统计' },
        { label: '建联客户', value: s.contactedStores, unit: '家', note: '所选期间去重门店' },
        {
          label: '参与拜访人员',
          value: s.visitingPeople,
          unit: '人',
          note: '按 Sales 人员 ID 去重',
        },
        { label: '重复拜访门店', value: s.repeatStores, unit: '家', note: '期间提交超过一次' },
        {
          label: '待审核拜访',
          value: s.pendingVisits,
          unit: '次',
          note: `另有 ${s.flaggedVisits} 次标记待核查`,
        },
      ]
    : []
})
const percent = (value: number, total: number) =>
  total ? Math.round((value / total) * 1000) / 10 : 0
const personName = (row: VisitAnalytics['people'][number]) =>
  row.employeeName ||
  (row.employeeCode
    ? `员工 ${row.employeeCode}`
    : `未关联 HR · ${row.salespersonId?.slice(0, 8) || '人员缺失'}`)
const filtered = computed(() =>
  (data.value?.people || []).filter((row) =>
    [personName(row), row.employeeCode, row.salespersonId].some((value) =>
      value?.toLowerCase().includes(search.value.trim().toLowerCase()),
    ),
  ),
)
const pageRows = computed(() =>
  filtered.value
    .slice((page.value - 1) * 20, page.value * 20)
    .map((row) => ({ ...row, displayName: personName(row) })),
)
const axisTooltip = { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } }
const grid = { top: 18, left: 10, right: 24, bottom: 45, containLabel: true }
const trendChart = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  legend: { bottom: 0 },
  grid: { ...grid, bottom: (data.value?.days.length || 0) > 60 ? 76 : 45 },
  xAxis: { type: 'category' as const, data: data.value?.days.map((row) => row.date) || [] },
  yAxis: { type: 'value' as const, minInterval: 1 },
  dataZoom:
    (data.value?.days.length || 0) > 60
      ? [{ type: 'slider' as const, bottom: 30, height: 16, start: 0, end: 100 }]
      : [],
  series: [
    {
      name: '拜访（次）',
      type: 'line' as const,
      showSymbol: false,
      data: data.value?.days.map((row) => row.visits) || [],
      itemStyle: { color: '#2864e8' },
      areaStyle: { opacity: 0.06 },
    },
    {
      name: '建联门店（家）',
      type: 'line' as const,
      showSymbol: false,
      data: data.value?.days.map((row) => row.contactedStores) || [],
      itemStyle: { color: '#18a999' },
    },
  ],
}))
const reviewChart = computed(() => ({
  tooltip: { trigger: 'item' as const, formatter: '{b}：{c} 次（{d}%）' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie' as const,
      radius: ['48%', '70%'],
      center: ['50%', '45%'],
      label: { formatter: '{b}\n{c} 次', fontSize: 11 },
      data: [
        {
          name: '已通过',
          value: data.value?.summary?.approvedVisits || 0,
          itemStyle: { color: '#18a999' },
        },
        {
          name: '待审核',
          value: data.value?.summary?.pendingVisits || 0,
          itemStyle: { color: '#2864e8' },
        },
        {
          name: '标记待核查',
          value: data.value?.summary?.flaggedVisits || 0,
          itemStyle: { color: '#e1a14a' },
        },
      ],
    },
  ],
}))
const cityChart = computed(() => ({
  tooltip: axisTooltip,
  legend: { bottom: 0 },
  grid,
  xAxis: { type: 'value' as const, minInterval: 1 },
  yAxis: {
    type: 'category' as const,
    inverse: true,
    data: data.value?.cities.map((row) => row.cityName || '未关联城市') || [],
  },
  series: [
    {
      name: '拜访（次）',
      type: 'bar' as const,
      data: data.value?.cities.map((row) => row.visits) || [],
      itemStyle: { color: '#2864e8' },
      barMaxWidth: 12,
    },
    {
      name: '建联门店（家）',
      type: 'bar' as const,
      data: data.value?.cities.map((row) => row.contactedStores) || [],
      itemStyle: { color: '#18a999' },
      barMaxWidth: 12,
    },
  ],
}))
const peopleChart = computed(() => ({
  tooltip: axisTooltip,
  grid: { ...grid, bottom: 24 },
  xAxis: { type: 'value' as const, minInterval: 1 },
  yAxis: {
    type: 'category' as const,
    inverse: true,
    data: data.value?.people.slice(0, 10).map(personName) || [],
    axisLabel: { width: 110, overflow: 'truncate' as const },
  },
  series: [
    {
      name: '拜访（次）',
      type: 'bar' as const,
      data: data.value?.people.slice(0, 10).map((row) => row.visits) || [],
      itemStyle: { color: '#2864e8' },
      barMaxWidth: 18,
    },
  ],
}))
</script>
