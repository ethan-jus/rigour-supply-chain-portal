<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Edit } from '@element-plus/icons-vue'
import { errorMessage } from '@/api/core/error'
import {
  getTargetSettings,
  saveTargetSettings,
  getTargetHistory,
  type TargetSettings,
  type TargetDimension,
  type TargetMetric,
  type TargetSubject,
  type TargetChange,
  type TargetHistory,
} from '@/api/core/hr-target-settings'
import { targetMetrics, targetCell, targetKey, targetValueError } from './target-settings-model'
const month = ref(
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()),
)
const dimension = ref<TargetDimension>('CITY')
const data = ref<TargetSettings | null>(null)
const busy = ref(false),
  saving = ref(false),
  error = ref('')
const search = ref(''),
  selectedCity = ref(''),
  employment = ref('ALL'),
  page = ref(1)
const selection = ref<string[]>([])
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
    // Reject incomplete values instead of inventing frontend defaults.
    for (const subject of result.subjects)
      for (const metric of targetMetrics) targetCell(result, subject, metric.code)
    if (id === loadId) data.value = result
  } catch (e) {
    if (id === loadId) error.value = errorMessage(e, '指标加载失败，请重试')
  } finally {
    if (id === loadId) busy.value = false
  }
}
watch(month, load, { immediate: true })
const locked = computed(() => saving.value || editing.value || preview.value)
const cities = computed(() => data.value?.subjects.filter((s) => s.dimensionType === 'CITY') ?? [])
const sales = computed(
  () => data.value?.subjects.filter((s) => s.dimensionType === 'SALES_OWNER') ?? [],
)
const cityOptions = computed(() => [
  ...new Map([
    ...cities.value.map((c) => [c.code, c.name] as const),
    ...sales.value
      .filter((s) => s.cityCode)
      .map((s) => [s.cityCode!, s.cityName || s.cityCode!] as const),
  ]).entries(),
])
const rows = computed(() =>
  (dimension.value === 'CITY' ? cities.value : sales.value).filter(
    (s) =>
      (dimension.value === 'CITY' || !selectedCity.value || s.cityCode === selectedCity.value) &&
      (dimension.value === 'CITY' ||
        employment.value === 'ALL' ||
        s.employmentStatus === employment.value) &&
      `${s.name} ${s.code} ${s.departmentName ?? ''}`.includes(search.value.trim()),
  ),
)
const visibleRows = computed(() => rows.value.slice((page.value - 1) * 20, page.value * 20))
const selected = computed(() =>
  rows.value.filter((s) => s.writable && selection.value.includes(targetKey(s))),
)
const allSelected = computed(
  () =>
    visibleRows.value.some((s) => s.writable) &&
    visibleRows.value
      .filter((s) => s.writable)
      .every((s) => selection.value.includes(targetKey(s))),
)
watch([dimension, search, selectedCity, employment], () => {
  page.value = 1
  selection.value = []
})
function toggle(subject: TargetSubject) {
  const key = targetKey(subject)
  selection.value = selection.value.includes(key)
    ? selection.value.filter((k) => k !== key)
    : [...selection.value, key]
}
function toggleAll() {
  const keys = visibleRows.value.filter((s) => s.writable).map(targetKey)
  selection.value = allSelected.value
    ? selection.value.filter((k) => !keys.includes(k))
    : [...new Set([...selection.value, ...keys])]
}
const cell = (subject: TargetSubject, metric: TargetMetric) =>
  targetCell(data.value!, subject, metric)
const format = (value: number | string) =>
  Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
function edit(subjects: TargetSubject[]) {
  editingSubjects.value = subjects.filter((s) => s.writable)
  if (!editingSubjects.value.length) return
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
  if (!reason.value.trim()) {
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
  return targetMetrics.find((m) => m.code === metric)?.label ?? metric
}
</script>

<template>
  <section class="hr-target-settings">
    <div class="target-breadcrumb">人事 / 指标设置</div>
    <header class="target-header">
      <div>
        <h1>指标设置</h1>
        <p>按月维护城市与销售目标，保存后同步至看板</p>
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
    <nav class="target-tabs" aria-label="指标类型">
      <button
        :class="{ active: dimension === 'CITY' }"
        :disabled="locked"
        @click="dimension = 'CITY'"
      >
        城市指标 <span v-if="data">{{ cities.length }}</span>
      </button>
      <button
        :class="{ active: dimension === 'SALES_OWNER' }"
        :disabled="locked"
        @click="dimension = 'SALES_OWNER'"
      >
        销售指标 <span v-if="data">{{ sales.length }}</span>
      </button>
    </nav>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-button v-if="error" :icon="Refresh" @click="load">重新加载</el-button>
    <el-skeleton v-else-if="busy" :rows="6" animated class="target-loading" />
    <div
      v-else-if="data"
      class="target-workspace"
      :class="{ 'with-cities': dimension === 'SALES_OWNER' }"
    >
      <aside v-if="dimension === 'SALES_OWNER'" class="target-city-nav" aria-label="销售所属部门">
        <h2>所属部门</h2>
        <button :class="{ active: !selectedCity }" :disabled="locked" @click="selectedCity = ''">
          全部部门 <span>{{ sales.length }}</span>
        </button>
        <button
          v-for="[code, name] in cityOptions"
          :key="code"
          :class="{ active: selectedCity === code }"
          :disabled="locked"
          @click="selectedCity = code"
        >
          {{ name }}<span>{{ sales.filter((s) => s.cityCode === code).length }}</span>
        </button>
      </aside>
      <main class="target-panel">
        <div class="target-toolbar">
          <h2>
            {{
              dimension === 'CITY'
                ? '城市月度指标'
                : cityOptions.find((c) => c[0] === selectedCity)?.[1] || '全部销售'
            }}
            <small>{{ rows.length }}{{ dimension === 'CITY' ? '个城市' : '人' }}</small>
          </h2>
          <div class="target-filters">
            <el-input
              v-model="search"
              :prefix-icon="Search"
              clearable
              :disabled="locked"
              :placeholder="dimension === 'CITY' ? '搜索城市' : '搜索姓名 / 工号'"
              aria-label="搜索指标对象"
            />
            <el-select
              v-if="dimension === 'SALES_OWNER'"
              v-model="employment"
              :disabled="locked"
              aria-label="在职状态"
              ><el-option label="全部状态" value="ALL" /><el-option
                label="在职"
                value="ACTIVE" /><el-option label="离职" value="LEFT"
            /></el-select>
          </div>
        </div>
        <div v-if="selected.length" class="target-selection">
          <span>已选 {{ selected.length }} 项</span
          ><el-button type="primary" plain size="small" :disabled="locked" @click="edit(selected)"
            >批量修改</el-button
          ><el-button link :disabled="locked" @click="selection = []">取消选择</el-button>
        </div>
        <div class="target-table-scroll">
          <table class="target-table">
            <thead>
              <tr>
                <th class="check">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    :disabled="locked"
                    aria-label="选择当前页"
                    @change="toggleAll"
                  />
                </th>
                <th>{{ dimension === 'CITY' ? '城市' : '销售人员' }}</th>
                <th v-for="metric in targetMetrics" :key="metric.code">
                  {{ metric.label }}<small>{{ metric.unit }}</small>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="subject in visibleRows" :key="targetKey(subject)">
                <td class="check">
                  <input
                    type="checkbox"
                    :checked="selection.includes(targetKey(subject))"
                    :disabled="!subject.writable || locked"
                    :aria-label="`选择${subject.name}`"
                    @change="toggle(subject)"
                  />
                </td>
                <td class="target-name">
                  <strong>{{ subject.name }}</strong
                  ><small>{{
                    dimension === 'CITY'
                      ? subject.code
                      : `${subject.code} · ${subject.departmentName || ''}`
                  }}</small>
                </td>
                <td v-for="metric in targetMetrics" :key="metric.code" class="target-number">
                  {{ format(cell(subject, metric.code).value) }}
                </td>
                <td class="target-actions">
                  <el-button
                    v-if="subject.writable"
                    link
                    type="primary"
                    :icon="Edit"
                    :disabled="locked"
                    :aria-label="`修改${subject.name}指标`"
                    @click="edit([subject])"
                    >修改</el-button
                  ><el-button link :disabled="locked" @click="showHistory(subject)">记录</el-button>
                </td>
              </tr>
              <tr v-if="!visibleRows.length">
                <td colspan="7" class="target-empty">
                  {{
                    search
                      ? '没有匹配的记录'
                      : '销售部下暂无可见的' + (dimension === 'CITY' ? '子部门' : '销售人员')
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer class="target-footer">
          <span>名单随销售部组织和员工档案更新 · 0 表示不考核</span
          ><el-pagination
            v-model:current-page="page"
            :page-size="20"
            :total="rows.length"
            layout="prev, pager, next"
            :disabled="locked"
          />
        </footer>
      </main>
    </div>
    <el-dialog
      v-model="editing"
      :title="
        editingSubjects.length === 1
          ? `修改${editingSubjects[0]?.name}指标`
          : `批量修改 ${editingSubjects.length} 项`
      "
      width="560px"
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
    </el-dialog>
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
        <table class="target-table">
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
    <el-drawer v-model="historyOpen" :title="`${historyTitle} · 修改记录`" size="460px">
      <el-skeleton v-if="historyBusy" :rows="5" animated />
      <el-alert v-else-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-empty v-else-if="!history.length" description="本月暂无修改记录" />
      <div
        v-for="item in history"
        :key="`${item.metric}:${item.revision}`"
        class="target-history-item"
      >
        <strong>{{ metricName(item.metric) }} → {{ format(item.value) }}</strong>
        <p>{{ item.reason }}</p>
        <small
          >{{ new Date(item.occurredAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }} ·
          {{ item.actor }}</small
        >
      </div>
    </el-drawer>
  </section>
</template>
<style scoped lang="scss" src="./target-settings.scss"></style>
