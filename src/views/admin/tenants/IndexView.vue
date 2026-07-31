<template>
  <el-card>
    <template #header>
      <div class="header">
        <div>
          <strong>租户管理</strong>
          <small>维护租户状态、套餐有效期和用户容量</small>
        </div>
        <el-button type="primary" @click="openTenant()">新增租户</el-button>
      </div>
    </template>

    <el-table v-loading="loading" :data="tenants" row-key="id">
      <el-table-column prop="code" label="租户编码" min-width="140" />
      <el-table-column prop="companyName" label="企业名称" min-width="220" />
      <el-table-column label="状态" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'">
            {{ statusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="policyVersion" label="策略版本" width="100" />
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="openTenant(scope.row)">编辑</el-button>
          <el-button link type="primary" @click="openSubscription(scope.row)">开通套餐</el-button>
          <el-button link type="primary" @click="openHistory(scope.row)">套餐记录</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="tenantDialog" :title="editingTenantId ? '编辑租户' : '新增租户'" width="560px">
    <el-form label-width="100px">
      <el-form-item label="租户编码" required>
        <el-input v-model="tenantForm.code" :disabled="!!editingTenantId" maxlength="64" />
      </el-form-item>
      <el-form-item label="企业名称" required>
        <el-input v-model="tenantForm.companyName" maxlength="128" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="tenantForm.status" style="width: 100%">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="暂停" value="SUSPENDED" />
          <el-option label="过期" value="EXPIRED" />
          <el-option label="关闭" value="CLOSED" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="tenantDialog = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveTenant">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="subscriptionDialog" :title="`开通套餐 · ${subscriptionTenant?.companyName || ''}`" width="620px">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="新套餐会按生效时间进入 ACTIVE 或 SCHEDULED 状态，并自动处理重叠的旧记录。"
    />
    <el-form class="subscription-form" label-width="110px">
      <el-form-item label="套餐" required>
        <el-select v-model="selectedPackageId" filterable style="width: 100%" @change="loadVersions">
          <el-option v-for="item in activePackages" :key="item.id" :label="`${item.name} (${item.code})`" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="发布版本" required>
        <el-select v-model="subscriptionForm.packageVersionId" style="width: 100%">
          <el-option
            v-for="version in publishedVersions"
            :key="version.id"
            :label="`V${version.versionNo} · 默认 ${version.defaultUserLimit} 用户`"
            :value="version.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="开始时间" required>
        <el-date-picker v-model="subscriptionForm.effectiveFrom" type="datetime" style="width: 100%" />
      </el-form-item>
      <el-form-item label="结束时间" required>
        <el-date-picker v-model="subscriptionForm.effectiveTo" type="datetime" style="width: 100%" />
      </el-form-item>
      <el-form-item label="用户上限" required>
        <el-input-number v-model="subscriptionForm.userLimit" :min="1" :max="1000000" />
        <span class="field-hint">不得低于该租户当前已创建用户数</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="subscriptionDialog = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="subscribe">确认开通</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="historyDialog" :title="`套餐记录 · ${historyTenant?.companyName || ''}`" width="860px">
    <el-table v-loading="historyLoading" :data="subscriptions" row-key="id" empty-text="暂无套餐记录">
      <el-table-column prop="packageName" label="套餐" min-width="150" />
      <el-table-column label="版本" width="80">
        <template #default="scope">V{{ scope.row.versionNo }}</template>
      </el-table-column>
      <el-table-column label="有效期" min-width="260">
        <template #default="scope">{{ formatDate(scope.row.effectiveFrom) }} 至 {{ formatDate(scope.row.effectiveTo) }}</template>
      </el-table-column>
      <el-table-column prop="userLimit" label="用户上限" width="100" />
      <el-table-column label="状态" width="110">
        <template #default="scope">
          <el-tag :type="subscriptionStatusType(scope.row.status)">{{ subscriptionStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <template #footer><el-button @click="historyDialog = false">关闭</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import type { PackageRecord, PackageVersionRecord, SubscriptionRecord, TenantRecord } from '@/types/management'

const tenants = ref<TenantRecord[]>([])
const packages = ref<PackageRecord[]>([])
const versions = ref<PackageVersionRecord[]>([])
const subscriptions = ref<SubscriptionRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const historyLoading = ref(false)
const tenantDialog = ref(false)
const subscriptionDialog = ref(false)
const historyDialog = ref(false)
const editingTenantId = ref('')
const selectedPackageId = ref('')
const subscriptionTenant = ref<TenantRecord | null>(null)
const historyTenant = ref<TenantRecord | null>(null)
const tenantForm = reactive({ code: '', companyName: '', status: 'ACTIVE', version: 0 })
const subscriptionForm = reactive({
  packageVersionId: '',
  effectiveFrom: new Date(),
  effectiveTo: new Date(Date.now() + 365 * 86_400_000),
  userLimit: 100,
})

const activePackages = computed(() => packages.value.filter((item) => item.status === 'ACTIVE'))
const publishedVersions = computed(() => versions.value.filter((version) => version.publishStatus === 'PUBLISHED'))

async function load() {
  loading.value = true
  try {
    ;[tenants.value, packages.value] = await Promise.all([
      apiClient.get('/management/platform/tenants') as Promise<TenantRecord[]>,
      apiClient.get('/management/platform/packages') as Promise<PackageRecord[]>,
    ])
  } catch (error) {
    ElMessage.error(errorMessage(error, '租户数据加载失败'))
  } finally {
    loading.value = false
  }
}

function openTenant(row?: TenantRecord) {
  editingTenantId.value = row?.id || ''
  Object.assign(tenantForm, row || { code: '', companyName: '', status: 'ACTIVE', version: 0 })
  tenantDialog.value = true
}

async function saveTenant() {
  if (!tenantForm.code.trim() || !tenantForm.companyName.trim()) {
    ElMessage.warning('请完整填写租户编码和企业名称')
    return
  }
  saving.value = true
  try {
    if (editingTenantId.value) await apiClient.put(`/management/platform/tenants/${editingTenantId.value}`, tenantForm)
    else await apiClient.post('/management/platform/tenants', tenantForm)
    ElMessage.success('租户已保存')
    tenantDialog.value = false
    await load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '租户保存失败'))
  } finally {
    saving.value = false
  }
}

async function loadVersions() {
  versions.value = selectedPackageId.value
    ? await apiClient.get(`/management/platform/packages/${selectedPackageId.value}/versions`) as PackageVersionRecord[]
    : []
  const first = publishedVersions.value[0]
  subscriptionForm.packageVersionId = first?.id || ''
  if (first) subscriptionForm.userLimit = first.defaultUserLimit
}

async function openSubscription(row: TenantRecord) {
  subscriptionTenant.value = row
  selectedPackageId.value = activePackages.value[0]?.id || ''
  subscriptionForm.effectiveFrom = new Date()
  subscriptionForm.effectiveTo = new Date(Date.now() + 365 * 86_400_000)
  try {
    await loadVersions()
    subscriptionDialog.value = true
  } catch (error) {
    ElMessage.error(errorMessage(error, '套餐版本加载失败'))
  }
}

async function subscribe() {
  if (!subscriptionTenant.value || !subscriptionForm.packageVersionId) {
    ElMessage.warning('请选择已发布的套餐版本')
    return
  }
  if (subscriptionForm.effectiveTo <= subscriptionForm.effectiveFrom) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  saving.value = true
  try {
    await apiClient.post(`/management/platform/tenants/${subscriptionTenant.value.id}/subscriptions`, {
      ...subscriptionForm,
      effectiveFrom: subscriptionForm.effectiveFrom.toISOString(),
      effectiveTo: subscriptionForm.effectiveTo.toISOString(),
    })
    ElMessage.success('租户套餐已保存')
    subscriptionDialog.value = false
    await load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '套餐开通失败'))
  } finally {
    saving.value = false
  }
}

async function openHistory(row: TenantRecord) {
  historyTenant.value = row
  subscriptions.value = []
  historyDialog.value = true
  historyLoading.value = true
  try {
    subscriptions.value = await apiClient.get(`/management/platform/tenants/${row.id}/subscriptions`) as SubscriptionRecord[]
  } catch (error) {
    ElMessage.error(errorMessage(error, '套餐记录加载失败'))
  } finally {
    historyLoading.value = false
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}
function statusLabel(status: string) { return { ACTIVE: '启用', SUSPENDED: '暂停', EXPIRED: '过期', CLOSED: '关闭' }[status] || status }
function subscriptionStatusLabel(status: string) { return { ACTIVE: '生效中', SCHEDULED: '待生效', TERMINATED: '已终止', EXPIRED: '已过期' }[status] || status }
function subscriptionStatusType(status: string): 'success' | 'warning' | 'info' { return status === 'ACTIVE' ? 'success' : status === 'SCHEDULED' ? 'warning' : 'info' }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

onMounted(() => { void load() })
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.header > div { display: grid; gap: 4px; }
.header small { color: #8a97a8; font-weight: 400; }
.subscription-form { margin-top: 22px; }
.field-hint { margin-left: 12px; color: #909399; font-size: 12px; }
</style>
