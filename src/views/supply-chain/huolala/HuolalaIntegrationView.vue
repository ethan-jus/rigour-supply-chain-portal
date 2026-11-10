<template>
  <div class="hll-page">
    <section class="connection-bar">
      <div>
        <strong>货拉拉接入</strong
        ><el-tag :type="connection?.authStatus === 'AUTHORIZED' ? 'success' : 'warning'">{{
          authLabel
        }}</el-tag
        ><span class="muted">{{ connection?.enterpriseName || '待开通企业接入' }}</span>
      </div>
      <div>
        <el-button :loading="loading" @click="load">刷新</el-button
        ><el-button
          v-if="can('integration:huolala:sync')"
          type="primary"
          :disabled="connection?.authStatus !== 'AUTHORIZED' || running"
          @click="syncOpen = true"
          >同步货拉拉数据</el-button
        >
      </div>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-tabs v-model="tab" class="hll-tabs">
      <el-tab-pane label="企业授权与同步设置" name="connection">
        <section class="panel settings-panel">
          <el-descriptions :column="2" border class="enterprise-details">
            <el-descriptions-item label="授权企业">{{
              connection?.enterpriseName || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="企业编号">{{
              connection?.enterpriseId || '-'
            }}</el-descriptions-item>
          </el-descriptions>
          <el-form
            ref="formRef"
            :model="settings"
            :rules="rules"
            label-position="top"
            class="settings-grid"
            @submit.prevent="save"
          >
            <el-form-item label="历史同步起始日期" prop="startDate"
              ><el-date-picker
                v-model="settings.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                :clearable="false"
            /></el-form-item>
            <el-form-item label="自动同步"
              ><el-switch v-model="settings.enabled" /><span class="muted setting-hint"
                >授权正常后按频率同步</span
              ></el-form-item
            >
            <el-form-item label="同步频率（分钟）" prop="intervalMinutes"
              ><el-input-number
                v-model="settings.intervalMinutes"
                :min="5"
                :max="1440"
                :precision="0"
            /></el-form-item>
          </el-form>
          <div class="settings-actions" v-if="can('integration:huolala:write')">
            <el-button type="primary" :loading="saving" @click="save">保存设置</el-button
            ><el-button
              :disabled="!connection?.credentialsReady || saving || authorizing"
              @click="startAuthorization"
              >{{ connection?.authStatus === 'AUTHORIZED' ? '重新授权' : '企业授权' }}</el-button
            >
          </div>
          <el-alert
            v-if="!connection || !connection.credentialsReady"
            type="warning"
            :closable="false"
            title="企业接入尚未就绪，请联系管理员配置后授权。"
          />
          <el-descriptions v-if="connection" :column="2" border class="connection-details"
            ><el-descriptions-item label="最近成功同步">{{
              dateTime(connection.lastSuccessAt)
            }}</el-descriptions-item
            ><el-descriptions-item label="连接有效期">{{
              dateTime(connection.expiresAt)
            }}</el-descriptions-item
            ><el-descriptions-item v-if="connection.lastError" label="需处理事项" :span="2">{{
              connection.lastError
            }}</el-descriptions-item></el-descriptions
          >
        </section>
      </el-tab-pane>
      <el-tab-pane label="员工关联" name="employees">
        <section class="panel">
          <el-form inline class="employee-filters" @submit.prevent
            ><el-form-item label="货拉拉员工"
              ><el-input v-model="employeeName" placeholder="输入姓名" clearable /></el-form-item
            ><el-form-item label="手机号"
              ><el-input v-model="employeePhone" placeholder="输入手机号" clearable /></el-form-item
            ><el-form-item label="关联状态"
              ><el-select v-model="employeeState" clearable placeholder="全部状态"
                ><el-option label="待关联" value="UNMATCHED" /><el-option
                  label="已关联"
                  value="LINKED" /></el-select></el-form-item
            ><el-button @click="resetEmployeeFilters">重置</el-button></el-form
          >
          <div class="table-heading">
            <strong
              >货拉拉员工 <span class="muted">{{ filteredEmployees.length }} 人</span></strong
            ><el-button
              v-if="can('integration:huolala:sync')"
              :disabled="connection?.authStatus !== 'AUTHORIZED' || running"
              @click="submitSync('EMPLOYEES')"
              >同步员工目录</el-button
            >
          </div>
          <el-table
            :data="filteredEmployees"
            v-loading="loading"
            border
            empty-text="暂无员工资料，请先同步员工目录"
            max-height="560"
            ><el-table-column prop="name" label="货拉拉姓名" min-width="120" /><el-table-column
              prop="phone"
              label="手机号"
              width="150"
            /><el-table-column
              prop="staffNo"
              label="货拉拉员工编号"
              min-width="145"
            /><el-table-column label="本系统员工" min-width="160"
              ><template #default="{ row }"
                >{{ row.employeeName || '-' }}
                <div v-if="row.employeeCode" class="muted">{{ row.employeeCode }}</div></template
              ></el-table-column
            ><el-table-column prop="departmentName" label="本系统所属部门" min-width="150"
              ><template #default="{ row }">{{
                row.departmentName || '-'
              }}</template></el-table-column
            ><el-table-column label="关联状态" width="110"
              ><template #default="{ row }"
                ><el-tag :type="row.state === 'LINKED' ? 'success' : 'warning'">{{
                  row.state === 'LINKED' ? '已关联' : '待关联'
                }}</el-tag></template
              ></el-table-column
            ><el-table-column
              v-if="can('integration:huolala:write')"
              label="操作"
              width="170"
              fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openBinding(row as HuolalaEmployee)">{{
                  row.employeeCode ? '更改关联' : '关联员工'
                }}</el-button
                ><el-button
                  v-if="row.employeeCode"
                  link
                  type="danger"
                  @click="unlink(row as HuolalaEmployee)"
                  >解除</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </section>
      </el-tab-pane>
      <el-tab-pane label="同步记录" name="runs"
        ><section class="panel">
          <div class="table-heading">
            <strong>同步记录</strong><el-button @click="loadRuns">刷新记录</el-button>
          </div>
          <el-table :data="runs" border empty-text="暂无同步记录"
            ><el-table-column label="开始时间" min-width="180"
              ><template #default="{ row }">{{
                dateTime(row.startedAt)
              }}</template></el-table-column
            ><el-table-column label="范围" width="110"
              ><template #default="{ row }">{{ scopeLabel(row.scope) }}</template></el-table-column
            ><el-table-column label="状态" width="110"
              ><template #default="{ row }"
                ><el-tag
                  :type="
                    row.status === 'SUCCEEDED'
                      ? 'success'
                      : row.status === 'RUNNING'
                        ? 'info'
                        : 'warning'
                  "
                  >{{ runLabel(row.status) }}</el-tag
                ></template
              ></el-table-column
            ><el-table-column label="列表已保存" width="110"
              ><template #default="{ row }">{{
                row.stages?.listSaved ?? '-'
              }}</template></el-table-column
            ><el-table-column label="详情已保存" width="110"
              ><template #default="{ row }">{{
                row.stages?.detailSaved ?? '-'
              }}</template></el-table-column
            ><el-table-column label="详情待补" width="100"
              ><template #default="{ row }">{{
                row.stages?.detailPending ?? '-'
              }}</template></el-table-column
            ><el-table-column label="订单失败" width="100"
              ><template #default="{ row }">{{
                row.stages?.orderFailed ?? '-'
              }}</template></el-table-column
            ><el-table-column prop="fetched" label="读取" width="80" /><el-table-column
              prop="accepted"
              label="新增／更新"
              width="110"
            /><el-table-column prop="unchanged" label="无需更新" width="100" /><el-table-column
              prop="rejected"
              label="未成功"
              width="90"
            /><el-table-column label="处理说明" min-width="260"
              ><template #default="{ row }">{{
                row.message || (row.status === 'PARTIAL' ? '部分数据需补同步或核对' : '-')
              }}</template></el-table-column
            ><el-table-column label="操作" width="100"
              ><template #default="{ row }"
                ><el-button v-if="row.rejected" link type="primary" @click="showIssues(row.id)"
                  >失败明细</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </section></el-tab-pane
      >
    </el-tabs>
    <el-dialog v-model="issuesOpen" title="同步失败明细" width="min(900px,94vw)">
      <el-alert v-if="issueError" :title="issueError" type="error" :closable="false" />
      <el-table :data="syncIssues" v-loading="issueLoading" border
        ><el-table-column prop="sourceId" label="平台编号" min-width="200" /><el-table-column
          prop="message"
          label="未成功原因"
          min-width="360"
      /></el-table>
    </el-dialog>
    <el-dialog
      v-model="bindingOpen"
      title="关联本系统员工"
      width="min(1000px,94vw)"
      :close-on-click-modal="false"
      ><el-descriptions :column="3" border
        ><el-descriptions-item label="货拉拉员工">{{ selectedEmployee?.name }}</el-descriptions-item
        ><el-descriptions-item label="手机号">{{
          selectedEmployee?.phone || '-'
        }}</el-descriptions-item
        ><el-descriptions-item label="本系统所属部门"
          ><output aria-label="本系统所属部门">{{
            selectedInternalDepartment
          }}</output></el-descriptions-item
        ></el-descriptions
      ><el-form label-position="top" class="binding-form"
        ><el-form-item label="查找本系统员工"
          ><div class="candidate-search">
            <el-input
              v-model="candidateKeyword"
              placeholder="输入姓名、手机号或员工编号"
              @keyup.enter="findCandidates"
            /><el-button :loading="candidateLoading" @click="findCandidates">查找</el-button>
          </div></el-form-item
        ><el-form-item label="本系统员工" required>
          <el-table
            :data="candidates"
            v-loading="candidateLoading"
            border
            max-height="300"
            empty-text="暂无匹配员工，请调整姓名、手机号或员工编号"
          >
            <el-table-column label="选择" width="60"
              ><template #default="{ row }"
                ><el-radio
                  v-model="selectedInternalId"
                  :value="row.id"
                  :disabled="['LEFT', 'RESIGNED', 'INACTIVE'].includes(row.employmentStatus)"
                  :aria-label="`选择员工${row.employeeName}（${row.employeeCode}）`"
                  ><span /></el-radio></template
            ></el-table-column>
            <el-table-column prop="employeeName" label="姓名" min-width="100" />
            <el-table-column prop="employeeCode" label="员工编号" min-width="130" />
            <el-table-column prop="mobile" label="手机号" min-width="135" />
            <el-table-column label="本系统所属部门" min-width="150"
              ><template #default="{ row }">{{
                row.departmentName || '-'
              }}</template></el-table-column
            >
            <el-table-column label="在职状态" min-width="100"
              ><template #default="{ row }">{{
                employeeStatusLabel(row.employmentStatus)
              }}</template></el-table-column
            >
          </el-table></el-form-item
        ><el-form-item v-if="selectedEmployee?.employeeCode" label="更改关联原因" required
          ><el-input
            v-model="bindingReason"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit /></el-form-item></el-form
      ><el-alert
        v-if="bindingError"
        :title="bindingError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="bindingOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="bind">确认关联</el-button></template
      ></el-dialog
    >
    <el-dialog
      v-model="syncOpen"
      title="同步货拉拉数据"
      width="min(650px,94vw)"
      :close-on-click-modal="false"
      ><el-form label-position="top"
        ><el-form-item label="同步内容"
          ><el-select v-model="syncScope"
            ><el-option label="订单和员工" value="ALL" /><el-option
              label="订单"
              value="ORDERS" /><el-option
              label="员工目录"
              value="EMPLOYEES" /></el-select></el-form-item
        ><el-form-item label="用车日期"
          ><el-date-picker
            v-model="syncRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="截止日期" /></el-form-item
        ><el-form-item label="货拉拉订单号"
          ><el-input
            v-model="syncOrderNo"
            placeholder="选填，可按完整单号补同步" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="syncOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="submitSync(syncScope)"
          >开始同步</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="authorizing"
      @closed="cancelAuthorization"
      title="完成企业授权"
      width="min(600px,94vw)"
      :close-on-click-modal="false"
      ><p>
        请在货拉拉页面完成企业账号授权，完成后会自动返回。若未自动完成，可填写回调页面提供的授权码。
      </p>
      <el-input
        v-model="manualCredential"
        placeholder="临时授权码"
        type="password"
        autocomplete="off"
      /><el-alert
        v-if="authorizationError"
        :title="authorizationError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="cancelAuthorization">关闭</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!manualCredential"
          @click="finishAuthorization(manualCredential)"
          >完成授权</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  huolalaApi,
  type HuolalaIssue,
  type HuolalaConnection,
  type HuolalaSettings,
  type HuolalaEmployee,
  type HuolalaCandidate,
  type HuolalaRun,
} from '@/api/core/huolala'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayDateTime } from '@/utils/business-date'
const { can } = useSupplyPermissions()
const localDay = (value = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(value)
const firstDay = localDay().slice(0, 7) + '-01'
const connection = ref<HuolalaConnection | null>(null),
  employees = ref<HuolalaEmployee[]>([]),
  runs = ref<HuolalaRun[]>([])
function resetEmployeeFilters() {
  entryStaffId.value = ''
  employeeName.value = ''
  employeePhone.value = ''
  employeeState.value = ''
}
const route = useRoute(),
  router = useRouter()
const tabFrom = (value: unknown) =>
  ['employees', 'runs'].includes(String(value)) ? String(value) : 'connection'
const entryStaffId = ref('')
const tab = ref(tabFrom(route?.query?.tab)),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  formRef = ref<FormInstance>()
function followEntry() {
  const current = router?.currentRoute.value
  // 工作区给缓存页注入私有路由快照；只在进入当前页面时读取新的入口参数。
  if (current && current.path === route?.path) {
    tab.value = tabFrom(current.query.tab)
    entryStaffId.value = typeof current.query.staffId === 'string' ? current.query.staffId : ''
  }
}
watch(() => router?.currentRoute.value.fullPath, followEntry, { immediate: true, flush: 'post' })
onActivated(followEntry)
const settings = reactive<HuolalaSettings>({
  enabled: false,
  intervalMinutes: 15,
  startDate: firstDay,
  revision: 0,
})
const rules: FormRules = {
  startDate: [{ required: true, message: '请选择同步起始日期', trigger: 'change' }],
}
const authLabel = computed(
  () =>
    ({ AUTHORIZED: '已授权', EXPIRED: '授权失效', UNAUTHORIZED: '未授权' })[
      connection.value?.authStatus || 'UNAUTHORIZED'
    ] || '未授权',
)
const running = computed(() => runs.value.some((r) => r.status === 'RUNNING'))
const employeeName = ref(''),
  employeePhone = ref(''),
  employeeState = ref('')
const filteredEmployees = computed(() =>
  employees.value.filter(
    (e) =>
      (!entryStaffId.value || e.staffId === entryStaffId.value) &&
      (!employeeName.value || e.name.includes(employeeName.value.trim())) &&
      (!employeePhone.value || e.phone.includes(employeePhone.value.trim())) &&
      (!employeeState.value || e.state === employeeState.value),
  ),
)
const bindingOpen = ref(false),
  selectedEmployee = ref<HuolalaEmployee>(),
  candidates = ref<HuolalaCandidate[]>([]),
  candidateKeyword = ref(''),
  candidateLoading = ref(false),
  selectedInternalId = ref<number>(),
  bindingReason = ref(''),
  bindingError = ref('')
const employeeStatusLabel = (status: string | null) =>
  status === 'ACTIVE'
    ? '在职'
    : ['LEFT', 'RESIGNED'].includes(status || '')
      ? '离职'
      : status === 'INACTIVE'
        ? '停用'
        : status
          ? '待核对'
          : '-'
const selectedInternalDepartment = computed(
  () => candidates.value.find((e) => e.id === selectedInternalId.value)?.departmentName || '-',
)
const syncOpen = ref(false),
  syncScope = ref('ALL'),
  syncRange = ref<[string, string]>([firstDay, localDay()]),
  syncOrderNo = ref('')
const issuesOpen = ref(false),
  issueLoading = ref(false),
  issueError = ref(''),
  syncIssues = ref<HuolalaIssue[]>([])
async function showIssues(id: string) {
  issuesOpen.value = true
  issueLoading.value = true
  issueError.value = ''
  syncIssues.value = []
  try {
    syncIssues.value = await huolalaApi.issues(id)
  } catch (e) {
    issueError.value = errorMessage(e, '失败明细加载失败')
  } finally {
    issueLoading.value = false
  }
}
const authorizing = ref(false),
  manualCredential = ref(''),
  authorizationError = ref('')
let disposed = false,
  popup: Window | null = null,
  authorizationState = '',
  candidateRequest = 0
const dateTime = (s: string | null) => (s ? displayDateTime(s) : '-')
const scopeLabel = (s: string) =>
  ({ ALL: '订单和员工', ORDERS: '订单', EMPLOYEES: '员工目录' })[s] || s
const runLabel = (s: string) =>
  ({
    RUNNING: '同步中',
    SUCCEEDED: '成功',
    PARTIAL: '部分成功',
    FAILED: '失败',
    CANCELLED: '已取消',
  })[s] || s
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [c, e, r] = await Promise.all([
      huolalaApi.connection(),
      huolalaApi.employees(),
      huolalaApi.runs(),
    ])
    if (disposed) return
    connection.value = c
    if (c) applySettings(c)
    employees.value = e
    runs.value = r
  } catch (e) {
    if (!disposed) error.value = errorMessage(e, '货拉拉接入信息加载失败')
  } finally {
    if (!disposed) loading.value = false
  }
}
function applySettings(c: HuolalaConnection) {
  settings.enabled = c.enabled
  settings.intervalMinutes = c.intervalMinutes
  settings.startDate = c.startDate
  settings.revision = c.revision
}
async function save() {
  if (saving.value) return
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  error.value = ''
  try {
    const c = await huolalaApi.save({ ...settings })
    if (!disposed) {
      connection.value = c
      applySettings(c)
      ElMessage.success('设置已保存')
    }
  } catch (e) {
    error.value = errorMessage(e, '设置保存失败')
  } finally {
    saving.value = false
  }
}
async function startAuthorization() {
  popup = window.open('about:blank', 'rigour-huolala-authorization', 'width=900,height=760')
  if (!popup) {
    error.value = '请允许本站打开授权窗口'
    return
  }
  authorizationError.value = ''
  manualCredential.value = ''
  authorizing.value = true
  try {
    const result = await huolalaApi.authorize()
    if (disposed || !authorizing.value) {
      popup.close()
      return
    }
    authorizationState = result.state
    popup.location.href = result.url
  } catch (e) {
    popup?.close()
    authorizing.value = false
    error.value = errorMessage(e, '发起授权失败')
  }
}
async function finishAuthorization(credential: string) {
  if (saving.value || !authorizationState || !credential) return
  saving.value = true
  authorizationError.value = ''
  try {
    const c = await huolalaApi.complete(credential, authorizationState)
    if (disposed) return
    connection.value = c
    applySettings(c)
    cancelAuthorization()
    ElMessage.success('企业授权已完成')
  } catch (e) {
    authorizationError.value = errorMessage(e, '授权未完成，请重新发起授权')
  } finally {
    saving.value = false
    manualCredential.value = ''
  }
}
function cancelAuthorization() {
  authorizing.value = false
  authorizationState = ''
  manualCredential.value = ''
  popup?.close()
  popup = null
}
function onMessage(event: MessageEvent) {
  if (
    event.origin === window.location.origin &&
    event.source === popup &&
    authorizing.value &&
    event.data?.type === 'rigour-huolala-authorized' &&
    typeof event.data.credential === 'string'
  )
    void finishAuthorization(event.data.credential)
}
async function openBinding(e: HuolalaEmployee) {
  selectedEmployee.value = e
  bindingReason.value = e.employeeCode ? '' : '首次关联'
  bindingError.value = ''
  candidateKeyword.value = e.phone || e.name
  selectedInternalId.value = undefined
  candidates.value = []
  bindingOpen.value = true
  await findCandidates()
}
async function findCandidates() {
  const version = ++candidateRequest
  candidateLoading.value = true
  bindingError.value = ''
  try {
    const rows = await huolalaApi.candidates(candidateKeyword.value)
    if (disposed || version !== candidateRequest) return
    candidates.value = rows
    const exact = rows.filter(
      (e) => e.mobile === selectedEmployee.value?.phone && e.employmentStatus !== 'LEFT',
    )
    if (exact.length === 1) selectedInternalId.value = exact[0]!.id
  } catch (e) {
    if (version === candidateRequest)
      bindingError.value = errorMessage(e, '员工查询失败，请检查员工档案查看权限')
  } finally {
    if (version === candidateRequest) candidateLoading.value = false
  }
}
async function bind() {
  if (!selectedEmployee.value || !selectedInternalId.value || !bindingReason.value.trim()) {
    bindingError.value = '请选择本系统员工并填写原因'
    return
  }
  saving.value = true
  try {
    employees.value = await huolalaApi.bind(
      selectedEmployee.value.staffId,
      selectedInternalId.value,
      selectedEmployee.value.revision,
      bindingReason.value.trim(),
    )
    bindingOpen.value = false
    ElMessage.success('员工关联已保存')
  } catch (e) {
    bindingError.value = errorMessage(e, '员工关联失败')
  } finally {
    saving.value = false
  }
}
async function unlink(e: HuolalaEmployee) {
  try {
    const result = await ElMessageBox.prompt(
      `解除${e.name}与${e.employeeName}的关联`,
      '解除员工关联',
      { inputPlaceholder: '填写解除原因', inputValidator: (v) => !!v?.trim() || '请填写原因' },
    )
    employees.value = await huolalaApi.bind(e.staffId, null, e.revision, result.value.trim())
    ElMessage.success('关联已解除')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error.value = errorMessage(e, '解除失败')
  }
}
async function loadRuns() {
  try {
    const r = await huolalaApi.runs()
    if (!disposed) runs.value = r
  } catch (e) {
    if (!disposed) error.value = errorMessage(e, '同步记录加载失败')
  }
}
async function submitSync(scope: string) {
  if (!syncRange.value?.[0] || !syncRange.value?.[1]) {
    error.value = '请选择同步日期'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await huolalaApi.sync(
      scope,
      syncRange.value[0],
      syncRange.value[1],
      syncOrderNo.value || undefined,
    )
    syncOpen.value = false
    tab.value = 'runs'
    await loadRuns()
    ElMessage.success('同步任务已提交')
  } catch (e) {
    error.value = errorMessage(e, '同步任务提交失败')
  } finally {
    saving.value = false
  }
}
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  window.addEventListener('message', onMessage)
  void load()
  timer = setInterval(() => {
    if (!disposed && running.value) void loadRuns()
  }, 10000)
})
onBeforeUnmount(() => {
  disposed = true
  ++candidateRequest
  if (timer) clearInterval(timer)
  window.removeEventListener('message', onMessage)
  cancelAuthorization()
})
</script>
<style scoped>
.hll-page {
  display: grid;
  gap: 16px;
  padding: 16px;
  min-width: 0;
}
.connection-bar,
.panel {
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 20px;
}
.connection-bar,
.connection-bar > div,
.settings-actions,
.table-heading,
.candidate-search {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.connection-bar,
.table-heading {
  justify-content: space-between;
}
.connection-bar strong {
  font-size: 18px;
}
.hll-tabs {
  min-width: 0;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 28px;
}
.settings-grid :deep(.el-select),
.settings-grid :deep(.el-date-editor),
.binding-form :deep(.el-select) {
  width: 100%;
}
.setting-hint {
  margin-left: 12px;
}
.enterprise-details {
  margin-bottom: 24px;
}
.settings-actions {
  padding: 8px 0 20px;
}
.connection-details,
.binding-form {
  margin-top: 20px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.table-heading {
  margin-bottom: 16px;
}
.employee-filters :deep(.el-select) {
  width: 160px;
}
.employee-filters :deep(.el-input) {
  width: 190px;
}
.candidate-search {
  width: 100%;
  flex-wrap: nowrap;
}
.candidate-search .el-input {
  flex: 1;
  min-width: 0;
}
.settings-panel {
  max-width: 1300px;
}
.connection-bar :deep(.el-tag) {
  flex-shrink: 0;
}
@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .hll-page {
    padding: 12px;
  }
  .connection-bar,
  .panel {
    padding: 16px;
  }
}
</style>
