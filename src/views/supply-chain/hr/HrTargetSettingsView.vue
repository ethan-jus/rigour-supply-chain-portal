<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search,
  Setting,
  CopyDocument,
  MoreFilled,
  InfoFilled,
  Refresh,
  Edit,
} from '@element-plus/icons-vue'
import { errorMessage } from '@/api/core/error'
import {
  getTargetSettings,
  saveTargetSettings,
  saveTargetDefaults,
  getTargetHistory,
  type TargetSettings,
  type TargetDimension,
  type TargetMetric,
  type TargetSubject,
  type TargetChange,
  type DefaultBatch,
  type TargetHistory,
} from '@/api/core/bi-target-settings'
import {
  targetMetrics,
  targetCell,
  defaultTarget,
  targetKey,
  targetValueError,
  previousMonth,
  copyPreviousTargets,
} from './target-settings-model'

const currentMonth = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
const month = ref(currentMonth())
const dimension = ref<TargetDimension>('CITY')
const data = ref<TargetSettings | null>(null)
const busy = ref(false),
  saving = ref(false),
  error = ref('')
const search = ref(''),
  citySearch = ref(''),
  selectedCity = ref(''),
  status = ref(''),
  employment = ref('ACTIVE')
const selection = ref<string[]>([]),
  page = ref(1)
const editorElement = ref<HTMLElement | null>(null)
const editing = ref(false),
  editorSubjects = ref<TargetSubject[]>([]),
  reason = ref('')
type TargetDraft = Record<
  TargetMetric,
  { checked: boolean; mode: 'set' | 'default'; value: string }
>
const draft = ref<TargetDraft>(emptyDraft())
const preview = ref(false),
  pending = ref<TargetChange[]>([])
const defaultsOpen = ref(false),
  defaultMonth = ref(''),
  defaultType = ref<TargetDimension>('CITY')
const defaultDraft = ref<Record<string, string>>({}),
  defaultReason = ref(''),
  pendingDefault = ref<DefaultBatch | null>(null)
const historyOpen = ref(false),
  historyBusy = ref(false),
  historyTitle = ref(''),
  history = ref<TargetHistory[]>([]),
  historyError = ref('')
let loadId = 0,
  historyId = 0
function emptyDraft(): TargetDraft {
  return Object.fromEntries(
    targetMetrics.map((m) => [m.code, { checked: false, mode: 'set', value: '' }]),
  ) as TargetDraft
}
async function load() {
  const id = ++loadId
  busy.value = true
  error.value = ''
  data.value = null
  selection.value = []
  try {
    const result = await getTargetSettings(month.value)
    if (id === loadId) data.value = result
  } catch (e) {
    if (id === loadId) error.value = errorMessage(e, '指标操作失败，请重试')
  } finally {
    if (id === loadId) busy.value = false
  }
}
watch(month, load, { immediate: true })
const locked = computed(() => saving.value || editing.value || preview.value)
const cities = computed(() => data.value?.subjects.filter((s) => s.dimensionType === 'CITY') ?? [])
const cityOptions = computed(() => {
  const map = new Map(cities.value.map((c) => [c.code, { code: c.code, name: c.name }]))
  for (const s of data.value?.subjects ?? [])
    if (s.dimensionType === 'SALES_OWNER' && s.cityCode && !map.has(s.cityCode))
      map.set(s.cityCode, { code: s.cityCode, name: s.cityName || s.cityCode })
  return [...map.values()].filter((c) => c.name.includes(citySearch.value.trim()))
})
const sales = computed(
  () => data.value?.subjects.filter((s) => s.dimensionType === 'SALES_OWNER') ?? [],
)
const countCity = (code: string) =>
  sales.value.filter(
    (s) => s.cityCode === code && (!employment.value || s.employmentStatus === employment.value),
  ).length
const configuredCount = (s: TargetSubject) =>
  data.value ? targetMetrics.filter((m) => targetCell(data.value!, s, m.code).configured).length : 0
const rows = computed(() =>
  (dimension.value === 'CITY' ? cities.value : sales.value).filter(
    (s) =>
      (dimension.value === 'CITY' ||
        !selectedCity.value ||
        (selectedCity.value === '__unknown' ? !s.cityCode : s.cityCode === selectedCity.value)) &&
      (dimension.value === 'CITY' ||
        !employment.value ||
        s.employmentStatus === employment.value) &&
      (!search.value.trim() ||
        `${s.name} ${s.code} ${s.departmentName || ''}`.includes(search.value.trim())) &&
      (!status.value ||
        (status.value === 'default' ? configuredCount(s) === 0 : configuredCount(s) > 0)),
  ),
)
const visibleRows = computed(() => rows.value.slice((page.value - 1) * 20, page.value * 20))
const selected = computed(() => rows.value.filter((s) => selection.value.includes(targetKey(s))))
const allSelected = computed(
  () =>
    visibleRows.value.some((s) => s.writable) &&
    visibleRows.value
      .filter((s) => s.writable)
      .every((s) => selection.value.includes(targetKey(s))),
)
watch([search, selectedCity, dimension, status, employment], () => {
  selection.value = []
  page.value = 1
})
const cityName = computed(() =>
  selectedCity.value === '__unknown'
    ? '归属待核对'
    : cityOptions.value.find((c) => c.code === selectedCity.value)?.name || '全部城市',
)
const citySummary = computed(() => {
  if (!data.value || !selectedCity.value) return null
  const city = cities.value.find((c) => c.code === selectedCity.value)
  if (!city) return null
  // A restricted sales list must not be advertised as the complete city staffing total.
  const total =
    sales.value
      .filter((s) => s.cityCode === city.code && s.employmentStatus === 'ACTIVE')
      .reduce(
        (sum, s) => sum + Math.round(targetCell(data.value!, s, 'SALES_AMOUNT').value * 100),
        0,
      ) / 100
  const cityTarget = targetCell(data.value, city, 'SALES_AMOUNT').value
  return { cityTarget, total, difference: total - cityTarget }
})
function toggle(s: TargetSubject) {
  const key = targetKey(s)
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
function cell(s: TargetSubject, metric: TargetMetric) {
  return targetCell(data.value!, s, metric)
}
function format(value: number | string | null | undefined) {
  return value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
function updated(s: TargetSubject) {
  return data.value?.overrides
    .filter((o) => o.dimensionType === s.dimensionType && o.code === s.code && o.updatedAt)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0]
}
function dateText(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—'
}
function begin(subjects = selected.value) {
  if (!subjects.length || !data.value) return
  editorSubjects.value = subjects.filter((s) => s.writable)
  if (!editorSubjects.value.length) return
  reason.value = ''
  draft.value = emptyDraft()
  for (const m of targetMetrics) {
    const one = editorSubjects.value.length === 1 ? cell(editorSubjects.value[0]!, m.code) : null
    draft.value[m.code] = {
      checked: !!one,
      mode: one && !one.configured ? 'default' : 'set',
      value: String(one?.value ?? defaultTarget(data.value, dimension.value, m.code)),
    }
  }
  editing.value = true
  void nextTick(() => editorElement.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}
function cancelEdit() {
  editing.value = false
  pending.value = []
  reason.value = ''
}
function checkReason(value: string, targetMonth = month.value) {
  if (targetMonth <= currentMonth() && !value.trim()) {
    ElMessage.warning('调整当月或历史指标，请填写修改原因')
    return false
  }
  return true
}
function previewEdit() {
  if (!checkReason(reason.value) || !data.value) return
  const changes: TargetChange[] = []
  for (const m of targetMetrics) {
    const d = draft.value[m.code]
    if (!d.checked) continue
    if (d.mode === 'set') {
      const problem = targetValueError(m.code, d.value)
      if (problem) {
        ElMessage.warning(`${m.label}：${problem}`)
        return
      }
    }
    for (const s of editorSubjects.value) {
      const old = cell(s, m.code)
      if (d.mode === 'default' && !old.configured) continue
      if (d.mode === 'set' && old.configured && Number(d.value) === old.value) continue
      changes.push({
        dimensionType: s.dimensionType,
        code: s.code,
        metric: m.code,
        value: d.mode === 'default' ? null : d.value.trim(),
        expectedRevision: old.revision,
      })
    }
  }
  showPreview(changes)
}
function showPreview(changes: TargetChange[]) {
  if (!changes.length) {
    ElMessage.info('没有需要保存的变更')
    return
  }
  if (changes.length > 800) {
    ElMessage.warning('单次最多调整800项指标，请缩小选择范围')
    return
  }
  pending.value = changes
  pendingDefault.value = null
  preview.value = true
}
async function copyPrevious() {
  if (!data.value) return
  const snapshot = data.value
  busy.value = true
  try {
    const prior = await getTargetSettings(previousMonth(month.value))
    const changes = copyPreviousTargets(
      snapshot,
      prior,
      selected.value.length ? selected.value : rows.value,
    )
    reason.value = `复制${previousMonth(month.value)}单独设置的指标，仅填充沿用默认项`
    showPreview(changes)
  } catch (e) {
    ElMessage.error(errorMessage(e, '指标操作失败，请重试'))
  } finally {
    busy.value = false
  }
}
function resetSelected() {
  begin()
  for (const m of targetMetrics) {
    draft.value[m.code].checked = true
    draft.value[m.code].mode = 'default'
  }
}
const previewRows = computed(() =>
  pendingDefault.value
    ? pendingDefault.value.changes.map((c) => ({
        name: `${pendingDefault.value!.dimensionType === 'CITY' ? '城市' : '销售'}默认标准`,
        metric: c.metric,
        before: data.value
          ? defaultTarget(
              data.value,
              pendingDefault.value!.dimensionType,
              c.metric,
              pendingDefault.value!.effectiveMonth,
            )
          : null,
        after: Number(c.value),
        source: '默认标准',
      }))
    : pending.value.map((c) => {
        const subject = data.value!.subjects.find(
          (s) => s.dimensionType === c.dimensionType && s.code === c.code,
        )!
        return {
          name: subject.name,
          metric: c.metric,
          before: cell(subject, c.metric).value,
          after:
            c.value === null
              ? defaultTarget(data.value!, c.dimensionType, c.metric)
              : Number(c.value),
          source: c.value === null ? '沿用默认' : '单独设置',
        }
      }),
)
async function confirmSave() {
  saving.value = true
  try {
    if (pendingDefault.value) await saveTargetDefaults(pendingDefault.value)
    else
      await saveTargetSettings({
        month: month.value,
        changes: pending.value,
        reason: reason.value.trim(),
      })
    preview.value = false
    defaultsOpen.value = false
    cancelEdit()
    ElMessage.success('指标已保存，看板刷新后使用生效目标')
    await load()
  } catch (e) {
    ElMessage.error(errorMessage(e, '指标操作失败，请重试'))
  } finally {
    saving.value = false
  }
}
function openDefaults() {
  const [y, m] = currentMonth().split('-').map(Number)
  defaultMonth.value = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`
  defaultType.value = dimension.value
  defaultReason.value = ''
  defaultsOpen.value = true
  updateDefaultDraft()
}
function updateDefaultDraft() {
  if (data.value)
    defaultDraft.value = Object.fromEntries(
      targetMetrics.map((m) => [
        m.code,
        String(defaultTarget(data.value!, defaultType.value, m.code, defaultMonth.value)),
      ]),
    )
}
watch([defaultMonth, defaultType], updateDefaultDraft)
function previewDefaults() {
  if (!data.value?.defaultsWritable) return
  if (!defaultMonth.value || defaultMonth.value <= currentMonth()) {
    ElMessage.warning('默认标准从下月或之后生效')
    return
  }
  if (!defaultReason.value.trim()) {
    ElMessage.warning('请填写修改原因')
    return
  }
  const changes: DefaultBatch['changes'] = []
  for (const m of targetMetrics) {
    const value = defaultDraft.value[m.code] || ''
    const problem = targetValueError(m.code, value)
    if (problem) {
      ElMessage.warning(`${m.label}：${problem}`)
      return
    }
    const rule = data.value.defaults.find(
      (d) =>
        d.dimensionType === defaultType.value &&
        d.effectiveMonth === defaultMonth.value &&
        d.metric === m.code,
    )
    if (rule && Number(rule.value) === Number(value)) continue
    changes.push({ metric: m.code, value, expectedRevision: rule?.revision ?? 0 })
  }
  if (!changes.length) {
    ElMessage.info('没有需要保存的变更')
    return
  }
  pendingDefault.value = {
    effectiveMonth: defaultMonth.value,
    dimensionType: defaultType.value,
    changes,
    reason: defaultReason.value.trim(),
  }
  pending.value = []
  preview.value = true
}
async function openHistory(s?: TargetSubject) {
  const id = ++historyId
  historyTitle.value = s ? `${s.name} · ${month.value}` : `默认标准 · ${defaultMonth.value}`
  historyOpen.value = true
  historyBusy.value = true
  history.value = []
  historyError.value = ''
  try {
    const result = await getTargetHistory(
      s ? month.value : defaultMonth.value,
      s?.dimensionType ?? defaultType.value,
      s?.code ?? 'DEFAULT',
    )
    if (id === historyId) history.value = result
  } catch (e) {
    if (id === historyId) historyError.value = errorMessage(e, '指标操作失败，请重试')
  } finally {
    if (id === historyId) historyBusy.value = false
  }
}
const metricName = (code: TargetMetric) => targetMetrics.find((m) => m.code === code)?.label || code
</script>

<template>
  <section class="target-settings" :aria-busy="busy">
    <header class="target-header">
      <div>
        <p v-if="dimension === 'CITY'" class="target-breadcrumb">人事 / 指标设置</p>
        <div class="target-title">
          <h1>指标设置</h1>
          <span>按月维护城市与销售目标，保存后同步至看板</span>
        </div>
      </div>
      <div class="target-header-actions">
        <el-date-picker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          format="YYYY年MM月"
          :clearable="false"
          :disabled="locked || busy"
          aria-label="目标月份"
        /><el-button :icon="Setting" :disabled="!data || locked || busy" @click="openDefaults"
          >默认指标</el-button
        >
      </div>
    </header>
    <nav class="target-tabs" :class="{ 'city-tabs': dimension === 'CITY' }" aria-label="指标维度">
      <button
        :class="{ active: dimension === 'CITY' }"
        :disabled="locked || busy"
        @click="dimension = 'CITY'"
      >
        城市指标
      </button>
      <button
        :class="{ active: dimension === 'SALES_OWNER' }"
        :disabled="locked || busy"
        @click="dimension = 'SALES_OWNER'"
      >
        销售指标
      </button>
    </nav>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-button v-if="error" :icon="Refresh" @click="load">重新加载</el-button>
    <div v-if="busy && !data" class="target-loading">正在加载指标…</div>
    <div
      v-if="data"
      class="target-workspace"
      :class="{ 'has-cities': dimension === 'SALES_OWNER' }"
    >
      <aside v-if="dimension === 'SALES_OWNER'" class="target-city-list" aria-label="城市导航">
        <h2>城市</h2>
        <el-input
          v-model="citySearch"
          placeholder="搜索城市"
          :prefix-icon="Search"
          :disabled="locked"
          aria-label="搜索城市"
        />
        <button
          :class="{ active: selectedCity === '' }"
          :disabled="locked || busy"
          @click="selectedCity = ''"
        >
          <span>全部城市</span
          ><small>{{
            sales.filter((s) => !employment || s.employmentStatus === employment).length
          }}</small>
        </button>
        <button
          v-for="c in cityOptions"
          :key="c.code"
          :class="{ active: selectedCity === c.code }"
          :disabled="locked || busy"
          @click="selectedCity = c.code"
        >
          <span>{{ c.name }}</span
          ><small>{{ countCity(c.code) }}</small>
        </button>
        <button
          v-if="sales.some((s) => !s.cityCode)"
          :class="{ active: selectedCity === '__unknown' }"
          :disabled="locked || busy"
          @click="selectedCity = '__unknown'"
        >
          <span>归属待核对</span>
        </button>
      </aside>
      <main class="target-main">
        <template v-if="dimension === 'SALES_OWNER'">
          <div class="target-city-heading">
            <h2>{{ cityName }} · 销售指标</h2>
            <span>当前筛选 {{ rows.length }} 名销售</span>
          </div>
          <div v-if="citySummary" class="target-summary">
            <span
              >城市交易额目标
              <strong>{{ format(citySummary.cityTarget) }} <small>元</small></strong></span
            ><span
              >可见在职销售目标合计
              <strong>{{ format(citySummary.total) }} <small>元</small></strong></span
            ><span class="target-difference"
              >{{ citySummary.difference > 0 ? '+' : '' }}{{ format(citySummary.difference) }} 元
              <small>差额</small></span
            ><small>两类目标独立维护，差额仅作参考。</small>
          </div>
        </template>
        <div class="target-toolbar">
          <el-input
            v-model="search"
            :prefix-icon="Search"
            :placeholder="dimension === 'CITY' ? '搜索城市名称' : '销售姓名 / 员工编号 / 部门'"
            aria-label="搜索指标对象"
            :disabled="locked || busy"
            clearable
          />
          <el-select
            v-model="status"
            placeholder="全部设置状态"
            aria-label="设置状态"
            :disabled="locked || busy"
            clearable
            ><el-option label="全部默认" value="default" /><el-option
              label="已单独设置"
              value="configured"
          /></el-select>
          <el-select
            v-if="dimension === 'SALES_OWNER'"
            v-model="employment"
            aria-label="在职状态"
            :disabled="locked || busy"
            ><el-option label="在职销售" value="ACTIVE" /><el-option
              label="已离职"
              value="LEFT" /><el-option label="全部状态" value=""
          /></el-select>
          <div class="target-toolbar-actions">
            <span v-if="selected.length" class="target-selected"
              >已选 {{ selected.length }} {{ dimension === 'CITY' ? '个城市' : '人' }}</span
            ><el-button
              type="primary"
              :disabled="!selected.length || locked || busy"
              @click="begin()"
              >批量设置</el-button
            ><el-button
              :icon="CopyDocument"
              :disabled="locked || busy || !rows.some((s) => s.writable)"
              @click="copyPrevious"
              >复制上月</el-button
            ><el-dropdown :disabled="locked || busy"
              ><el-button
                :icon="MoreFilled"
                :disabled="locked || busy"
                aria-label="更多操作"
              /><template #dropdown
                ><el-dropdown-menu
                  ><el-dropdown-item :disabled="!selected.length" @click="resetSelected"
                    >恢复所选指标为默认</el-dropdown-item
                  ><el-dropdown-item @click="load">刷新列表</el-dropdown-item></el-dropdown-menu
                ></template
              ></el-dropdown
            >
          </div>
        </div>
        <p v-if="!rows.some((s) => s.writable) && rows.length" class="target-readonly">
          当前范围仅可查看。修改指标需要对应范围的维护权限。
        </p>
        <div class="target-table-scroll">
          <table class="target-table">
            <thead>
              <tr>
                <th class="target-check">
                  <input
                    type="checkbox"
                    aria-label="全选本页"
                    :checked="allSelected"
                    :disabled="locked || busy"
                    @change="toggleAll"
                  />
                </th>
                <th class="target-name">{{ dimension === 'CITY' ? '城市' : '销售 / 员工编号' }}</th>
                <th v-for="m in targetMetrics" :key="m.code" class="numeric">
                  {{ m.label }}<small>（{{ m.unit }}）</small>
                </th>
                <th>设置状态</th>
                <th v-if="dimension === 'CITY'">更新人 / 时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in visibleRows"
                :key="targetKey(s)"
                :class="{ selected: selection.includes(targetKey(s)) }"
              >
                <td class="target-check">
                  <input
                    type="checkbox"
                    :aria-label="`选择${s.name}`"
                    :checked="selection.includes(targetKey(s))"
                    :disabled="!s.writable || locked || busy"
                    @change="toggle(s)"
                  />
                </td>
                <td class="target-name">
                  <strong>{{ s.name }}</strong
                  ><small v-if="dimension === 'SALES_OWNER'">{{ s.code }}</small
                  ><small v-if="dimension === 'SALES_OWNER' && !selectedCity"
                    >{{ s.cityName }} · {{ s.departmentName || '部门待核对' }}</small
                  ><small v-if="s.employmentStatus === 'LEFT'">已离职</small>
                </td>
                <td v-for="m in targetMetrics" :key="m.code" class="numeric">
                  <span>{{
                    cell(s, m.code).value === 0 ? '不考核' : format(cell(s, m.code).value)
                  }}</span
                  ><small :class="{ configured: cell(s, m.code).configured }">{{
                    cell(s, m.code).configured ? '单独设置' : '默认'
                  }}</small>
                </td>
                <td>
                  <span class="target-status" :class="{ configured: configuredCount(s) }">{{
                    configuredCount(s) === 0
                      ? '全部默认'
                      : configuredCount(s) === 4
                        ? '全部设置'
                        : '部分设置'
                  }}</span>
                </td>
                <td v-if="dimension === 'CITY'" class="target-updated">
                  <span :title="updated(s)?.updatedBy || ''">{{
                    updated(s)?.updatedBy || '—'
                  }}</span
                  ><small>{{ dateText(updated(s)?.updatedAt) }}</small>
                </td>
                <td class="target-row-actions">
                  <el-button
                    v-if="s.writable"
                    link
                    type="primary"
                    :disabled="locked || busy"
                    @click="begin([s])"
                    >编辑</el-button
                  ><el-dropdown :disabled="locked || busy"
                    ><el-button
                      link
                      :icon="MoreFilled"
                      :disabled="locked || busy"
                      :aria-label="`${s.name}更多操作`"
                    /><template #dropdown
                      ><el-dropdown-menu
                        ><el-dropdown-item @click="openHistory(s)"
                          >修改记录</el-dropdown-item
                        ></el-dropdown-menu
                      ></template
                    ></el-dropdown
                  >
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="9" class="target-empty">
                  {{
                    search || status
                      ? '没有符合筛选条件的对象'
                      : '当前授权范围暂无可设置的城市或销售'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="target-pagination">
          <el-pagination
            v-model:current-page="page"
            :disabled="locked || busy"
            :total="rows.length"
            :page-size="20"
            layout="total, prev, pager, next"
          /><span>20 条 / 页</span>
        </div>
        <div v-if="!editing" class="target-default-note">
          <el-icon><InfoFilled /></el-icon
          ><span
            >默认月指标：<template v-for="(m, i) in targetMetrics" :key="m.code"
              >{{ i ? ' · ' : '' }}{{ m.label }}
              {{ format(defaultTarget(data, dimension, m.code)) }} {{ m.unit }}</template
            ></span
          >
        </div>
        <form
          v-if="editing"
          ref="editorElement"
          class="target-editor"
          @submit.prevent="previewEdit"
        >
          <div class="target-editor-title">
            <el-icon><Edit /></el-icon>
            <h2>
              {{
                editorSubjects.length === 1
                  ? `编辑指标 · ${editorSubjects[0]!.name}`
                  : `批量调整 · 已选${editorSubjects.length}${dimension === 'CITY' ? '个城市' : '名销售'}`
              }}
            </h2>
            <span>仅修改勾选的指标</span>
          </div>
          <div class="target-fields">
            <div v-for="m in targetMetrics" :key="m.code" class="target-field">
              <label
                ><input v-model="draft[m.code].checked" type="checkbox" :disabled="saving" />{{
                  m.label
                }}（{{ m.unit }}）</label
              ><el-select
                v-if="draft[m.code].checked"
                v-model="draft[m.code].mode"
                :aria-label="`${m.label}设置方式`"
                :disabled="!draft[m.code].checked || saving"
                ><el-option label="单独设置" value="set" /><el-option
                  label="沿用默认"
                  value="default" /></el-select
              ><el-input
                v-if="draft[m.code].checked && draft[m.code].mode === 'set'"
                v-model="draft[m.code].value"
                inputmode="decimal"
                :aria-label="`${m.label}新目标`"
                :disabled="!draft[m.code].checked || saving"
                ><template #suffix>{{ m.unit }}</template></el-input
              >
              <p v-else-if="draft[m.code].checked">
                当月默认 {{ format(defaultTarget(data, dimension, m.code)) }} {{ m.unit }}
              </p>
            </div>
          </div>
          <div class="target-reason">
            <label for="target-reason">修改原因</label
            ><el-input
              id="target-reason"
              v-model="reason"
              maxlength="1000"
              :disabled="saving"
              placeholder="调整当月或历史指标时必填"
              show-word-limit
            />
          </div>
          <div class="target-editor-footer">
            <small>未勾选项保持不变；目标为 0 表示该项不考核。</small
            ><el-button :disabled="saving" @click="cancelEdit">取消</el-button
            ><el-button type="primary" native-type="submit" :disabled="saving">预览变更</el-button>
          </div>
        </form>
      </main>
    </div>

    <el-dialog
      v-model="preview"
      title="确认指标变更"
      width="760px"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      class="target-dialog"
    >
      <p>
        生效月份：<strong>{{ pendingDefault?.effectiveMonth || month }}</strong> · 共
        {{ previewRows.length }} 项变更
      </p>
      <p class="target-dialog-note">
        {{
          pendingDefault
            ? '仅影响生效月及之后沿用默认的指标；已有单独设置保持不变。'
            : '仅调整目标值，实际业绩金额和其他月份保持不变。'
        }}
      </p>
      <div class="target-preview-scroll">
        <table class="target-table">
          <thead>
            <tr>
              <th>对象</th>
              <th>指标</th>
              <th class="numeric">调整前</th>
              <th class="numeric">调整后</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in previewRows" :key="i">
              <td>{{ r.name }}</td>
              <td>{{ metricName(r.metric) }}</td>
              <td class="numeric">{{ r.before === 0 ? '不考核' : format(r.before) }}</td>
              <td class="numeric">
                <strong>{{ r.after === 0 ? '不考核' : format(r.after) }}</strong>
              </td>
              <td>{{ r.source }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>修改原因：{{ pendingDefault?.reason || reason || '—' }}</p>
      <template #footer
        ><el-button :disabled="saving" @click="preview = false">返回修改</el-button
        ><el-button type="primary" :loading="saving" @click="confirmSave"
          >确认保存</el-button
        ></template
      >
    </el-dialog>
    <el-dialog
      v-model="defaultsOpen"
      title="默认指标标准"
      width="680px"
      :close-on-click-modal="false"
      :show-close="!saving"
      :close-on-press-escape="!saving"
      class="target-dialog"
    >
      <p class="target-dialog-note">
        分别维护城市与销售的默认值，从下月或之后生效。当月目标请在列表单独调整。
      </p>
      <div class="target-default-controls">
        <el-select v-model="defaultType" aria-label="默认指标维度" :disabled="saving"
          ><el-option label="城市默认指标" value="CITY" /><el-option
            label="销售默认指标"
            value="SALES_OWNER" /></el-select
        ><el-date-picker
          v-model="defaultMonth"
          type="month"
          value-format="YYYY-MM"
          format="YYYY年MM月"
          :clearable="false"
          :disabled="saving"
          aria-label="默认指标生效月份"
        />
      </div>
      <div class="target-default-fields">
        <label v-for="m in targetMetrics" :key="m.code"
          >{{ m.label }}（{{ m.unit }}）<el-input
            v-model="defaultDraft[m.code]"
            :aria-label="`${m.label}默认值`"
            :disabled="!data?.defaultsWritable || saving"
            inputmode="decimal"
        /></label>
      </div>
      <el-input
        v-model="defaultReason"
        placeholder="修改原因（必填）"
        aria-label="默认指标修改原因"
        maxlength="1000"
        :disabled="!data?.defaultsWritable || saving"
      />
      <p v-if="!data?.defaultsWritable" class="target-readonly">
        默认标准需全局指标管理权限，当前仅可查看。
      </p>
      <template #footer
        ><el-button
          v-if="data?.defaultsWritable"
          link
          type="primary"
          :disabled="saving"
          @click="openHistory()"
          >修改记录</el-button
        ><el-button :disabled="saving" @click="defaultsOpen = false">关闭</el-button
        ><el-button
          v-if="data?.defaultsWritable"
          type="primary"
          :disabled="saving"
          @click="previewDefaults"
          >预览变更</el-button
        ></template
      >
    </el-dialog>
    <el-drawer v-model="historyOpen" :title="`修改记录 · ${historyTitle}`" size="min(620px, 95vw)"
      ><p v-if="historyBusy">正在加载…</p>
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" /><el-empty
        v-if="!historyBusy && !historyError && !history.length"
        description="暂无修改记录"
      />
      <ol class="target-history">
        <li v-for="(event, i) in history" :key="i">
          <strong
            >{{ metricName(event.metric) }} ·
            {{
              event.deleted
                ? '恢复默认'
                : Number(event.value) === 0
                  ? '不考核'
                  : format(event.value)
            }}</strong
          >
          <p>{{ event.reason || '未填写原因' }}</p>
          <small
            >{{ event.actor }} · {{ dateText(event.occurredAt) }} · 版本 {{ event.revision }}</small
          >
        </li>
      </ol></el-drawer
    >
  </section>
</template>

<style scoped src="./target-settings.scss" lang="scss"></style>
