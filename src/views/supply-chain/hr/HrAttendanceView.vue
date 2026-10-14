<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
  refreshBusinessDictionary,
} from '@/utils/business-dictionary'
import { departmentTree } from '@/utils/hr-department-tree'
import {
  attendanceMonth,
  getAttendance,
  getAttendanceDepartments,
  confirmAttendanceRecord,
  type AttendanceView,
  type AttendanceRow,
  type AttendanceFilters,
  type AttendanceDepartment,
} from '@/api/core/hr-attendance'

const { can } = useSupplyPermissions()
const initialFilters = (): AttendanceFilters => ({
  month: attendanceMonth(),
  employeeName: '',
  employeeCode: '',
  departmentId: undefined,
  attendanceStatus: '',
})
const filters = reactive(initialFilters())
const appliedFilters = ref(initialFilters())
const page = ref(1)
const departments = ref<ReturnType<typeof departmentTree<AttendanceDepartment>>>([])
const departmentsLoading = ref(false),
  departmentError = ref('')
const data = ref<AttendanceView | null>(null)
// 加载时清空行数据，但保留总数，避免分页控件将当前页重置为第一页。
const total = ref(0)
const loading = ref(false),
  saving = ref(false),
  error = ref('')
const editing = ref(false),
  reason = ref(''),
  editorError = ref(''),
  editMonth = ref('')
const selected = ref<AttendanceRow | null>(null)
const actualOverride = ref<number | undefined>(undefined)
const absentOverride = ref<number | undefined>(undefined)
const leaveType = ref('NONE')
const leaveDictionary = 'ATTENDANCE_LEAVE_TYPE'
const statusDictionary = 'ATTENDANCE_STATUS'
const statusLoading = ref(false)
const statusOptions = computed(() => businessDictionaryOptions('HR', statusDictionary))
const statusLabel = (code: string) => businessDictionaryLabel('HR', statusDictionary, code)
async function loadStatusOptions(refresh = false) {
  statusLoading.value = true
  try {
    if (refresh) await refreshBusinessDictionary(statusDictionary)
    else await loadBusinessDictionaries([{ moduleCode: 'HR', code: statusDictionary }])
  } finally {
    statusLoading.value = false
  }
}
const dictionaryLoading = ref(false)
const leaveOptions = computed(() => businessDictionaryOptions('HR', leaveDictionary))
const leaveLabel = (code: string) => businessDictionaryLabel('HR', leaveDictionary, code)
const maxDays = computed(() => {
  const [year, month] = editMonth.value.split('-').map(Number)
  return year && month ? new Date(year, month, 0).getDate() : 31
})
const autoAbsent = computed(() => {
  const actual = actualOverride.value ?? selected.value?.punchDays
  const expected = selected.value?.expectedDays
  return data.value?.provisional || actual == null || expected == null
    ? null
    : Math.max(0, expected - actual)
})
async function loadLeaveTypes(refresh = false) {
  dictionaryLoading.value = true
  try {
    if (refresh) await refreshBusinessDictionary(leaveDictionary)
    else await loadBusinessDictionaries([{ moduleCode: 'HR', code: leaveDictionary }])
  } finally {
    dictionaryLoading.value = false
  }
}
const daysOpen = ref(false),
  daysRow = ref<AttendanceRow | null>(null)
const sourceLabels: Record<string, string> = {
  UNLINKED: '待关联打卡账号',
  UNAVAILABLE: '暂不可用',
  FUTURE: '尚未开始',
}
const periodStatus = computed(() => {
  if (!data.value) return ''
  if (!data.value.provisional) return '已结束'
  return data.value.through ? '统计中' : '尚未开始'
})
async function loadDepartments() {
  departmentsLoading.value = true
  departmentError.value = ''
  try {
    departments.value = departmentTree(await getAttendanceDepartments())
  } catch (e) {
    departmentError.value = errorMessage(e, '部门加载失败，请重试')
  } finally {
    departmentsLoading.value = false
  }
}
let request = 0
async function load() {
  const id = ++request
  loading.value = true
  error.value = ''
  data.value = null
  try {
    const result = await getAttendance({
      ...appliedFilters.value,
      begin: (page.value - 1) * 20,
      step: 20,
    })
    if (id === request) {
      data.value = result
      total.value = result.page.total
      const lastPage = Math.max(1, Math.ceil(result.page.total / 20))
      if (page.value > lastPage) {
        page.value = lastPage
        await load()
      }
    }
  } catch (e) {
    if (id === request) error.value = errorMessage(e, '考勤加载失败')
  } finally {
    if (id === request) loading.value = false
  }
}
function search() {
  appliedFilters.value = {
    ...filters,
    employeeName: filters.employeeName.trim(),
    employeeCode: filters.employeeCode.trim(),
    departmentId: filters.departmentId || undefined,
    attendanceStatus: filters.attendanceStatus || '',
  }
  editing.value = false
  daysOpen.value = false
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, initialFilters())
  search()
}
function changePage(value: number) {
  if (page.value === value) return
  page.value = value
  void load()
}
function edit(row: AttendanceRow) {
  if (row.attendanceStatus !== 'PENDING') return
  selected.value = row
  editMonth.value = data.value!.month
  reason.value = row.reason
  actualOverride.value = row.actualDaysOverride ?? undefined
  absentOverride.value = row.absentDaysOverride ?? undefined
  leaveType.value = row.leaveTypeCode
  void loadLeaveTypes()
  editorError.value = ''
  editing.value = true
}
function showDays(row: AttendanceRow) {
  daysRow.value = row
  daysOpen.value = true
}
async function save() {
  if (!selected.value || selected.value.attendanceStatus !== 'PENDING' || saving.value) return
  editorError.value = ''
  if (
    [actualOverride.value, absentOverride.value].some(
      (value) =>
        value != null &&
        (!Number.isFinite(value) ||
          value < 0 ||
          value > maxDays.value ||
          !Number.isInteger(value * 2)),
    )
  ) {
    editorError.value = `天数须在 0 至 ${maxDays.value} 之间，且为 0.5 天的倍数`
    return
  }
  if (!leaveOptions.value.some((option) => option.value === leaveType.value)) {
    editorError.value = '请选择当前启用的请假类型'
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    await confirmAttendanceRecord(editMonth.value, selected.value.employeeCode, {
      actualDaysOverride: actualOverride.value ?? null,
      absentDaysOverride: absentOverride.value ?? null,
      leaveTypeCode: leaveType.value,
      reason: reason.value.trim(),
      revision: selected.value.revision,
    })
    editing.value = false
    ElMessage.success('考勤已确认')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '确认失败，请刷新后重试')
  } finally {
    saving.value = false
  }
}
onMounted(() => {
  void loadDepartments()
  void loadLeaveTypes()
  void loadStatusOptions()
  void load()
})
</script>

<template>
  <section class="supply-page supply-page--list supply-page--filtered-list attendance-page">
    <div class="page-heading"><SupplyPageTitle>员工考勤</SupplyPageTitle></div>
    <SupplyListFilters :loading="loading" @search="search" @reset="reset">
      <el-form-item label="考勤月份">
        <el-date-picker
          v-model="filters.month"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
          :disabled="saving"
          aria-label="考勤月份"
        />
      </el-form-item>
      <el-form-item label="员工姓名">
        <el-input
          v-model="filters.employeeName"
          clearable
          maxlength="128"
          placeholder="请输入员工姓名"
          aria-label="员工姓名"
        />
      </el-form-item>
      <el-form-item label="员工编号">
        <el-input
          v-model="filters.employeeCode"
          clearable
          maxlength="50"
          placeholder="请输入员工编号"
          aria-label="员工编号"
        />
      </el-form-item>
      <el-form-item label="所属部门">
        <el-tree-select
          v-model="filters.departmentId"
          :data="departments"
          node-key="id"
          :props="{ label: 'departmentName', children: 'children' }"
          :loading="departmentsLoading"
          :disabled="!!departmentError"
          check-strictly
          filterable
          clearable
          :render-after-expand="false"
          :default-expanded-keys="departments.map((item) => item.id)"
          placeholder="全部部门（含下级）"
          aria-label="所属部门"
        />
      </el-form-item>
      <el-form-item label="考勤状态">
        <el-select
          v-model="filters.attendanceStatus"
          clearable
          :loading="statusLoading"
          :disabled="statusLoading || !statusOptions.length"
          placeholder="全部状态"
          aria-label="考勤状态"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <template #feedback>
        <div v-if="!statusLoading && !statusOptions.length" class="department-error" role="alert">
          <span>考勤状态字典暂不可用或没有启用项</span>
          <el-button link type="primary" @click="loadStatusOptions(true)">重载状态字典</el-button>
        </div>
        <div v-if="departmentError" class="department-error" role="alert">
          <span>{{ departmentError }}</span>
          <el-button link type="primary" :loading="departmentsLoading" @click="loadDepartments"
            >重试</el-button
          >
        </div>
      </template>
    </SupplyListFilters>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="data">
      <el-alert
        v-if="data.page.items.some((row) => row.expectedDays == null)"
        title="当前列表有员工未设置应出勤天数，请完善本月部门规则或公司默认规则。"
        type="warning"
        :closable="false"
      />
      <el-alert
        v-if="data.sourceError"
        :title="data.sourceError"
        type="warning"
        :closable="false"
      />
    </template>
    <el-card v-loading="loading" class="list-card" shadow="never">
      <div class="supply-list-toolbar">
        <div class="attendance-period">
          <h2>{{ data?.month || appliedFilters.month }} 考勤记录</h2>
          <el-tag
            v-if="data"
            :type="data.provisional ? 'info' : 'success'"
            effect="plain"
            size="small"
            >{{ periodStatus }}</el-tag
          >
          <span v-if="data?.through" class="hint">截至 {{ data.through }}</span>
        </div>
        <div class="supply-list-actions">
          <el-popover placement="bottom-end" trigger="click" :width="310">
            <template #reference><el-button link>统计说明</el-button></template>
            <div class="attendance-help">
              <p>实际出勤默认按销售已提交、未删除的打卡日期统计，同一天只计 1 天。</p>
              <p>缺勤默认在当月结束后按应出勤减实际出勤计算，最低为 0。</p>
              <p>应出勤优先使用本部门规则，未设置时使用公司默认，不继承上级部门。</p>
              <p>人事可分别调整实际出勤和缺勤，人工值优先生效，清空后恢复系统计算。</p>
              <p>请假类型仅作分类，不自动折算天数。选择部门时包含下级部门。</p>
              <p>待确认记录查询时实时统计；确认后保存结果，后续规则和打卡变化不再影响。</p>
            </div>
          </el-popover>
          <el-button :disabled="loading" @click="load">刷新</el-button>
        </div>
      </div>
      <el-table
        :data="data?.page.items ?? []"
        row-key="employeeCode"
        height="100%"
        border
        class="business-table supply-scroll-table"
      >
        <el-table-column label="员工" min-width="170" fixed="left"
          ><template #default="{ row }"
            ><div>{{ row.employeeName }}</div>
            <span class="hint">{{ row.employeeCode }}</span></template
          ></el-table-column
        >
        <el-table-column prop="departmentName" label="部门" min-width="150" show-overflow-tooltip />
        <el-table-column label="应出勤天数" width="120" align="right"
          ><template #default="{ row }">
            <div>{{ row.expectedDays ?? '未设置' }}</div>
            <span v-if="row.expectedDays != null" class="hint">{{
              row.ruleSource === 'DEPARTMENT' ? '本部门规则' : '公司默认'
            }}</span>
          </template></el-table-column
        >
        <el-table-column label="实际出勤天数" min-width="160" align="right"
          ><template #default="{ row }">
            <el-button
              v-if="row.punchDays != null"
              link
              type="primary"
              :aria-label="`查看${row.employeeName}打卡日期`"
              @click="showDays(row as AttendanceRow)"
              >{{ row.actualDays }}</el-button
            >
            <span v-else-if="row.actualDays != null">{{ row.actualDays }}</span>
            <span v-else class="hint">{{ sourceLabels[row.sourceStatus] || '待核对' }}</span>
            <div v-if="row.actualDaysOverride != null" class="manual-hint">人工调整</div>
          </template></el-table-column
        >
        <el-table-column label="缺勤天数" width="120" align="right"
          ><template #default="{ row }">
            <div>{{ row.absentDays ?? '—' }}</div>
            <div v-if="row.absentDaysOverride != null" class="manual-hint">人工调整</div>
          </template></el-table-column
        >
        <el-table-column label="请假类型" width="110">
          <template #default="{ row }">{{ leaveLabel(row.leaveTypeCode) }}</template>
        </el-table-column>
        <el-table-column label="考勤状态" width="110">
          <template #default="{ row }">
            <el-tag
              :type="row.attendanceStatus === 'CONFIRMED' ? 'success' : 'warning'"
              effect="plain"
            >
              {{ statusLabel(row.attendanceStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="缺卡原因" min-width="240" show-overflow-tooltip
          ><template #default="{ row }">{{ row.reason || '—' }}</template></el-table-column
        >
        <el-table-column v-if="can('hr:attendance:write')" label="操作" width="130" fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-if="row.attendanceStatus === 'PENDING'"
              link
              type="primary"
              :aria-label="`确认${row.employeeName}考勤`"
              @click="edit(row as AttendanceRow)"
              >考勤确认</el-button
            ></template
          ></el-table-column
        >
        <template #empty>{{
          loading ? '加载中' : error ? '加载失败，请重试' : '暂无员工'
        }}</template>
      </el-table>
      <el-pagination
        class="supply-list-pagination"
        v-show="!error"
        :current-page="page"
        :page-size="20"
        :total="total"
        layout="total, prev, pager, next"
        :disabled="loading"
        @current-change="changePage"
      />
    </el-card>
    <el-dialog
      v-model="editing"
      title="考勤确认"
      width="min(640px, 94vw)"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <p>{{ editMonth }} · {{ selected?.employeeName }}（{{ selected?.employeeCode }}）</p>
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <div class="attendance-reference">
        <span
          >应出勤：<strong>{{ selected?.expectedDays ?? '未设置' }}</strong
          >{{ selected?.expectedDays != null ? ' 天' : '' }}</span
        >
        <span
          >打卡统计：<strong>{{
            selected?.punchDays ?? sourceLabels[selected?.sourceStatus ?? '']
          }}</strong
          >{{ selected?.punchDays != null ? ' 天' : '' }}</span
        >
      </div>
      <el-form label-position="top" class="attendance-editor" @submit.prevent="save">
        <div class="attendance-editor-days">
          <el-form-item label="实际出勤天数">
            <div class="day-input">
              <el-input-number
                :key="`actual-${saving}`"
                v-model="actualOverride"
                :min="0"
                :max="maxDays"
                :step="0.5"
                :precision="1"
                :disabled="saving"
                controls-position="right"
                placeholder="使用打卡统计"
                aria-label="实际出勤天数"
              />
              <span>天</span>
            </div>
            <el-button
              link
              type="primary"
              :disabled="saving || actualOverride == null"
              @click="actualOverride = undefined"
              >恢复打卡统计</el-button
            >
          </el-form-item>
          <el-form-item label="缺勤天数">
            <div class="day-input">
              <el-input-number
                :key="`absent-${saving}`"
                v-model="absentOverride"
                :min="0"
                :max="maxDays"
                :step="0.5"
                :precision="1"
                :disabled="saving"
                controls-position="right"
                placeholder="使用系统计算"
                aria-label="缺勤天数"
              />
              <span>天</span>
            </div>
            <div class="absence-reference">
              <span class="hint"
                >系统计算：{{ autoAbsent == null ? '暂未计算' : `${autoAbsent} 天` }}</span
              >
              <el-button
                link
                type="primary"
                :disabled="saving || absentOverride == null"
                @click="absentOverride = undefined"
                >恢复计算</el-button
              >
            </div>
          </el-form-item>
        </div>
        <el-form-item label="请假类型" required>
          <el-select
            v-model="leaveType"
            :loading="dictionaryLoading"
            :disabled="saving || dictionaryLoading"
            aria-label="请假类型"
            placeholder="请选择请假类型"
          >
            <el-option
              v-if="!leaveOptions.some((option) => option.value === leaveType)"
              :value="leaveType"
              :label="leaveLabel(leaveType)"
              disabled
            />
            <el-option
              v-for="option in leaveOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <div
            v-if="!dictionaryLoading && !leaveOptions.length"
            class="department-error"
            role="alert"
          >
            <span>请假类型字典暂不可用或没有启用项</span>
            <el-button link type="primary" @click="loadLeaveTypes(true)">重载字典</el-button>
          </div>
        </el-form-item>
        <el-form-item label="缺卡原因">
          <el-input
            v-model="reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            :disabled="saving"
            aria-label="缺卡原因"
            placeholder="填写缺卡日期、原因或调整说明"
          />
        </el-form-item>
      </el-form>
      <el-alert
        title="确认后将锁定当前考勤结果，后续打卡和规则变化不再更新，也不能再次修改。"
        type="warning"
        :closable="false"
      />
      <p class="hint">
        天数支持 0.5 天，留空使用系统计算。人工填写的缺勤独立生效；请假类型不自动折算天数。
      </p>
      <template #footer>
        <el-button :disabled="saving" @click="editing = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="dictionaryLoading || !leaveOptions.length"
          @click="save"
          >确认考勤</el-button
        >
      </template>
    </el-dialog>
    <el-dialog v-model="daysOpen" title="打卡日期" width="min(560px, 94vw)">
      <p>{{ data?.month }} · {{ daysRow?.employeeName }} · 共 {{ daysRow?.punchDays }} 天</p>
      <div class="dates">
        <el-tag v-for="date in daysRow?.dates" :key="date" size="large">{{ date }}</el-tag>
      </div>
      <el-empty v-if="!daysRow?.dates.length" description="本月暂无已提交的打卡记录" />
    </el-dialog>
  </section>
</template>

<style scoped>
.attendance-reference {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  padding: 14px 16px;
  margin: 16px 0 20px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
.attendance-editor-days {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.attendance-editor :deep(.el-form-item__content) {
  display: block;
}
.day-input,
.absence-reference {
  display: flex;
  align-items: center;
  gap: 8px;
}
.day-input {
  margin-bottom: 8px;
}
.day-input .el-input-number {
  width: 100%;
}
.manual-hint {
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
}
@media (max-width: 540px) {
  .attendance-editor-days {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.department-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--el-color-danger);
  font-size: 13px;
}
.attendance-period {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.attendance-period h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.attendance-help p {
  margin: 0 0 10px;
  line-height: 1.6;
}
.attendance-help p:last-child {
  margin-bottom: 0;
}
.hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.dates {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.el-dialog .el-alert {
  margin-bottom: 12px;
}
.el-dialog .hint {
  margin-top: 10px;
}
</style>
