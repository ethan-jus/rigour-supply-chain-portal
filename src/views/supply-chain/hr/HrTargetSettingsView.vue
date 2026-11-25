<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, OfficeBuilding, User, Search, Refresh, Edit } from '@element-plus/icons-vue'
import { errorMessage } from '@/api/core/error'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyFilterTabs from '@/components/supply/SupplyFilterTabs.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import { displayRecordDateTime } from '@/utils/business-display'
import { displayValue } from '@/utils/business-display'
import {
  getTargetSettings,
  saveTargetSettings,
  getTargetHistory,
  type TargetSettings,
  type TargetMetric,
  type TargetSubject,
  type TargetChange,
  type TargetHistory,
} from '@/api/core/hr-target-settings'
import {
  targetMetrics,
  targetCell,
  targetKey,
  targetValueError,
  targetTree,
  targetTreeRows,
} from './target-settings-model'
const businessMonth = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
function offsetMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, number! - 1 + offset, 1)).toISOString().slice(0, 7)
}
const currentMonth = ref(businessMonth())
const nextMonth = computed(() => offsetMonth(currentMonth.value, 1))
const month = ref(currentMonth.value)
const data = ref<TargetSettings | null>(null)
const busy = ref(false),
  saving = ref(false),
  error = ref('')
const query = ref('')
const expanded = ref(new Set<string>())
const searchCollapsed = ref(new Set<string>())
const detachedExpanded = ref(false)
const selection = ref<string[]>([])
const scroller = ref<HTMLElement | null>(null)
const editing = ref(false),
  editingSubjects = ref<TargetSubject[]>([]),
  reason = ref(''),
  editorError = ref('')
const draft = ref<Record<string, { checked: boolean; value: string }>>({})
const preview = ref(false),
  pending = ref<TargetChange[]>([])
const historyOpen = ref(false),
  historyBusy = ref(false),
  historyError = ref(''),
  historyTitle = ref(''),
  history = ref<TargetHistory[]>([])
let loadId = 0,
  historyId = 0
async function load() {
  const id = ++loadId,
    requestedMonth = month.value
  busy.value = true
  error.value = ''
  pending.value = []
  data.value = null
  selection.value = []
  try {
    const result = await getTargetSettings(requestedMonth)
    if (!result.archived) {
      // Live inputs are required. Legacy archive cells can legitimately be missing.
      for (const subject of result.subjects)
        for (const metric of targetMetrics) targetCell(result, subject, metric.code)
    }
    if (id === loadId) data.value = result
  } catch (e) {
    if (id === loadId) error.value = errorMessage(e, '指标加载失败，请重试')
  } finally {
    if (id === loadId) busy.value = false
  }
}
watch(
  month,
  () => {
    query.value = ''
    expanded.value.clear()
    searchCollapsed.value.clear()
    if (scroller.value) scroller.value.scrollTop = 0
    void load()
  },
  { immediate: true },
)
onActivated(() => {
  const latest = businessMonth()
  const wasCurrent = month.value === currentMonth.value
  if (latest !== currentMonth.value) {
    currentMonth.value = latest
    if (wasCurrent) {
      month.value = latest
      return
    }
  }
  if (!busy.value && !locked.value && data.value && !data.value.archived) void load()
})
const locked = computed(() => saving.value || editing.value || preview.value || historyOpen.value)
const archived = computed(() => data.value?.archived ?? month.value < currentMonth.value)
const rows = computed(() => {
  const settings = data.value
  if (!settings) return []
  // The page and HR service may be updated independently during DEV verification.
  const savedSubjects = new Set(
    settings.targets
      .filter((target) => target.revision > 0)
      .map((target) => `${target.dimensionType}:${target.code}`),
  )
  return settings.subjects.filter(
    (subject) =>
      subject.dimensionType !== 'SALES_OWNER' ||
      subject.departmentName !== '销售部' ||
      (archived.value && savedSubjects.has(targetKey(subject))),
  )
})
const knownTree = computed(() =>
  targetTree(rows.value.filter((subject) => !subject.historicalPlacementUnknown)),
)
const unknownTree = computed(() =>
  targetTree(rows.value.filter((subject) => subject.historicalPlacementUnknown)),
)
const departmentRoots = computed(() =>
  knownTree.value.filter((node) => node.subject.dimensionType === 'CITY'),
)
const treeRows = computed(() =>
  targetTreeRows(departmentRoots.value, query.value, expanded.value, searchCollapsed.value),
)
const detachedRows = computed(() =>
  targetTreeRows(
    knownTree.value.filter((node) => node.subject.dimensionType === 'SALES_OWNER'),
    query.value,
    expanded.value,
    searchCollapsed.value,
  ),
)
const showDetached = computed(
  () => !departmentRoots.value.length || !!query.value.trim() || detachedExpanded.value,
)
const unknownRows = computed(() =>
  targetTreeRows(unknownTree.value, query.value, expanded.value, searchCollapsed.value),
)
const groups = computed(() =>
  [
    { key: 'tree', label: '', rows: treeRows.value, visible: true },
    {
      key: 'detached',
      label: departmentRoots.value.length ? '其他可见销售' : '',
      rows: detachedRows.value,
      visible: showDetached.value,
    },
    { key: 'unknown', label: '历史归属待核实', rows: unknownRows.value, visible: true },
  ].filter((group) => group.rows.length),
)
const visibleCount = computed(() =>
  groups.value.reduce((count, group) => count + (group.visible ? group.rows.length : 0), 0),
)
const writableRows = computed(() =>
  groups.value.flatMap((group) =>
    group.visible ? group.rows.filter((row) => row.subject.writable).map((row) => row.subject) : [],
  ),
)
const selected = computed(() =>
  rows.value.filter((s) => s.writable && selection.value.includes(targetKey(s))),
)
const allSelected = computed(
  () =>
    writableRows.value.length > 0 &&
    writableRows.value.every((s) => selection.value.includes(targetKey(s))),
)
const periodTab = computed(() =>
  month.value < currentMonth.value
    ? 'history'
    : month.value === currentMonth.value
      ? 'current'
      : month.value === nextMonth.value
        ? 'next'
        : 'other',
)
let lastHistoricalMonth = offsetMonth(currentMonth.value, -1)
function selectMonth(tab: string) {
  if (locked.value || tab === periodTab.value) return
  if (tab === 'history') month.value = lastHistoricalMonth
  if (tab === 'current') month.value = currentMonth.value
  if (tab === 'next') month.value = nextMonth.value
}
watch(month, (value) => {
  if (value < currentMonth.value) lastHistoricalMonth = value
})
watch(query, () => {
  selection.value = []
  searchCollapsed.value.clear()
  if (scroller.value) scroller.value.scrollTop = 0
})
function toggleBranch(subject: TargetSubject) {
  const state = query.value.trim() ? searchCollapsed.value : expanded.value
  const key = targetKey(subject)
  if (state.has(key)) state.delete(key)
  else state.add(key)
}
function expandAll() {
  detachedExpanded.value = true
  expanded.value = new Set(rows.value.filter((s) => s.dimensionType === 'CITY').map(targetKey))
  searchCollapsed.value.clear()
}
function collapseAll() {
  detachedExpanded.value = false
  expanded.value.clear()
  searchCollapsed.value = new Set(
    rows.value.filter((s) => s.dimensionType === 'CITY').map(targetKey),
  )
}
function toggle(subject: TargetSubject) {
  const key = targetKey(subject)
  selection.value = selection.value.includes(key)
    ? selection.value.filter((k) => k !== key)
    : [...selection.value, key]
}
function toggleAll() {
  const keys = writableRows.value.map(targetKey)
  selection.value = allSelected.value
    ? selection.value.filter((k) => !keys.includes(k))
    : [...new Set([...selection.value, ...keys])]
}
const targetMap = computed(
  () =>
    new Map(
      data.value?.targets.map((target) => [
        `${target.dimensionType}:${target.code}:${target.metric}`,
        target,
      ]),
    ),
)
const visibleValue = (subject: TargetSubject, metric: TargetMetric) =>
  targetMap.value.get(`${targetKey(subject)}:${metric}`)
const status = (subject: TargetSubject) =>
  archived.value
    ? '已归档'
    : targetMetrics.some((metric) => (visibleValue(subject, metric.code)?.revision ?? 0) > 0)
      ? '已保存'
      : '系统默认'
const cell = (subject: TargetSubject, metric: TargetMetric) =>
  targetCell(data.value!, subject, metric)
const format = (value: number | string) =>
  Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
function edit(subjects: TargetSubject[]) {
  editingSubjects.value = subjects.filter((s) => s.writable)
  if (archived.value || !editingSubjects.value.length) return
  draft.value = Object.fromEntries(
    targetMetrics.map((m) => [
      m.code,
      {
        checked: subjects.length === 1,
        value: subjects.length === 1 ? String(cell(subjects[0]!, m.code).value) : '',
      },
    ]),
  )
  reason.value = ''
  editorError.value = ''
  editing.value = true
}
function review() {
  editorError.value = ''
  const changes: TargetChange[] = []
  for (const metric of targetMetrics) {
    const field = draft.value[metric.code]!
    if (!field.checked) continue
    const invalid = targetValueError(metric.code, field.value)
    if (invalid) {
      editorError.value = `${metric.label}：${invalid}`
      return
    }
    for (const subject of editingSubjects.value) {
      const existing = cell(subject, metric.code)
      if (Number(field.value) !== existing.value)
        changes.push({
          dimensionType: subject.dimensionType,
          code: subject.code,
          metric: metric.code,
          value: field.value.trim(),
          expectedRevision: existing.revision,
        })
    }
  }
  if (!changes.length) {
    editorError.value = '没有需要保存的变更'
    return
  }
  if (changes.length > 800) {
    editorError.value = '一次最多保存800项指标，请减少选择数量'
    return
  }
  if (month.value <= currentMonth.value && !reason.value.trim()) {
    editorError.value = '请填写修改原因'
    return
  }
  pending.value = changes
  preview.value = true
}
async function save() {
  if (saving.value) return
  saving.value = true
  editorError.value = ''
  try {
    await saveTargetSettings({
      month: month.value,
      changes: pending.value,
      reason: reason.value.trim(),
    })
    preview.value = false
    editing.value = false
    ElMessage.success('指标已保存')
    await load()
  } catch (e) {
    preview.value = false
    editorError.value = errorMessage(e, '保存失败，请重试')
  } finally {
    saving.value = false
  }
}
async function showHistory(subject: TargetSubject) {
  const id = ++historyId
  historyTitle.value = subject.name
  history.value = []
  historyError.value = ''
  historyBusy.value = true
  historyOpen.value = true
  try {
    const result = await getTargetHistory(month.value, subject.dimensionType, subject.code)
    if (id === historyId) history.value = result
  } catch (e) {
    if (id === historyId) historyError.value = errorMessage(e, '记录加载失败')
  } finally {
    if (id === historyId) historyBusy.value = false
  }
}
function changeName(change: TargetChange) {
  return (
    editingSubjects.value.find(
      (s) => s.code === change.code && s.dimensionType === change.dimensionType,
    )?.name ?? change.code
  )
}
function metricName(metric: string) {
  return (
    targetMetrics.find((m) => m.code === metric)?.label ??
    (
      { NEW_CUSTOMER: '新增合作客户（旧指标）', REPEAT_CUSTOMER: '复购客户（旧指标）' } as Record<
        string,
        string
      >
    )[metric] ??
    metric
  )
}
</script>

<template>
  <section class="hr-target-settings">
    <header class="target-header">
      <div class="target-heading">
        <SupplyPageTitle>月度经营目标</SupplyPageTitle>
        <p>{{ archived ? '按该月留存的部门和人员查看' : '按当前 HR 部门及在职销售维护' }}</p>
      </div>
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        format="YYYY年MM月"
        :clearable="false"
        :disabled="locked"
        aria-label="指标月份"
      />
    </header>
    <SupplyFilterTabs
      class="target-tabs"
      :model-value="periodTab"
      label="经营目标月份"
      :items="[
        { value: 'current', label: '本月' },
        { value: 'next', label: '下月' },
        { value: 'history', label: '历史月份' },
      ]"
      @update:model-value="selectMonth"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-button v-if="error" :icon="Refresh" @click="load">重新加载</el-button>
    <el-skeleton v-else-if="busy" :rows="6" animated class="target-loading" />
    <section v-else-if="data" class="target-panel" aria-label="部门和销售指标">
      <div class="target-controls">
        <div class="list-filter-group">
          <div class="list-filter-field list-filter-field--product">
            <el-input
              v-model="query"
              :prefix-icon="Search"
              clearable
              :disabled="locked"
              placeholder="部门、销售或编号"
              aria-label="搜索部门或销售人员"
            />
          </div>
          <el-button
            v-if="selected.length"
            type="primary"
            plain
            :disabled="locked"
            @click="edit(selected)"
          >
            批量设置（{{ selected.length }}）
          </el-button>
        </div>
        <div class="list-filter-group">
          <el-button :disabled="locked || !rows.length" @click="expandAll">展开所有部门</el-button>
          <el-button
            :disabled="locked || (!treeRows.some((row) => row.open) && !detachedExpanded)"
            @click="collapseAll"
            >收起层级</el-button
          >
          <el-button :icon="Refresh" :disabled="locked" aria-label="刷新目标" @click="load" />
        </div>
      </div>
      <div ref="scroller" class="target-table-scroll" tabindex="0" aria-label="滚动查看目标列表">
        <table class="supply-data-table target-table">
          <thead>
            <tr>
              <th v-if="!archived" class="check" scope="col">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :disabled="locked || !writableRows.length"
                  aria-label="选择当前展开的可编辑行"
                  @change="toggleAll"
                />
              </th>
              <th class="target-subject" scope="col">部门 / 销售人员</th>
              <th
                v-for="metric in targetMetrics"
                :key="metric.code"
                class="target-number"
                scope="col"
                :title="metric.description"
              >
                {{ metric.label }}<small>{{ metric.unit }}</small>
              </th>
              <th scope="col">指标状态</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.key">
            <tr v-if="group.label" class="target-history-group">
              <th scope="rowgroup" :colspan="targetMetrics.length + (archived ? 3 : 4)">
                <button
                  v-if="group.key === 'detached' && !query.trim()"
                  type="button"
                  class="target-group-toggle"
                  :aria-expanded="group.visible"
                  :disabled="locked"
                  @click="detachedExpanded = !detachedExpanded"
                >
                  <el-icon><ArrowRight /></el-icon>{{ group.label }}（{{ group.rows.length }}）
                </button>
                <template v-else>{{ group.label }}</template>
              </th>
            </tr>
            <tr
              v-for="{ subject, depth, hasChildren, open } in group.visible ? group.rows : []"
              :key="targetKey(subject)"
              :class="{ 'target-root': depth === 0 && subject.dimensionType === 'CITY' }"
            >
              <td v-if="!archived" class="check">
                <input
                  v-if="subject.writable"
                  type="checkbox"
                  :disabled="locked"
                  :checked="selection.includes(targetKey(subject))"
                  :aria-label="`选择${subject.name}`"
                  @change="toggle(subject)"
                />
              </td>
              <th scope="row" class="target-name">
                <div class="target-node" :style="{ paddingInlineStart: `${depth * 20}px` }">
                  <button
                    v-if="hasChildren"
                    type="button"
                    class="target-tree-toggle"
                    :disabled="locked"
                    :aria-expanded="open"
                    :aria-label="`${open ? '收起' : '展开'}${subject.name}`"
                    @click="toggleBranch(subject)"
                  >
                    <el-icon><ArrowRight /></el-icon>
                  </button>
                  <span v-else class="target-tree-space" aria-hidden="true" />
                  <el-icon aria-hidden="true"
                    ><OfficeBuilding v-if="subject.dimensionType === 'CITY'" /><User v-else
                  /></el-icon>
                  <span :title="`${subject.name} · ${subject.code}`">{{ subject.name }}</span>
                </div>
              </th>
              <td v-for="metric in targetMetrics" :key="metric.code" class="target-number">
                {{
                  visibleValue(subject, metric.code)
                    ? format(visibleValue(subject, metric.code)!.value)
                    : '—'
                }}
              </td>
              <td>
                <span
                  class="target-status"
                  :class="{ 'target-status--saved': status(subject) === '已保存' }"
                >
                  {{ status(subject) }}
                </span>
              </td>
              <td class="target-actions">
                <el-button
                  v-if="!archived && subject.writable"
                  link
                  type="primary"
                  :icon="Edit"
                  :disabled="locked"
                  :aria-label="`修改${subject.name}指标`"
                  @click="edit([subject])"
                  >设置</el-button
                >
                <el-button
                  link
                  :disabled="locked"
                  :aria-label="`查看${subject.name}修改记录`"
                  @click="showHistory(subject)"
                  >记录</el-button
                >
              </td>
            </tr>
          </tbody>
          <tbody v-if="!groups.length">
            <tr>
              <td :colspan="targetMetrics.length + (archived ? 3 : 4)" class="target-empty">
                {{
                  query
                    ? '没有匹配的部门或销售人员'
                    : archived
                      ? '该月暂无历史目标或可核实的组织记录'
                      : '暂无可见的部门和销售人员'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ListTableFooter class="target-footer">
        <template #actions>
          <span
            >{{ rows.filter((s) => s.dimensionType === 'CITY').length }} 个部门 ·
            {{ rows.filter((s) => s.dimensionType === 'SALES_OWNER').length }} 名销售 · 当前显示
            {{ visibleCount }} 行</span
          >
        </template>
        <span>0 表示不考核</span>
      </ListTableFooter>
    </section>
    <el-drawer
      v-model="editing"
      class="business-detail-panel"
      :title="
        editingSubjects.length === 1
          ? `修改${editingSubjects[0]?.name}指标`
          : `批量修改 ${editingSubjects.length} 项`
      "
      size="min(480px, 100vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <p class="target-dialog-month">{{ month }} 月度指标</p>
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" show-icon />
      <form class="target-edit-form" @submit.prevent="review">
        <div v-for="metric in targetMetrics" :key="metric.code" class="target-edit-row">
          <el-checkbox
            v-if="editingSubjects.length > 1"
            v-model="draft[metric.code]!.checked"
            :disabled="saving"
            :aria-label="`修改${metric.label}`"
          />
          <label :for="`target-${metric.code}`">{{ metric.label }}</label>
          <el-input
            :id="`target-${metric.code}`"
            v-model="draft[metric.code]!.value"
            :disabled="saving || !draft[metric.code]!.checked"
            inputmode="decimal"
            ><template #append>{{ metric.unit }}</template></el-input
          >
        </div>
        <label for="target-reason">修改原因</label
        ><el-input
          id="target-reason"
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="1000"
          show-word-limit
          :disabled="saving"
          placeholder="填写本次调整原因"
        />
      </form>
      <template #footer
        ><el-button :disabled="saving" @click="editing = false">取消</el-button
        ><el-button type="primary" :disabled="saving" @click="review">预览变更</el-button></template
      >
    </el-drawer>
    <el-dialog
      v-model="preview"
      title="确认指标变更"
      width="640px"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <p>{{ month }} · 共 {{ pending.length }} 项变更</p>
      <div class="target-preview">
        <table class="supply-data-table target-table">
          <thead>
            <tr>
              <th>对象</th>
              <th>指标</th>
              <th>调整前</th>
              <th>调整后</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="change in pending" :key="`${change.code}:${change.metric}`">
              <td>{{ changeName(change) }}</td>
              <td>{{ metricName(change.metric) }}</td>
              <td>
                {{
                  format(
                    cell(
                      editingSubjects.find(
                        (s) => s.code === change.code && s.dimensionType === change.dimensionType,
                      )!,
                      change.metric,
                    ).value,
                  )
                }}
              </td>
              <td>
                <strong>{{ format(change.value) }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer
        ><el-button :disabled="saving" @click="preview = false">返回修改</el-button
        ><el-button type="primary" :loading="saving" @click="save">确认保存</el-button></template
      >
    </el-dialog>
    <el-drawer
      class="business-detail-panel"
      v-model="historyOpen"
      :title="`${historyTitle} · 修改记录`"
      size="460px"
    >
      <el-skeleton v-if="historyBusy" :rows="5" animated />
      <el-alert v-else-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-empty v-else-if="!history.length" description="本月暂无修改记录" />
      <div
        v-for="item in history"
        :key="`${item.metric}:${item.revision}`"
        class="target-history-item"
      >
        <dl class="business-detail-fields">
          <div>
            <dt>经营指标</dt>
            <dd>{{ metricName(item.metric) }}</dd>
          </div>
          <div>
            <dt>目标值</dt>
            <dd>{{ format(item.value) }}</dd>
          </div>
          <div class="business-detail-field-wide">
            <dt>修改原因</dt>
            <dd>{{ displayValue(item.reason) }}</dd>
          </div>
          <div>
            <dt>修改时间</dt>
            <dd>
              {{ displayRecordDateTime(item.occurredAt) }}
            </dd>
          </div>
          <div>
            <dt>修改人</dt>
            <dd>{{ displayValue(item.actor) }}</dd>
          </div>
        </dl>
      </div>
    </el-drawer>
  </section>
</template>
<style scoped lang="scss" src="./target-settings.scss"></style>
