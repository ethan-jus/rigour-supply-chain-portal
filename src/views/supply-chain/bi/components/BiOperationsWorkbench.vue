<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Refresh, Plus } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { biErrorMessage } from '../bi-error'
import { getSupplyDashboardFilterOptions } from '@/api/core/bi'
import {
  createBiAction,
  getBiActionEvents,
  getBiActions,
  updateBiAction,
  type BiAction,
  type BiActionEvent,
  type BiActionSeed,
  type BiActionStatus,
} from '@/api/core/bi-operations'

interface Option {
  value: string
  label: string
}
const props = withDefaults(
  defineProps<{
    regionCode?: string
    ownerStaffCode?: string
    actionSeed?: BiActionSeed | null
    regions?: Option[]
    salesOwners?: Option[]
  }>(),
  { regionCode: '', ownerStaffCode: '', actionSeed: null },
)
const emit = defineEmits<{
  changed: [event: { type: 'actions' }]
  'open-business': [action: BiAction]
}>()
const auth = useAuthStore()
const canRead = computed(() => auth.hasPermission('analytics:dashboard:read'))
const canActionWrite = computed(() => auth.hasPermission('analytics:operations:write'))
const busy = ref(false)
const saving = ref(false)
const error = ref('')
const detailError = ref('')
const regionsLoaded = ref<Option[]>([])
const ownersLoaded = ref<Option[]>([])
const owners = computed(() => props.salesOwners ?? ownersLoaded.value)
const statusLabels: Record<BiActionStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  DISMISSED: '已驳回',
}
const kindLabels = { COLLECTION: '回款跟进', CUSTOMER: '客户跟进', STOCK: '库存跟进' }
const transitions: Record<BiActionStatus, BiActionStatus[]> = {
  OPEN: ['OPEN', 'IN_PROGRESS', 'DISMISSED'],
  IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'DISMISSED'],
  RESOLVED: ['OPEN'],
  DISMISSED: ['OPEN'],
}
const actions = ref<BiAction[]>([])
const total = ref(0)
const page = ref(1)
const statusFilter = ref<BiActionStatus | ''>('')
const actionRecord = ref<BiAction | null>(null)
const actionEditing = ref(false)
const seed = ref<BiActionSeed | null>(null)
const assignee = ref('')
const dueAt = ref<Date | null>(null)
const actionStatus = ref<BiActionStatus>('OPEN')
const note = ref('')
const events = ref<BiActionEvent[]>([])
const eventBusy = ref(false)
let sequence = 0
let eventSequence = 0
const statusOptions = computed(() =>
  actionRecord.value
    ? canActionWrite.value
      ? transitions[actionRecord.value.status]
      : [actionRecord.value.status]
    : (['OPEN'] as BiActionStatus[]),
)
const nameOf = (code: string | null | undefined) =>
  owners.value.find((row) => row.value === code)?.label ?? '负责人待核实'
const dateText = (date: string) => displayDateTime(date)
const message = (failure: unknown) => biErrorMessage(failure, '请求失败，请稍后重试')
const overdue = (action: BiAction) =>
  ['OPEN', 'IN_PROGRESS'].includes(action.status) && new Date(action.dueAt).getTime() < Date.now()

async function reload() {
  const current = ++sequence
  if (!canRead.value) {
    actions.value = []
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await getBiActions({
      cityCode: props.regionCode || undefined,
      employeeCode: props.ownerStaffCode || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: 20,
    })
    if (current === sequence) {
      actions.value = result.items
      total.value = result.total
    }
  } catch (failure) {
    if (current === sequence) {
      error.value = message(failure)
      actions.value = []
      total.value = 0
    }
  } finally {
    if (current === sequence) busy.value = false
  }
}
defineExpose({ reload })

function startSeed(incoming: BiActionSeed) {
  seed.value = incoming
  actionRecord.value = null
  events.value = []
  actionEditing.value = true
  detailError.value = ''
  assignee.value = incoming.assignee || incoming.employeeCode || props.ownerStaffCode || ''
  dueAt.value = null
  actionStatus.value = 'OPEN'
  note.value = incoming.note ?? ''
}
async function editAction(action: BiAction) {
  actionRecord.value = action
  seed.value = null
  assignee.value = action.assignee
  dueAt.value = new Date(action.dueAt)
  actionStatus.value = statusOptions.value[0]!
  note.value = ''
  detailError.value = ''
  actionEditing.value = true
  await loadEvents(action.id)
}
async function loadEvents(id: string) {
  const current = ++eventSequence
  events.value = []
  eventBusy.value = true
  try {
    const rows = await getBiActionEvents(id)
    if (current === eventSequence) events.value = rows
  } catch (failure) {
    if (current === eventSequence) detailError.value = message(failure)
  } finally {
    if (current === eventSequence) eventBusy.value = false
  }
}
async function submitAction() {
  if (!assignee.value || !dueAt.value || !note.value.trim()) {
    detailError.value = '请填写负责人、跟进期限和处理记录'
    return
  }
  saving.value = true
  detailError.value = ''
  try {
    if (actionRecord.value) {
      await updateBiAction(actionRecord.value.id, {
        assignee: assignee.value,
        dueAt: dueAt.value.toISOString(),
        status: actionStatus.value,
        note: note.value.trim(),
        expectedRevision: actionRecord.value.revision,
      })
    } else if (seed.value) {
      await createBiAction({
        ...seed.value,
        cityCode: seed.value.cityCode ?? props.regionCode,
        employeeCode: seed.value.employeeCode ?? props.ownerStaffCode,
        assignee: assignee.value,
        dueAt: dueAt.value.toISOString(),
        note: note.value.trim(),
      })
    } else {
      return
    }
    actionEditing.value = false
    page.value = 1
    emit('changed', { type: 'actions' })
    await reload()
  } catch (failure) {
    detailError.value = message(failure)
  } finally {
    saving.value = false
  }
}
watch(
  () => [props.regionCode, props.ownerStaffCode],
  () => {
    actionEditing.value = false
    page.value = 1
    void reload()
  },
)
watch(
  () => props.actionSeed,
  (incoming) => {
    if (incoming) startSeed(incoming)
  },
  { immediate: true },
)
watch(statusFilter, () => {
  page.value = 1
  void reload()
})
watch(page, () => {
  void reload()
})
onMounted(async () => {
  void reload()
  if (!canRead.value) return
  if (props.regions && props.salesOwners) return
  try {
    const response = await getSupplyDashboardFilterOptions()
    const data = response as unknown as {
      regions: { optionValue: string; optionLabel: string }[]
      salesOwners: { optionValue: string; optionLabel: string }[]
    }
    regionsLoaded.value = data.regions.map((row) => ({
      value: row.optionValue,
      label: row.optionLabel,
    }))
    ownersLoaded.value = data.salesOwners.map((row) => ({
      value: row.optionValue,
      label: row.optionLabel,
    }))
  } catch (failure) {
    error.value = message(failure)
  }
})
</script>

<template>
  <section class="bi-operations" aria-label="运营跟进">
    <el-alert
      v-if="!canRead"
      title="当前账号没有经营看板读取权限"
      type="warning"
      :closable="false"
    />
    <template v-else>
      <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
      <div class="work-area" :aria-busy="busy">
        <div class="toolbar">
          <el-select
            v-model="statusFilter"
            clearable
            placeholder="全部状态"
            aria-label="跟进状态筛选"
            :disabled="saving"
          >
            <el-option
              v-for="(label, code) in statusLabels"
              :key="code"
              :value="code"
              :label="label"
            />
          </el-select>
          <el-tooltip content="刷新"
            ><el-button
              :icon="Refresh"
              aria-label="刷新跟进"
              :loading="busy"
              :disabled="saving"
              @click="reload"
          /></el-tooltip>
          <el-button
            v-if="canActionWrite && props.actionSeed"
            :icon="Plus"
            :disabled="saving"
            @click="startSeed(props.actionSeed)"
            >登记跟进</el-button
          >
        </div>
        <p v-if="!canActionWrite" class="permission-note" role="status">
          当前账号仅可查看跟进记录；登记和处理跟进需管理员授予相应权限。
        </p>
        <form
          v-if="actionEditing"
          class="editor"
          aria-label="编辑运营跟进"
          @submit.prevent="submitAction"
        >
          <h3>{{ actionRecord?.businessLabel || seed?.businessLabel }}</h3>
          <label
            >负责人
            <el-select
              v-model="assignee"
              filterable
              aria-label="跟进负责人"
              :disabled="saving || !canActionWrite"
            >
              <el-option
                v-for="option in owners"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </label>
          <label
            >跟进期限<el-date-picker
              v-model="dueAt"
              type="datetime"
              aria-label="跟进期限"
              :disabled="saving || !canActionWrite"
          /></label>
          <label v-if="actionRecord"
            >处理状态
            <el-select
              v-model="actionStatus"
              aria-label="处理状态"
              :disabled="saving || !canActionWrite"
            >
              <el-option
                v-for="code in statusOptions"
                :key="code"
                :value="code"
                :label="statusLabels[code]"
              />
            </el-select>
          </label>
          <label v-if="canActionWrite" class="wide"
            >处理记录
            <el-input
              v-model="note"
              type="textarea"
              :rows="3"
              maxlength="2000"
              aria-label="处理记录"
              :disabled="saving"
            />
          </label>
          <el-alert
            v-if="detailError"
            class="wide"
            :title="detailError"
            type="error"
            :closable="false"
            role="alert"
          />
          <div class="editor-actions wide">
            <el-button
              v-if="canActionWrite"
              native-type="submit"
              type="primary"
              :icon="Check"
              :loading="saving"
              >{{ actionRecord ? '保存处理记录' : '登记跟进' }}</el-button
            >
            <el-button :disabled="saving" @click="actionEditing = false">关闭</el-button>
            <el-button
              v-if="actionRecord"
              link
              type="primary"
              @click="emit('open-business', actionRecord)"
              >查看业务明细</el-button
            >
          </div>
          <section
            v-if="actionRecord"
            class="history wide"
            aria-label="处理历史"
            :aria-busy="eventBusy"
          >
            <h3>处理历史</h3>
            <ol>
              <li v-for="event in events" :key="event.id">
                <header>
                  {{ statusLabels[event.status] }} · {{ nameOf(event.assignee)
                  }}<time>{{ dateText(event.occurredAt) }}</time>
                </header>
                <small v-if="event.previousAssignee && event.previousAssignee !== event.assignee"
                  >原负责人 {{ nameOf(event.previousAssignee) }}</small
                >
                <p>{{ event.note }}</p>
                <small
                  >跟进期限 {{ dateText(event.dueAt)
                  }}<span v-if="event.previousDueAt && event.previousDueAt !== event.dueAt"
                    >（原 {{ dateText(event.previousDueAt) }}）</span
                  ></small
                >
              </li>
            </ol>
          </section>
        </form>
        <el-table :data="actions" empty-text="当前范围暂无跟进事项" aria-label="运营跟进列表">
          <!-- @vue-generic {BiAction} -->
          <el-table-column label="跟进对象" min-width="180"
            ><template #default="{ row }">
              <el-button link type="primary" :disabled="saving" @click="editAction(row)">{{
                row.businessLabel
              }}</el-button>
              <small class="subject-kind">{{
                kindLabels[row.kind as keyof typeof kindLabels]
              }}</small>
            </template></el-table-column
          >
          <el-table-column label="负责人" min-width="110"
            ><template #default="{ row }">{{ nameOf(row.assignee) }}</template></el-table-column
          >
          <!-- @vue-generic {BiAction} -->
          <el-table-column label="状态" min-width="100"
            ><template #default="{ row }"
              >{{ statusLabels[row.status as BiActionStatus]
              }}<strong v-if="overdue(row)" class="overdue">逾期</strong></template
            ></el-table-column
          >
          <el-table-column label="跟进期限" min-width="160"
            ><template #default="{ row }">{{ dateText(row.dueAt) }}</template></el-table-column
          >
          <el-table-column prop="note" label="最近处理记录" min-width="160" show-overflow-tooltip />
        </el-table>
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          :disabled="busy || saving"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.bi-operations {
  min-width: 0;
  color: #25364a;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0 16px;
}
.toolbar :deep(.el-select),
.toolbar :deep(.el-date-editor) {
  width: 168px;
}
.work-area {
  min-width: 0;
}
.permission-note {
  margin: 0 0 12px;
  color: #5b6878;
  font-size: 13px;
}
.editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  padding: 16px 0;
  margin-bottom: 20px;
  border-block: 1px solid #dfe5eb;
}
.editor h3 {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.editor label {
  display: grid;
  gap: 6px;
  font-size: 14px;
  min-width: 0;
}
.editor :deep(.el-select),
.editor :deep(.el-date-editor) {
  width: 100%;
}
.wide {
  grid-column: 1 / -1;
}
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.history {
  border-top: 1px solid #dfe5eb;
  padding-top: 14px;
}
.history ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history li {
  padding: 12px 0;
  border-bottom: 1px solid #e7ebef;
}
.history header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
}
.history p {
  margin: 8px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.history time,
.history small,
.subject-kind {
  color: #5b6878;
  font-size: 12px;
}
.subject-kind {
  display: block;
}
.overdue {
  color: #b45309;
  font-size: 12px;
  margin-left: 6px;
}
.bi-operations :deep(.el-pagination) {
  margin-top: 14px;
  flex-wrap: wrap;
}
.bi-operations :deep(.el-alert) {
  margin-bottom: 12px;
}
.bi-operations :deep(.el-table .el-button) {
  white-space: normal;
  height: auto;
  text-align: left;
}
@media (max-width: 600px) {
  .editor {
    grid-template-columns: minmax(0, 1fr);
  }
  .toolbar :deep(.el-select),
  .toolbar :deep(.el-date-editor) {
    width: 100%;
  }
}
</style>
