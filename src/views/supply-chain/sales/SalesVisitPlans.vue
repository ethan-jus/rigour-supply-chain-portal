<template>
  <div class="visit-plans">
    <div class="plan-toolbar">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        :clearable="false"
        @change="reload"
      />
      <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 150px" @change="reload">
        <el-option label="待执行" value="PLANNED" />
        <el-option label="进行中" value="IN_PROGRESS" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>
      <el-button :loading="loading" @click="load">刷新</el-button>
      <el-button type="primary" @click="openCreate">新增计划</el-button>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-loading="loading" :data="plans?.items || []" stripe empty-text="当前日期范围没有拜访计划">
        <el-table-column prop="plannedDate" label="计划日期" width="120" sortable />
        <el-table-column label="销售" width="130">
          <template #default="scope"><strong>{{ scope.row.salesNo }}</strong></template>
        </el-table-column>
        <el-table-column label="客户门店" min-width="220">
          <template #default="scope">
            <div class="store-cell">
              <strong>{{ scope.row.storeName }}</strong>
              <span>{{ scope.row.customerName || '未关联客户' }} · {{ scope.row.storeAddress || '暂无地址' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="objective" label="拜访目标" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)" effect="plain">{{ statusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="执行" width="120">
          <template #default="scope">
            <span v-if="scope.row.visitId">已关联拜访</span>
            <span v-else>尚未开始</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <template v-if="scope.row.status === 'PLANNED'">
              <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
              <el-button link type="danger" @click="cancelPlan(scope.row)">取消</el-button>
            </template>
            <span v-else>不可修改</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <span>共 {{ plans?.total || 0 }} 项</span>
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="plans?.total || 0"
          @current-change="changePage"
        />
      </div>
    </el-card>

    <el-alert
      title="计划与执行边界"
      description="主管计划只定义销售、日期、CRM负责门店和拜访目标；销售仍需在飞书手机端到店定位后开始。临时拜访不要求先建计划。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-dialog v-model="dialogVisible" :title="editingPlanId ? '编辑拜访计划' : '新增拜访计划'" width="560px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="销售" required>
          <el-select v-model="form.salesProfileId" filterable placeholder="选择销售" style="width: 100%" @change="onProfileChange">
            <el-option v-for="profile in profiles" :key="profile.salesProfileId" :label="profile.salesNo" :value="profile.salesProfileId" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker v-model="form.plannedDate" type="date" value-format="YYYY-MM-DD" :disabled-date="disablePastDate" style="width: 100%" />
        </el-form-item>
        <el-form-item label="CRM负责门店" required>
          <el-select
            v-model="form.storeId"
            filterable
            remote
            reserve-keyword
            placeholder="先选择销售，再搜索本人负责门店"
            :disabled="!form.salesProfileId"
            :remote-method="searchTargets"
            :loading="targetsLoading"
            style="width: 100%"
          >
            <el-option v-for="target in targets" :key="target.storeId" :label="targetLabel(target)" :value="target.storeId" />
          </el-select>
        </el-form-item>
        <el-form-item label="拜访目标" required>
          <el-input v-model="form.objective" type="textarea" :rows="3" maxlength="512" show-word-limit placeholder="例如：核对陈列，确认下月补货数量和决策人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存计划</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'

interface VisitPlanProfileOption {
  salesProfileId: string
  employeeId: string
  salesNo: string
  cityOrgId: string | null
}

interface VisitTarget {
  storeId: string
  customerName: string | null
  storeName: string
  storeAddress: string | null
}

interface ManagementVisitPlan {
  planId: string
  salesProfileId: string
  salesNo: string
  plannedDate: string
  customerId: string | null
  storeId: string
  customerName: string | null
  storeName: string
  storeAddress: string | null
  objective: string
  status: string
  visitId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

interface ManagementVisitPlanPage {
  from: string
  to: string
  status: string | null
  items: ManagementVisitPlan[]
  page: number
  pageSize: number
  total: number
}

const today = localDate(new Date())
const monthEnd = localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
const dateRange = ref<[string, string]>([today, monthEnd])
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20
const plans = ref<ManagementVisitPlanPage | null>(null)
const profiles = ref<VisitPlanProfileOption[]>([])
const targets = ref<VisitTarget[]>([])
const loading = ref(false)
const targetsLoading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const editingPlanId = ref('')
const form = reactive({ salesProfileId: '', plannedDate: today, storeId: '', objective: '', version: null as number | null })
let targetRequestSequence = 0

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    plans.value = await apiClient.get('/sales/management/visit-plans', {
      params: { from: dateRange.value[0], to: dateRange.value[1], status: statusFilter.value || undefined, page: page.value, pageSize },
    }) as ManagementVisitPlanPage
  } catch (error) {
    errorMessage.value = messageOf(error, '拜访计划读取失败')
  } finally {
    loading.value = false
  }
}

async function loadProfiles() {
  try {
    profiles.value = await apiClient.get('/sales/management/visit-plans/profiles') as VisitPlanProfileOption[]
  } catch (error) {
    errorMessage.value = messageOf(error, '销售列表读取失败')
  }
}

async function searchTargets(query = '') {
  if (!form.salesProfileId) return
  const profileId = form.salesProfileId
  const requestSequence = ++targetRequestSequence
  targetsLoading.value = true
  try {
    const result = await apiClient.get(`/sales/management/visit-plans/profiles/${profileId}/targets`, {
      params: { q: query, page: 1, pageSize: 20 },
    }) as { items: VisitTarget[] }
    if (requestSequence !== targetRequestSequence || profileId !== form.salesProfileId) return
    const selected = targets.value.find((target) => target.storeId === form.storeId)
    targets.value = selected && !result.items.some((target) => target.storeId === selected.storeId)
      ? [selected, ...result.items]
      : result.items
  } catch (error) {
    if (requestSequence === targetRequestSequence) {
      ElMessage.error(messageOf(error, '负责门店读取失败'))
    }
  } finally {
    if (requestSequence === targetRequestSequence) targetsLoading.value = false
  }
}

function reload() { page.value = 1; void load() }
function changePage(value: number) { page.value = value; void load() }
function onProfileChange() {
  targetRequestSequence += 1
  targetsLoading.value = false
  form.storeId = ''
  targets.value = []
  void searchTargets()
}

function openCreate() {
  editingPlanId.value = ''
  Object.assign(form, { salesProfileId: '', plannedDate: today, storeId: '', objective: '', version: null })
  targets.value = []
  dialogVisible.value = true
}

function openEdit(plan: ManagementVisitPlan) {
  editingPlanId.value = plan.planId
  Object.assign(form, {
    salesProfileId: plan.salesProfileId,
    plannedDate: plan.plannedDate,
    storeId: plan.storeId,
    objective: plan.objective,
    version: plan.version,
  })
  targets.value = [{ storeId: plan.storeId, customerName: plan.customerName, storeName: plan.storeName, storeAddress: plan.storeAddress }]
  dialogVisible.value = true
  void searchTargets(plan.storeName)
}

async function save() {
  if (!form.salesProfileId || !form.plannedDate || !form.storeId || !form.objective.trim()) {
    ElMessage.warning('请完整填写销售、日期、门店和拜访目标')
    return
  }
  saving.value = true
  try {
    const payload = { ...form, objective: form.objective.trim() }
    if (editingPlanId.value) await apiClient.put(`/sales/management/visit-plans/${editingPlanId.value}`, payload)
    else await apiClient.post('/sales/management/visit-plans', payload)
    ElMessage.success(editingPlanId.value ? '计划已更新' : '计划已创建')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(messageOf(error, '计划保存失败'))
  } finally {
    saving.value = false
  }
}

async function cancelPlan(plan: ManagementVisitPlan) {
  try {
    await ElMessageBox.confirm(`确认取消 ${plan.salesNo} 在 ${plan.plannedDate} 的“${plan.storeName}”拜访计划？`, '取消计划', { type: 'warning' })
    await apiClient.put(`/sales/management/visit-plans/${plan.planId}/cancel`, { version: plan.version })
    ElMessage.success('计划已取消')
    await load()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(messageOf(error, '取消计划失败'))
  }
}

function statusLabel(status: string) {
  return { PLANNED: '待执行', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }[status] || `未知状态（${status}）`
}

function statusType(status: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'IN_PROGRESS') return 'primary'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'info'
  return 'warning'
}

function targetLabel(target: VisitTarget) {
  return `${target.storeName}${target.storeAddress ? ` · ${target.storeAddress}` : ''}`
}

function disablePastDate(date: Date) { return localDate(date) < today }

function messageOf(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return fallback
}

onMounted(() => { void Promise.all([load(), loadProfiles()]) })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.visit-plans { display: grid; gap: $spacing-lg; }
.plan-toolbar { display: flex; flex-wrap: wrap; gap: $spacing-sm; align-items: center; padding: $spacing-md; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.store-cell { display: flex; flex-direction: column; gap: 4px; }
.store-cell span { color: $color-text-secondary; font-size: $font-size-xs; }
.pagination { display: flex; align-items: center; justify-content: space-between; margin-top: $spacing-md; color: $color-text-secondary; font-size: $font-size-sm; }
</style>
