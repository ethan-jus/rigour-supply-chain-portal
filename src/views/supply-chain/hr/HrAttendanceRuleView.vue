<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, type TreeInstance } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { departmentTree } from '@/utils/hr-department-tree'
import {
  attendanceMonth,
  getAttendanceDepartments,
  getAttendanceRule,
  getAttendanceRules,
  saveAttendanceRule,
  saveAttendanceRules,
  type AttendanceDepartment,
  type AttendanceRule,
  type AttendanceRuleFilters,
  type AttendanceRuleList,
  type AttendanceRuleListRow,
} from '@/api/core/hr-attendance'

import PayrollComponentView from './PayrollComponentView.vue'
const attendanceTab = ref('calendar')
const { can } = useSupplyPermissions()
const initialFilters = (): AttendanceRuleFilters => ({
  month: attendanceMonth(),
  departmentId: undefined,
  status: '',
})
const filters = reactive(initialFilters())
const applied = ref(initialFilters())
const data = ref<AttendanceRuleList | null>(null)
const page = ref(1),
  total = ref(0),
  loading = ref(false),
  error = ref('')
const departments = ref<AttendanceDepartment[]>([])
const departmentsLoading = ref(false),
  departmentError = ref('')
const departmentOptions = computed(() => [
  { id: 0, parentId: null, departmentName: '公司默认', sortOrder: -1, children: [] },
  ...departmentTree(departments.value),
])
async function loadDepartments() {
  departmentsLoading.value = true
  departmentError.value = ''
  try {
    const rows = await getAttendanceDepartments(true)
    departmentTree(rows)
    departments.value = rows
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
    const result = await getAttendanceRules({
      ...applied.value,
      begin: (page.value - 1) * 20,
      step: 20,
    })
    if (id !== request) return
    data.value = result
    total.value = result.page.total
    const lastPage = Math.max(1, Math.ceil(total.value / 20))
    if (page.value > lastPage) {
      page.value = lastPage
      await load()
    }
  } catch (e) {
    if (id === request) error.value = errorMessage(e, '规则列表加载失败')
  } finally {
    if (id === request) loading.value = false
  }
}
function search() {
  applied.value = {
    ...filters,
    departmentId: typeof filters.departmentId === 'number' ? filters.departmentId : undefined,
    status: filters.status || '',
  }
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, initialFilters())
  search()
}
function changePage(value: number) {
  if (page.value !== value) {
    page.value = value
    void load()
  }
}
const emptyText = computed(() =>
  loading.value
    ? '加载中'
    : error.value
      ? '加载失败，请重试'
      : data.value?.configuredDepartmentIds.length
        ? '暂无符合条件的规则'
        : '本月尚未设置考勤规则',
)
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))

const dialogOpen = ref(false),
  mode = ref<'create' | 'edit' | 'view'>('create')
const editMonth = ref(attendanceMonth()),
  editDepartment = ref<number | undefined>()
const editDepartments = ref<number[]>([])
const departmentSelection = ref<{ treeRef: TreeInstance }>()
const editorRows = ref<{ id: number; rule: AttendanceRule; days: number | undefined }[]>([])
let editorMonth = ''
const rule = ref<AttendanceRule | null>(null),
  monthOptions = ref<AttendanceRuleList | null>(null)
const days = ref<number | undefined>(),
  editorLoading = ref(false),
  saving = ref(false),
  editorError = ref('')
const title = computed(() =>
  mode.value === 'create'
    ? '新增考勤规则'
    : mode.value === 'view' || rule.value?.locked || rule.value?.canWrite === false
      ? '查看考勤规则'
      : '修改考勤规则',
)
const readOnly = computed(
  () =>
    mode.value === 'view' ||
    !!rule.value?.locked ||
    rule.value?.canWrite === false ||
    !can('hr:attendance-rule:write'),
)
const duplicate = computed(
  () => mode.value === 'create' && editorRows.value.some((row) => row.rule.expectedDays != null),
)
const batchBlocked = computed(() =>
  editorRows.value.some((row) => row.rule.locked || row.rule.canWrite === false),
)
const daysDisabled = computed(
  () =>
    editorLoading.value ||
    saving.value ||
    !rule.value ||
    readOnly.value ||
    duplicate.value ||
    batchBlocked.value,
)
const maxDays = computed(() => {
  const [year, month] = editMonth.value.split('-').map(Number)
  return new Date(year!, month!, 0).getDate()
})
const editorDepartments = computed(() =>
  departmentTree(departments.value.map((d) => ({ ...d, ...optionState(d.id, d.departmentName) }))),
)
function optionState(id: number, name: string) {
  const locked = monthOptions.value?.lockedDepartmentIds.includes(id)
  const configured = monthOptions.value?.configuredDepartmentIds.includes(id)
  return {
    departmentName: `${name}${locked ? '（已锁定）' : configured ? '（已设置）' : ''}`,
    disabled: mode.value === 'create' && !!(locked || configured),
  }
}
const editorOptions = computed(() => [
  { id: 0, children: [], ...optionState(0, '公司默认') },
  ...editorDepartments.value,
])
function selectDepartments(id: number, checked: number[]) {
  if (mode.value !== 'create' || saving.value) return
  if (id === 0) {
    editDepartments.value = checked.includes(0) ? [0] : []
    return
  }
  const branch = new Set([id])
  const visit = (nodes: typeof editorDepartments.value) => {
    for (const node of nodes) {
      if (node.parentId != null && branch.has(node.parentId)) branch.add(node.id)
      visit(node.children)
    }
  }
  visit(editorDepartments.value)
  const included = new Set(checked.filter((value) => value !== 0))
  for (const value of branch) {
    if (checked.includes(id) && !optionState(value, '').disabled) included.add(value)
    else included.delete(value)
  }
  if (!checked.includes(id)) {
    let parent = departments.value.find((department) => department.id === id)?.parentId
    while (parent != null && !branch.has(parent)) {
      branch.add(parent)
      included.delete(parent)
      parent = departments.value.find((department) => department.id === parent)?.parentId
    }
  }
  editDepartments.value = [...included]
}
watch(
  () => editDepartments.value.join(','),
  async () => {
    await nextTick()
    const selected = new Set(editDepartments.value)
    const visit = (nodes: typeof editorDepartments.value): boolean => {
      let any = false
      for (const department of nodes) {
        const childSelected = visit(department.children)
        const node = departmentSelection.value?.treeRef.getNode(department.id)
        if (node) node.indeterminate = !selected.has(department.id) && childSelected
        any ||= selected.has(department.id) || childSelected
      }
      return any
    }
    visit(editorDepartments.value)
  },
)
function removeDepartmentTag(id: number) {
  const removed = new Set([id])
  const removeBranch = (nodes: typeof editorDepartments.value) => {
    for (const node of nodes) {
      if (node.parentId != null && removed.has(node.parentId)) removed.add(node.id)
      removeBranch(node.children)
    }
  }
  removeBranch(editorDepartments.value)
  let parent = departments.value.find((department) => department.id === id)?.parentId
  while (parent != null && !removed.has(parent)) {
    removed.add(parent)
    parent = departments.value.find((department) => department.id === parent)?.parentId
  }
  editDepartments.value = editDepartments.value.filter((value) => !removed.has(value))
}
const activeDepartment = computed(() =>
  mode.value === 'create' ? editDepartments.value[0] : editDepartment.value,
)
const selectedName = computed(() =>
  activeDepartment.value === 0
    ? '公司默认'
    : departments.value.find((d) => d.id === activeDepartment.value)?.departmentName || '所选部门',
)
const departmentName = (id: number) =>
  id === 0 ? '公司默认' : departments.value.find((d) => d.id === id)?.departmentName || `部门 ${id}`
const lockReason = computed(() =>
  editDepartment.value === 0
    ? '当月已有使用公司默认规则的员工确认考勤，公司默认规则已锁定。'
    : '本部门当月已有员工确认考勤，规则已锁定，不能修改或重新设置。',
)
let editorRequest = 0
async function loadEditor(preserveInput = false) {
  if (!dialogOpen.value) return
  const id = ++editorRequest
  const month = editMonth.value,
    department = editDepartment.value
  const selected =
    mode.value === 'create' ? [...editDepartments.value] : department == null ? [] : [department]
  const previous =
    editorMonth === month
      ? new Map(editorRows.value.map((row) => [row.id, row.days]))
      : new Map<number, number | undefined>()
  if (editorMonth === month && editorRows.value.length === 1)
    previous.set(editorRows.value[0]!.id, days.value)
  editorLoading.value = true
  if (!preserveInput) {
    rule.value = null
    days.value = undefined
    editorRows.value = []
    editorError.value = ''
  }
  if (editorMonth !== month) monthOptions.value = null
  try {
    const [options, currentRows] = await Promise.all([
      getAttendanceRules({ month, status: '', begin: 0, step: 1 }),
      Promise.all(selected.map((value) => getAttendanceRule(month, value || null))),
    ])
    if (id !== editorRequest || !dialogOpen.value) return
    monthOptions.value = options
    const current = currentRows[0] ?? null
    rule.value = current
    editorRows.value = currentRows.map((current, index) => ({
      id: selected[index]!,
      rule: current,
      days:
        !current.locked && previous.has(selected[index]!)
          ? previous.get(selected[index]!)
          : (current.expectedDays ?? current.calendarExpectedDays ?? undefined),
    }))
    editorMonth = month
    if (!preserveInput || current?.locked)
      days.value =
        mode.value === 'create'
          ? editorRows.value[0]?.days
          : (current?.expectedDays ?? current?.calendarExpectedDays ?? undefined)
  } catch (e) {
    if (id === editorRequest) {
      rule.value = null
      editorRows.value = []
      editorError.value = errorMessage(e, '规则加载失败，请重试')
    }
  } finally {
    if (id === editorRequest) editorLoading.value = false
  }
}
function create() {
  if (!can('hr:attendance-rule:write')) return
  mode.value = 'create'
  editMonth.value = applied.value.month
  const id = applied.value.departmentId
  const selected =
    id != null &&
    !data.value?.configuredDepartmentIds.includes(id) &&
    !data.value?.lockedDepartmentIds.includes(id)
      ? id
      : undefined
  const included = new Set<number>(selected == null ? [] : [selected])
  if (selected != null && selected !== 0) {
    let added = true
    while (added) {
      added = false
      for (const department of departments.value)
        if (
          department.parentId != null &&
          included.has(department.parentId) &&
          !included.has(department.id)
        ) {
          included.add(department.id)
          added = true
        }
    }
  }
  editDepartments.value = [...included].filter(
    (value) =>
      !data.value?.configuredDepartmentIds.includes(value) &&
      !data.value?.lockedDepartmentIds.includes(value),
  )
  editorRows.value = []
  editorMonth = ''
  editDepartment.value = undefined
  dialogOpen.value = true
}
function openRow(row: AttendanceRuleListRow) {
  mode.value =
    row.locked || row.canWrite === false || !can('hr:attendance-rule:write') ? 'view' : 'edit'
  editMonth.value = row.month
  editDepartment.value = row.departmentId ?? 0
  dialogOpen.value = true
}
async function persist(expectedDays: number | null) {
  if (
    !rule.value ||
    saving.value ||
    editorLoading.value ||
    readOnly.value ||
    duplicate.value ||
    expectedDays === rule.value.expectedDays
  )
    return
  if (
    expectedDays != null &&
    (!Number.isInteger(expectedDays) || expectedDays < 0 || expectedDays > maxDays.value)
  ) {
    editorError.value = `请填写0至${maxDays.value}之间的应出勤天数`
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    await saveAttendanceRule({
      month: rule.value.month,
      departmentId: rule.value.departmentId,
      expectedDays,
      revision: rule.value.revision,
    })
    dialogOpen.value = false
    ElMessage.success(expectedDays == null ? '已恢复使用公司默认规则' : '考勤规则已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败，请刷新后重试')
    await Promise.all([load(), loadEditor(true)])
  } finally {
    saving.value = false
  }
}
function save() {
  if (mode.value === 'create') {
    void persistBatch()
    return
  }
  if (days.value == null) {
    editorError.value = '请填写应出勤天数'
    return
  }
  void persist(days.value)
}
async function persistBatch() {
  if (daysDisabled.value || !editorRows.value.length) return
  const commands = editorRows.value.map((row) => ({
    month: editMonth.value,
    departmentId: row.id || null,
    expectedDays: editorRows.value.length === 1 ? days.value : row.days,
    revision: row.rule.revision,
  }))
  if (
    commands.some(
      (command) =>
        command.expectedDays == null ||
        !Number.isInteger(command.expectedDays) ||
        command.expectedDays < 0 ||
        command.expectedDays > maxDays.value,
    )
  ) {
    editorError.value = `请为每个部门填写0至${maxDays.value}之间的应出勤天数`
    return
  }
  if (commands.length > 1 && commands.some((command) => command.departmentId == null)) {
    editorError.value = '公司默认规则请单独设置'
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    await saveAttendanceRules(
      commands.map((command) => ({ ...command, expectedDays: command.expectedDays! })),
    )
    dialogOpen.value = false
    ElMessage.success(`已保存 ${commands.length} 个部门的应出勤天数`)
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败，请刷新后重试')
    await Promise.all([load(), loadEditor(true)])
  } finally {
    saving.value = false
  }
}
watch([dialogOpen, editMonth, editDepartment, () => editDepartments.value.join(',')], () => {
  if (dialogOpen.value) void loadEditor()
  else {
    ++editorRequest
    rule.value = null
    editorRows.value = []
    monthOptions.value = null
    editorError.value = ''
  }
})
onMounted(() => {
  void loadDepartments()
  void load()
})
</script>

<template>
  <div>
    <el-tabs v-model="attendanceTab"
      ><el-tab-pane name="calendar" label="薪资考勤规则" /><el-tab-pane
        name="expected"
        label="月度应出勤天数"
    /></el-tabs>
    <PayrollComponentView v-if="attendanceTab === 'calendar'" component-kind="ATTENDANCE" />
    <template v-else>
      <section
        class="supply-page supply-page--list supply-page--filtered-list attendance-rule-page"
      >
        <div class="page-heading">
          <SupplyPageTitle>考勤规则设置</SupplyPageTitle>
          <el-button v-if="can('hr:attendance-rule:write')" type="primary" @click="create"
            >新增规则</el-button
          >
        </div>
        <SupplyListFilters :loading="loading" @search="search" @reset="reset">
          <el-form-item label="考勤月份">
            <el-date-picker
              v-model="filters.month"
              type="month"
              value-format="YYYY-MM"
              :clearable="false"
              aria-label="考勤月份"
            />
          </el-form-item>
          <el-form-item label="适用部门">
            <el-tree-select
              v-model="filters.departmentId"
              :data="departmentOptions"
              node-key="id"
              :props="{ label: 'departmentName', children: 'children' }"
              :loading="departmentsLoading"
              :disabled="!!departmentError"
              check-strictly
              filterable
              clearable
              :render-after-expand="false"
              :default-expanded-keys="departmentOptions.map((d) => d.id)"
              placeholder="全部部门 / 公司默认"
              aria-label="适用部门"
            />
          </el-form-item>
          <el-form-item label="规则状态">
            <el-select
              v-model="filters.status"
              clearable
              placeholder="全部状态"
              aria-label="规则状态"
            >
              <el-option label="可修改" value="UNLOCKED" /><el-option
                label="已锁定"
                value="LOCKED"
              />
            </el-select>
          </el-form-item>
          <template #feedback
            ><div v-if="departmentError" class="department-error" role="alert">
              {{ departmentError
              }}<el-button link type="primary" @click="loadDepartments">重试</el-button>
            </div></template
          >
        </SupplyListFilters>
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <el-alert
          v-if="data && data.configuredDepartmentIds.length && data.companyExpectedDays == null"
          title="本月尚未设置公司默认规则；未补录月度天数的部门按生效的薪资考勤规则计算，无匹配规则时需补录。"
          type="warning"
          :closable="false"
        />
        <el-card v-loading="loading" class="list-card" shadow="never">
          <div class="supply-list-toolbar">
            <strong>{{ applied.month }} 考勤规则</strong
            ><el-button :disabled="loading" @click="load">刷新</el-button>
          </div>
          <el-table
            :data="data?.page.items ?? []"
            :row-key="(row: AttendanceRuleListRow) => `${row.month}:${row.departmentId ?? 0}`"
            height="100%"
            border
            class="business-table supply-scroll-table"
          >
            <el-table-column prop="month" label="考勤月份" width="130" />
            <el-table-column
              prop="departmentName"
              label="适用部门"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column label="应出勤天数" min-width="140" align="right"
              ><template #default="{ row }">{{ row.expectedDays }} 天</template></el-table-column
            >
            <el-table-column label="规则状态" width="140"
              ><template #default="{ row }"
                ><el-tag :type="row.locked ? 'warning' : 'success'" effect="plain">{{
                  row.locked ? '已锁定' : row.canWrite === false ? '只读' : '可修改'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="最近修改时间" min-width="180"
              ><template #default="{ row }">{{
                formatTime(row.updatedTime)
              }}</template></el-table-column
            >
            <el-table-column label="操作" width="110" fixed="right"
              ><template #default="{ row }"
                ><el-button
                  link
                  type="primary"
                  :aria-label="`${row.locked || row.canWrite === false || !can('hr:attendance-rule:write') ? '查看' : '修改'}${row.departmentName}考勤规则`"
                  @click="openRow(row as AttendanceRuleListRow)"
                  >{{
                    row.locked || row.canWrite === false || !can('hr:attendance-rule:write')
                      ? '查看'
                      : '修改'
                  }}</el-button
                ></template
              ></el-table-column
            >
            <template #empty
              ><div class="empty-rules">
                <span>{{ emptyText }}</span
                ><el-button
                  v-if="
                    data && !data.configuredDepartmentIds.length && can('hr:attendance-rule:write')
                  "
                  link
                  type="primary"
                  @click="create"
                  >新增本月规则</el-button
                >
              </div></template
            >
          </el-table>
          <el-pagination
            v-show="!error"
            class="supply-list-pagination"
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="20"
            :current-page="page"
            @current-change="changePage"
          />
        </el-card>
        <p class="rule-hint">
          新增时勾选父部门会选中全部可设置的下级部门，按部门分别保存。核算优先使用生效的薪资考勤规则，无匹配规则时使用本页补录值或公司默认。
        </p>
        <el-dialog
          v-model="dialogOpen"
          :title="title"
          width="min(560px, 94vw)"
          :close-on-click-modal="false"
          :close-on-press-escape="!saving"
          :show-close="!saving"
        >
          <el-alert
            v-if="editorError"
            :title="editorError"
            type="error"
            :closable="false"
            class="editor-alert"
          />
          <el-form label-position="top" @submit.prevent="save">
            <el-form-item label="考勤月份" required
              ><el-date-picker
                v-model="editMonth"
                type="month"
                value-format="YYYY-MM"
                :clearable="false"
                :disabled="mode !== 'create' || saving"
                aria-label="规则月份"
            /></el-form-item>
            <el-form-item label="适用部门" required
              ><el-tree-select
                v-if="mode === 'create'"
                ref="departmentSelection"
                v-model="editDepartments"
                :data="editorOptions"
                node-key="id"
                :props="{ label: 'departmentName', children: 'children', disabled: 'disabled' }"
                :disabled="saving || editorLoading || !!departmentError"
                multiple
                check-strictly
                show-checkbox
                filterable
                collapse-tags
                collapse-tags-tooltip
                :max-collapse-tags="3"
                :render-after-expand="false"
                :default-expanded-keys="editorOptions.map((d) => d.id)"
                placeholder="选择公司默认或部门，父部门包含下级"
                aria-label="规则部门"
                @check="(department, state) => selectDepartments(department.id, state.checkedKeys)"
                @remove-tag="removeDepartmentTag"
              />
              <el-tree-select
                v-else
                v-model="editDepartment"
                :data="editorOptions"
                node-key="id"
                :props="{ label: 'departmentName', children: 'children', disabled: 'disabled' }"
                disabled
                :loading="editorLoading || departmentsLoading"
                check-strictly
                filterable
                :render-after-expand="false"
                :default-expanded-keys="editorOptions.map((d) => d.id)"
                placeholder="选择公司默认或部门"
                aria-label="规则部门"
              />
              <p v-if="mode === 'create'" class="hint">
                已设置或已锁定的部门不可重复新增；公司默认请单独选择。
              </p>
            </el-form-item>
            <el-table v-if="mode === 'create' && editorRows.length > 1" :data="editorRows" border>
              <el-table-column label="部门" min-width="120">
                <template #default="{ row }">{{ departmentName(row.id) }}</template>
              </el-table-column>
              <el-table-column label="应出勤天数" min-width="170">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.days"
                    :min="0"
                    :max="maxDays"
                    :precision="0"
                    :disabled="daysDisabled"
                    :aria-label="`${departmentName(row.id)}应出勤天数`"
                  />
                </template>
              </el-table-column>
              <el-table-column label="取数说明" min-width="160">
                <template #default="{ row }">
                  {{
                    row.rule.calendarExpectedDays == null
                      ? row.rule.calendarMessage || '未匹配薪资考勤规则，请补录'
                      : `考勤规则计算：${row.rule.calendarExpectedDays} 天`
                  }}
                </template>
              </el-table-column>
            </el-table>
            <el-form-item v-else label="应出勤天数" required
              ><div class="days-control">
                <el-input-number
                  :key="`${maxDays}-${daysDisabled}`"
                  v-model="days"
                  :min="0"
                  :max="maxDays"
                  :precision="0"
                  :disabled="daysDisabled"
                  aria-label="应出勤天数"
                /><span>天</span>
              </div></el-form-item
            >
            <p
              v-if="rule?.calendarMessage && (mode !== 'create' || editorRows.length === 1)"
              class="hint"
            >
              {{ rule.calendarMessage
              }}{{ rule.calendarExpectedDays == null ? '' : `：${rule.calendarExpectedDays} 天` }}
            </p>
          </el-form>
          <el-alert v-if="rule?.locked" :title="lockReason" type="warning" :closable="false" />
          <el-alert
            v-if="batchBlocked && mode === 'create' && !rule?.locked"
            title="部分所选部门已锁定或无写入权限，请移除后再保存。"
            type="warning"
            :closable="false"
          />
          <el-alert
            v-else-if="duplicate"
            title="该月份、部门已设置考勤规则，请在列表中修改，不能重复新增。"
            type="info"
            :closable="false"
          />
          <p
            v-if="
              rule &&
              activeDepartment &&
              rule.expectedDays == null &&
              (mode !== 'create' || editorRows.length === 1)
            "
            class="hint"
          >
            {{ selectedName }}当前使用公司默认：{{
              rule.companyExpectedDays == null ? '尚未设置' : `${rule.companyExpectedDays} 天`
            }}
          </p>
          <p class="hint">
            同月份、同部门仅一条补录记录；关联员工确认后锁定。天数按所选月份的生效考勤规则带出，核算优先使用考勤规则；月中入离职暂不自动折算。
          </p>
          <template #footer>
            <el-button
              v-if="mode === 'edit' && editDepartment && rule?.expectedDays != null && !readOnly"
              :disabled="saving || editorLoading"
              @click="persist(null)"
              >恢复公司默认</el-button
            >
            <el-button :disabled="saving" @click="dialogOpen = false">{{
              readOnly ? '关闭' : '取消'
            }}</el-button>
            <el-button v-if="editorError" :disabled="saving || editorLoading" @click="loadEditor()"
              >重新加载</el-button
            >
            <el-button
              v-if="!readOnly"
              type="primary"
              :loading="saving"
              :disabled="
                daysDisabled ||
                (mode === 'create' && editorRows.length > 1
                  ? editorRows.some((row) => row.days == null)
                  : days == null || days === rule?.expectedDays)
              "
              @click="save"
              >{{ mode === 'create' ? '保存规则' : '保存修改' }}</el-button
            >
          </template>
        </el-dialog>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.rule-hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: var(--app-font-size-base);
  line-height: 1.6;
}
.department-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--el-color-danger);
}
.empty-rules {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.days-control {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hint {
  color: var(--el-text-color-secondary);
  line-height: 1.7;
  margin: 12px 0 0;
}
.editor-alert {
  margin-bottom: 16px;
}
:deep(.el-dialog .el-date-editor),
:deep(.el-dialog .el-select) {
  width: 100%;
}
</style>
