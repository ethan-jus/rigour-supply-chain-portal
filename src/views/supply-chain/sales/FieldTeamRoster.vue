<template>
  <dl class="field-panel team-totals" aria-label="团队出勤与拜访进展">
    <div v-for="metric in metrics" :key="metric.label" :title="metric.hint">
      <dt>
        <svg class="metric-icon" aria-hidden="true">
          <use :href="teamIcons + '#' + metric.icon" /></svg
        >{{ metric.label }}
      </dt>
      <dd>
        <strong>{{ metric.value ?? '—' }}</strong> {{ metric.unit }}
      </dd>
    </div>
  </dl>
  <section class="field-panel team-list">
    <header class="field-panel-header">
      <h2>
        团队成员 <span class="field-count">{{ report.total }}</span>
      </h2>
      <el-select
        :model-value="status"
        placeholder="全部出勤状态"
        clearable
        aria-label="出勤状态"
        @update:model-value="emit('status', $event || '')"
      >
        <el-option v-for="(label, key) in attendanceNames" :key="key" :label="label" :value="key" />
      </el-select>
    </header>
    <div class="field-table-wrap" role="region" aria-label="团队成员出勤与拜访进展" tabindex="0">
      <table class="field-table team-table">
        <thead>
          <tr>
            <th
              v-for="label in [
                '业务员',
                '部门',
                '出勤状态',
                '签到 / 签退',
                '拜访进展',
                '最近事件',
                '操作',
              ]"
              :key="label"
              scope="col"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ person, firstIn, lastOut, latest, visiting } in rows"
            :key="person.salesProfileId"
          >
            <th scope="row">
              <button class="field-link staff" @click="emit('choose', person)">
                <span :style="avatarStyle(person.salesProfileId)" aria-hidden="true">{{
                  person.employeeName.slice(0, 1)
                }}</span
                >{{ person.employeeName }}
              </button>
            </th>
            <td>{{ person.departmentName || '—' }}</td>
            <td>
              <span class="field-status" :data-status="person.status">{{
                attendanceNames[person.status] || person.status
              }}</span>
            </td>
            <td>{{ fieldClock(firstIn) }}　/　{{ fieldClock(lastOut) }}</td>
            <td>
              <template v-if="person.visits.length"
                >{{ person.visits.length }} 次 · {{ person.storeCount }} 家门店</template
              ><template v-else>—</template><span v-if="visiting" class="in-visit">拜访中</span>
            </td>
            <td>
              <template v-if="latest"
                ><time>{{ fieldClock(latest.at) }}</time> {{ latest.text }}</template
              ><template v-else>—</template>
            </td>
            <td>
              <button
                class="field-link trip-link"
                :aria-label="'查看' + person.employeeName + '的行程'"
                @click="emit('choose', person)"
              >
                查看行程 <el-icon><ArrowRight /></el-icon>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!rows.length" class="field-empty">当前筛选没有匹配的业务员</p>
    <footer v-if="report.total <= size" class="team-footer">共 {{ report.total }} 人</footer>
    <ListTableFooter v-else
      ><CompactPagination
        :total="report.total"
        :current-page="page"
        :page-size="size"
        :page-sizes="[20, 50, 100]"
        @current-change="emit('page', $event)"
        @size-change="emit('size', $event)"
    /></ListTableFooter>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { fieldClock } from '@/api/core/sales-fieldwork'
import { type DailyReport, type ReportEmployee } from '@/api/core/sales-fieldwork-report'
import teamIcons from '@/assets/icons/team-fieldwork.svg?no-inline'
import { attendanceNames } from './team-attendance'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
const props = defineProps<{
  report: DailyReport
  avatarStyle: (id: string) => Record<string, string>
  status: string
  page: number
  size: number
}>()
const emit = defineEmits<{
  choose: [person: ReportEmployee]
  status: [status: string]
  page: [page: number]
  size: [size: number]
}>()
const rows = computed(() =>
  props.report.items.map((person) => {
    const punches = person.punches
      .map((p) => ({
        type: p.type,
        at: p.at || p.received,
        text: p.type === 'CHECK_IN' ? '签到' : '签退',
      }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const events = [
      ...punches,
      ...person.visits.map((v) => ({
        at: v.departed || v.arrived,
        text: (v.departed ? '离店 · ' : '到店 · ') + (v.store || v.customer || '门店待关联'),
      })),
    ]
    return {
      person,
      firstIn: punches.find((p) => p.type === 'CHECK_IN')?.at,
      lastOut: punches.at(-1)?.type === 'CHECK_OUT' ? punches.at(-1)?.at : null,
      visiting: person.visits.some((v) => !v.departed),
      latest: events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0],
    }
  }),
)
const metrics = computed(() => {
  const { summary, total } = props.report
  const complete = rows.value.length === total
  return [
    {
      label: '团队人数',
      value: summary.people,
      unit: '人',
      icon: 'people',
      hint: '当前筛选范围内的业务员',
    },
    {
      label: '当日已签到',
      value:
        summary.signedInPeople ?? (complete ? rows.value.filter((r) => r.firstIn).length : null),
      unit: '人',
      icon: 'signed',
      hint: '当日有签到记录的业务员，包含已签退人员',
    },
    {
      label: '正在拜访',
      value:
        summary.visitingPeople ?? (complete ? rows.value.filter((r) => r.visiting).length : null),
      unit: '人',
      icon: 'visiting',
      hint: '所选工作日中仍有到店未离店记录的业务员',
    },
    {
      label: '已访门店',
      value: summary.stores,
      unit: '家',
      icon: 'stores',
      hint: '已完成到店和离店的门店去重数',
    },
  ]
})
</script>
<style scoped lang="scss" src="./sales-fieldwork.scss"></style>
<style scoped>
.team-totals,
.team-list {
  border: 1px solid #dfe5ea;
  border-radius: 8px;
  background: white;
}
.team-totals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 17px 0;
}
.team-totals > div {
  padding: 0 22px;
}
.team-totals > div + div {
  border-left: 1px solid #dfe5ea;
}
.team-totals dt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #526679;
  font-size: 13px;
  font-weight: 550;
}
.team-totals dt .metric-icon {
  color: #557797;
  width: 18px;
  height: 18px;
}
.team-totals > div:nth-child(2) .metric-icon {
  color: #257769;
}
.team-totals > div:nth-child(3) .metric-icon {
  color: #3368c5;
}
.team-totals > div:nth-child(4) .metric-icon {
  color: #7363a0;
}
.team-totals dd {
  margin: 0;
  color: #667888;
  font-size: 12px;
}
.team-totals strong {
  margin-right: 4px;
  color: #18324a;
  font-size: 30px;
  line-height: 1.4;
  letter-spacing: -1px;
}
.team-list {
  overflow: hidden;
}
.team-list header {
  padding: 12px 19px;
  min-height: 58px;
  box-sizing: border-box;
  border: 0;
}
.team-list header h2 {
  color: #18324a;
  font-size: 18px;
  letter-spacing: -0.3px;
}
.team-list .field-count {
  padding: 2px 7px;
  margin-left: 5px;
  border-radius: 12px;
  background: #eef2f6;
  color: #61778b;
  font-size: 12px;
  font-weight: 550;
}
.team-list header .el-select {
  width: 140px;
}
.team-list header :deep(.el-select__wrapper) {
  min-height: 34px;
  border-radius: 5px;
}
.team-list header :deep(.el-select__placeholder) {
  color: #18324a;
}
.team-table {
  min-width: 840px;
  font-size: 14px;
  color: #18324a;
  white-space: nowrap;
}
.team-table :is(th, td) {
  padding: 11px 13px;
  border-top: 1px solid #e6ebef;
  line-height: 1.5;
  text-align: left;
}
.team-table tr > :first-child {
  padding-left: 20px;
}
.team-table tr > :last-child {
  padding-right: 20px;
}
.team-table thead th {
  color: #566a7d;
  background: #f5f7fa;
  font-size: 13px;
  font-weight: 600;
}
.team-table tbody tr:hover {
  background: #f7faff;
}
.team-table time {
  margin-right: 3px;
  color: #596d7f;
  font-size: 12px;
  font-weight: 600;
}
.staff,
.trip-link {
  display: inline-flex;
  align-items: center;
  padding: 0;
  font-weight: 550;
  font-size: 14px;
}
.staff {
  gap: 11px;
  color: #214876;
}
.staff span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
}
.trip-link {
  gap: 6px;
  color: #235bd5;
}
.team-table .field-status {
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f0f2f4;
  color: #6a7480;
  font-size: 12px;
  font-weight: 550;
}
.team-table .field-status::before {
  width: 5px;
  height: 5px;
}
.team-table [data-status='ACTIVE'] {
  background: #e8f4ee;
  color: #267355;
}
.team-table [data-status='FINISHED'] {
  background: #edf1f9;
  color: #53678a;
}
.team-table [data-status='MISSING_CHECKOUT'] {
  background: #fff3dc;
  color: #88520d;
}
.in-visit {
  display: block;
  font-size: 11px;
  color: #2562a2;
  font-weight: 550;
}
.team-footer {
  padding: 12px 20px;
  border-top: 1px solid #dfe5ea;
  color: #667888;
  text-align: right;
  font-size: 12px;
}
@media (min-width: 1600px) {
  .team-table :is(th, td) {
    padding-block: 14px;
  }
}
@media (max-width: 760px) {
  .team-totals > div {
    padding: 0 9px;
  }
  .team-totals strong {
    font-size: 24px;
  }
  .team-totals dt {
    gap: 4px;
    font-size: 12px;
  }
}
</style>
