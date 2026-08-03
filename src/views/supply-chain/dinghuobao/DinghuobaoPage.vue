<template>
  <div class="dinghuobao-page">
    <template v-if="pageKey === 'overview'">
      <el-row :gutter="16">
        <el-col v-for="card in overviewCards" :key="card.label" :xs="12" :md="6">
          <el-card class="summary-card"><div class="summary-value">{{ card.value }}</div><div class="summary-label">{{ card.label }}</div></el-card>
        </el-col>
      </el-row>
      <el-card class="section-card">
        <template #header><strong>使用说明</strong></template>
        <el-steps :active="4" align-center>
          <el-step title="连接配置" description="登记订货宝连接与Secret引用" />
          <el-step title="同步任务" description="定义订单拉取任务和对象类型" />
          <el-step title="订单镜像" description="检查已同步订单与原始回执" />
          <el-step title="BI数据准备" description="输出给BI看板的数据视图" />
        </el-steps>
        <div class="empty-hint">左侧菜单进入各模块；真实订货宝凭据与外部联调由后续开发负责，页面不使用运行时Mock。</div>
      </el-card>
    </template>

    <template v-else-if="pageKey === 'connections'">
      <el-card>
        <template #header><div class="header"><strong>连接配置</strong><el-button type="primary" @click="openConnector()">新增连接</el-button></div></template>
        <el-table v-loading="loading" :data="connectors" row-key="id">
          <el-table-column prop="code" label="连接编码" min-width="150" />
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="baseUrl" label="Base URL" min-width="240" />
          <el-table-column prop="authSecretRef" label="Secret引用" min-width="220" />
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" @click="openConnector(scope.row)">编辑</el-button></template></el-table-column>
        </el-table>
      </el-card>
      <el-dialog v-model="connectorDialog" :title="editingConnectorId ? '编辑连接' : '新增连接'" width="580px">
        <el-form label-width="110px">
          <el-form-item label="连接编码" required><el-input v-model="connectorForm.code" :disabled="!!editingConnectorId" /></el-form-item>
          <el-form-item label="名称" required><el-input v-model="connectorForm.name" /></el-form-item>
          <el-form-item label="Base URL"><el-input v-model="connectorForm.baseUrl" placeholder="https://..." /></el-form-item>
          <el-form-item label="Secret引用"><el-input v-model="connectorForm.authSecretRef" placeholder="例如 secret-ref:dev/dinghuobao/main，禁止粘贴明文Secret" /></el-form-item>
          <el-form-item label="状态"><el-select v-model="connectorForm.status"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item>
        </el-form>
        <template #footer><el-button @click="connectorDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveConnector">保存</el-button></template>
      </el-dialog>
    </template>

    <template v-else-if="pageKey === 'sync-tasks'">
      <el-card>
        <template #header><div class="header"><strong>同步任务</strong><el-button type="primary" @click="openTask()">新增任务</el-button></div></template>
        <el-table v-loading="loading" :data="tasks" row-key="id">
          <el-table-column prop="code" label="任务编码" min-width="160" />
          <el-table-column label="连接"><template #default="scope">{{ connectorName(scope.row.connectorId) }}</template></el-table-column>
          <el-table-column prop="objectType" label="对象类型" width="120" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="nextRunAt" label="下次运行" min-width="180" />
          <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" @click="openTask(scope.row)">编辑</el-button></template></el-table-column>
        </el-table>
      </el-card>
      <el-dialog v-model="taskDialog" :title="editingTaskId ? '编辑任务' : '新增任务'" width="560px">
        <el-form label-width="100px">
          <el-form-item label="连接" required><el-select v-model="taskForm.connectorId" style="width:100%"><el-option v-for="item in connectors" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="任务编码" required><el-input v-model="taskForm.code" :disabled="!!editingTaskId" /></el-form-item>
          <el-form-item label="对象类型" required><el-input v-model="taskForm.objectType" placeholder="ORDER" /></el-form-item>
          <el-form-item label="状态"><el-select v-model="taskForm.status"><el-option v-for="item in taskStatuses" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        </el-form>
        <template #footer><el-button @click="taskDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveTask">保存</el-button></template>
      </el-dialog>
    </template>

    <template v-else-if="pageKey === 'order-mirror'">
      <el-card>
        <template #header><div class="header"><strong>订单镜像</strong><span class="muted">只读镜像，订单事实仍以订货宝原始回执与Order中心为准。</span></div></template>
        <el-table v-loading="loading" :data="mirrors" row-key="id">
          <el-table-column prop="sourceOrderId" label="来源订单ID" min-width="220" />
          <el-table-column prop="orderNo" label="订单号" min-width="160" />
          <el-table-column prop="sourceStatus" label="来源状态" min-width="120" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="orderTime" label="下单时间" min-width="180" />
          <el-table-column prop="mirrorStatus" label="镜像状态" width="100" />
        </el-table>
      </el-card>
    </template>

    <template v-else-if="pageKey === 'sync-logs'">
      <el-card>
        <template #header><strong>同步日志与死信</strong></template>
        <el-table v-loading="loading" :data="logs" row-key="id">
          <el-table-column prop="occurredAt" label="时间" min-width="180" />
          <el-table-column prop="taskId" label="任务ID" min-width="220" />
          <el-table-column prop="level" label="级别" width="90" />
          <el-table-column prop="message" label="消息" min-width="300" />
          <el-table-column prop="errorCode" label="错误码" min-width="140" />
        </el-table>
      </el-card>
    </template>

    <template v-else-if="pageKey === 'field-mappings'">
      <el-card>
        <template #header><div class="header"><strong>字段映射</strong><el-button type="primary" :disabled="!selectedConnectorId" @click="openMapping()">新增映射</el-button></div></template>
        <el-select v-model="selectedConnectorId" placeholder="选择连接" style="width:280px;margin-bottom:16px" @change="loadMappings"><el-option v-for="item in connectors" :key="item.id" :label="item.name" :value="item.id" /></el-select>
        <el-table v-loading="loading" :data="mappings" row-key="id">
          <el-table-column prop="sourceField" label="来源字段" min-width="180" />
          <el-table-column prop="targetField" label="目标字段" min-width="180" />
          <el-table-column prop="transformType" label="转换方式" width="120" />
          <el-table-column label="启用" width="80"><template #default="scope">{{ scope.row.enabled ? '是' : '否' }}</template></el-table-column>
          <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" @click="openMapping(scope.row)">编辑</el-button></template></el-table-column>
        </el-table>
      </el-card>
      <el-dialog v-model="mappingDialog" :title="editingMappingId ? '编辑映射' : '新增映射'" width="540px">
        <el-form label-width="100px">
          <el-form-item label="来源字段" required><el-input v-model="mappingForm.sourceField" :disabled="!!editingMappingId" /></el-form-item>
          <el-form-item label="目标字段" required><el-input v-model="mappingForm.targetField" /></el-form-item>
          <el-form-item label="转换方式"><el-select v-model="mappingForm.transformType"><el-option v-for="item in transformTypes" :key="item" :label="item" :value="item" /></el-select></el-form-item>
          <el-form-item label="启用"><el-switch v-model="mappingForm.enabled" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="mappingDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveMapping">保存</el-button></template>
      </el-dialog>
    </template>

    <template v-else>
      <el-card>
        <template #header><strong>{{ pageTitle }}</strong></template>
        <el-empty :description="`${pageTitle}页面框架已就绪，等待业务开发在此接入真实数据。`" />
        <el-alert v-if="pageKey === 'bi-prep'" type="info" :closable="false" show-icon title="BI准备输出建议：订单镜像、原始回执、同步任务与日志；分析副本由BI服务持有，Integration不跨Schema写分析表。" />
        <el-alert v-if="pageKey === 'data-quality'" type="info" :closable="false" show-icon title="质量规则建议：订单号非空、金额大于0、来源状态枚举合法、时间有效、重复来源ID幂等。" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

interface Connector { id: string; code: string; name: string; baseUrl: string | null; authSecretRef: string | null; status: string; version: number }
interface SyncTask { id: string; connectorId: string; code: string; objectType: string; status: string; nextRunAt: string | null; version: number }
interface OrderMirror { id: string; sourceOrderId: string; orderNo: string; sourceStatus: string | null; amount: number; orderTime: string | null; mirrorStatus: string; version: number }
interface SyncLog { id: string; taskId: string; level: string; message: string; errorCode: string | null; occurredAt: string }
interface FieldMapping { id: string; connectorId: string; sourceField: string; targetField: string; transformType: string; enabled: boolean; version: number }

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'overview'))
const pageTitle = computed(() => String(route.meta.title || '订货宝数据同步'))
const loading = ref(false)
const saving = ref(false)
const connectors = ref<Connector[]>([])
const tasks = ref<SyncTask[]>([])
const mirrors = ref<OrderMirror[]>([])
const logs = ref<SyncLog[]>([])
const mappings = ref<FieldMapping[]>([])
const selectedConnectorId = ref('')
const overviewCards = ref([{ label: '连接', value: '-' }, { label: '同步任务', value: '-' }, { label: '订单镜像', value: '-' }, { label: '日志', value: '-' }])
const taskStatuses = ['IDLE', 'RUNNING', 'PAUSED', 'FAILED', 'COMPLETED']
const transformTypes = ['DIRECT', 'CONSTANT', 'EXPRESSION', 'DICTIONARY']
const connectorDialog = ref(false)
const taskDialog = ref(false)
const mappingDialog = ref(false)
const editingConnectorId = ref('')
const editingTaskId = ref('')
const editingMappingId = ref('')
const connectorForm = reactive({ code: '', name: '', baseUrl: '', authSecretRef: '', status: 'ACTIVE', version: 0 })
const taskForm = reactive({ connectorId: '', code: '', objectType: 'ORDER', status: 'IDLE', nextRunAt: null as string | null, version: 0 })
const mappingForm = reactive({ connectorId: '', sourceField: '', targetField: '', transformType: 'DIRECT', enabled: true, version: 0 })

const base = '/integration/dinghuobao'

async function loadOverview() {
  const [connectorResult, taskResult, mirrorResult, logResult] = await Promise.allSettled([
    apiClient.get(`${base}/connectors`), apiClient.get(`${base}/sync-tasks`),
    apiClient.get(`${base}/order-mirrors?limit=1`), apiClient.get(`${base}/sync-logs?limit=1`),
  ])
  const values = [connectorResult, taskResult, mirrorResult, logResult].map((result) =>
    result.status === 'fulfilled' ? (result.value as unknown[]).length : '—')
  overviewCards.value = overviewCards.value.map((card, index) => ({ ...card, value: String(values[index]) }))
}

async function loadPage() {
  loading.value = true
  try {
    if (pageKey.value === 'overview') await loadOverview()
    else if (pageKey.value === 'connections' || ['sync-tasks', 'field-mappings'].includes(pageKey.value)) await loadConnectors()
    if (pageKey.value === 'sync-tasks') tasks.value = (await apiClient.get(`${base}/sync-tasks`)) as SyncTask[]
    if (pageKey.value === 'order-mirror') mirrors.value = (await apiClient.get(`${base}/order-mirrors?limit=100`)) as OrderMirror[]
    if (pageKey.value === 'sync-logs') logs.value = (await apiClient.get(`${base}/sync-logs?limit=200`)) as SyncLog[]
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '数据加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadConnectors() {
  connectors.value = (await apiClient.get(`${base}/connectors`)) as Connector[]
}

async function loadMappings() {
  if (!selectedConnectorId.value) return
  loading.value = true
  try { mappings.value = (await apiClient.get(`${base}/connectors/${selectedConnectorId.value}/field-mappings`)) as FieldMapping[] }
  finally { loading.value = false }
}

function connectorName(id: string) { return connectors.value.find((item) => item.id === id)?.name || id }

function openConnector(row?: Connector) {
  editingConnectorId.value = row?.id || ''
  Object.assign(connectorForm, row || { code: '', name: '', baseUrl: '', authSecretRef: '', status: 'ACTIVE', version: 0 })
  connectorDialog.value = true
}

async function saveConnector() {
  saving.value = true
  try {
    if (editingConnectorId.value) await apiClient.put(`${base}/connectors/${editingConnectorId.value}`, connectorForm)
    else await apiClient.post(`${base}/connectors`, connectorForm)
    ElMessage.success('连接已保存'); connectorDialog.value = false; await loadConnectors()
  } catch (reason) { ElMessage.error(errorMessage(reason, '连接保存失败')) } finally { saving.value = false }
}

function openTask(row?: SyncTask) {
  editingTaskId.value = row?.id || ''
  Object.assign(taskForm, row || { connectorId: connectors.value[0]?.id || '', code: '', objectType: 'ORDER', status: 'IDLE', nextRunAt: null, version: 0 })
  taskDialog.value = true
}

async function saveTask() {
  saving.value = true
  try {
    if (editingTaskId.value) await apiClient.put(`${base}/sync-tasks/${editingTaskId.value}`, taskForm)
    else await apiClient.post(`${base}/sync-tasks`, taskForm)
    ElMessage.success('任务已保存'); taskDialog.value = false; tasks.value = (await apiClient.get(`${base}/sync-tasks`)) as SyncTask[]
  } catch (reason) { ElMessage.error(errorMessage(reason, '任务保存失败')) } finally { saving.value = false }
}

function openMapping(row?: FieldMapping) {
  if (!selectedConnectorId.value && !row) return
  editingMappingId.value = row?.id || ''
  Object.assign(mappingForm, row || { connectorId: selectedConnectorId.value, sourceField: '', targetField: '', transformType: 'DIRECT', enabled: true, version: 0 })
  mappingDialog.value = true
}

async function saveMapping() {
  saving.value = true
  try {
    if (editingMappingId.value) await apiClient.put(`${base}/field-mappings/${editingMappingId.value}`, mappingForm)
    else await apiClient.post(`${base}/field-mappings`, mappingForm)
    ElMessage.success('映射已保存'); mappingDialog.value = false; await loadMappings()
  } catch (reason) { ElMessage.error(errorMessage(reason, '映射保存失败')) } finally { saving.value = false }
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message
  return fallback
}

onMounted(() => { void loadPage() })
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.muted { color: #8a97a8; font-size: 12px; font-weight: 400; }
.summary-card { margin-bottom: 16px; }
.summary-value { font-size: 30px; font-weight: 700; }
.summary-label { margin-top: 6px; color: #8a97a8; font-size: 13px; }
.section-card { margin-top: 4px; }
.empty-hint { margin-top: 24px; color: #8a97a8; text-align: center; font-size: 13px; }
</style>
