<template>
  <el-drawer :model-value="modelValue" title="看板数据权限" size="min(580px, 100vw)" @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="!canManage" title="仅数据范围管理员可维护" type="warning" :closable="false" />
    <template v-else>
      <el-alert v-if="error" :title="error" type="error" :closable="false" class="scope-message" />
      <el-form v-loading="loading" label-position="top" :disabled="loading || saving">
        <el-form-item label="员工账号">
          <el-select v-model="userId" filterable clearable placeholder="选择员工账号" aria-label="员工账号" @change="resetSelection">
            <el-option v-for="user in users" :key="user.id" :value="user.id" :label="`${user.displayName} (${user.username})`" />
          </el-select>
        </el-form-item>
        <el-form-item label="已有授权策略">
          <el-select v-model="policyIds" multiple filterable :disabled="!userId" placeholder="选择已配置的 IAM 策略" aria-label="已有授权策略">
            <el-option v-for="policy in allowedPolicies" :key="policy.id" :value="policy.id" :label="policyLabel(policy)" />
          </el-select>
          <p v-if="userId && !allowedPolicies.length && !loading" class="scope-empty">该账号尚无可用的 BI 范围策略，请先在数据范围管理中配置。</p>
        </el-form-item>
        <el-form-item label="可见城市">
          <el-select v-model="regionCodes" multiple filterable :disabled="!userId" placeholder="选择 CRM 城市" aria-label="可见城市">
            <el-option v-for="city in cities" :key="city.code" :value="city.code" :label="city.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert v-if="result" title="身份与范围已核验" type="success" :closable="false">
        最近核验 {{ formatTime(result.verifiedAt) }}
      </el-alert>
      <div class="scope-actions">
        <el-button :icon="Refresh" :loading="loading" :disabled="saving" @click="load">刷新选项</el-button>
        <el-button type="danger" plain :icon="Lock" :disabled="!userId || loading || saving" @click="revoke">撤销访问</el-button>
        <el-button type="primary" :icon="Check" :loading="saving" :disabled="!ready || loading" @click="synchronize">校验并保存</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Lock, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api/core/client'
import { getCrmCustomerAreas, type CrmDictionaryView } from '@/api/core/crm'
import { synchronizeBiDataScope, revokeBiDataScope, type BiScopeSyncResult } from '@/api/core/bi-scope-settings'
import { useAuthStore } from '@/stores/auth'
import type { UserRecord, RoleRecord, DataScopeRecord } from '@/types/management'
import { biErrorMessage } from '../bi-error'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; changed: [] }>()
const auth = useAuthStore()
const canManage = computed(() => auth.hasRole('TENANT_SUPER_ADMIN') && auth.hasPermission('iam:data-scope:write'))
const users = ref<UserRecord[]>([])
const roles = ref<RoleRecord[]>([])
const policies = ref<DataScopeRecord[]>([])
const cities = ref<CrmDictionaryView[]>([])
const userId = ref('')
const policyIds = ref<string[]>([])
const regionCodes = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const result = ref<BiScopeSyncResult | null>(null)
const allowedPolicies = computed(() => {
  const user = users.value.find(item => item.id === userId.value)
  return policies.value.filter(policy => user?.roleIds.includes(policy.roleId))
})
const ready = computed(() => canManage.value && userId.value && policyIds.value.length > 0 && regionCodes.value.length > 0)
const scopeNames: Record<string, string> = { SELF: '本人业务', MY_CITY: '城市业务', MY_REGION: '区域业务' }
function policyLabel(policy: DataScopeRecord) {
  return `${roles.value.find(role => role.id === policy.roleId)?.name ?? '角色'} · ${scopeNames[policy.scopeType] ?? policy.scopeType}`
}
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
function resetSelection() { policyIds.value = []; regionCodes.value = []; result.value = null; error.value = '' }

async function load() {
  if (!canManage.value || loading.value) return
  loading.value = true
  error.value = ''
  users.value = []; roles.value = []; policies.value = []; cities.value = []
  try {
    const options = { stayOnUnauthorized: true }
    const [userRows, roleRows, policyRows, resources] = await Promise.all([
      apiClient.get<UserRecord[], UserRecord[]>('/management/tenant/users', options),
      apiClient.get<RoleRecord[], RoleRecord[]>('/management/tenant/roles', options),
      apiClient.get<DataScopeRecord[], DataScopeRecord[]>('/management/tenant/data-scopes', options),
      apiClient.get<{ applicationId: string; permissionCode: string }[], { applicationId: string; permissionCode: string }[]>('/management/tenant/grantable-resources', options),
    ])
    const applicationIds = new Set(resources.filter(row => row.permissionCode === 'analytics:dashboard:read').map(row => row.applicationId))
    const areaRows: CrmDictionaryView[] = []
    for (let begin = 0; ; ) {
      const page = await getCrmCustomerAreas({ begin, step: 200 })
      areaRows.push(...page.items)
      begin += page.items.length
      if (begin >= page.total) break
      if (!page.items.length || begin >= 10000) throw new Error('城市选项未完整加载，请缩小数据范围后重试')
    }
    users.value = userRows.filter(user => user.status === 'ACTIVE')
    roles.value = roleRows.filter(role => role.status === 'ACTIVE')
    policies.value = policyRows.filter(policy => policy.status === 'ACTIVE' && applicationIds.has(policy.applicationId)
      && ['SELF', 'MY_CITY', 'MY_REGION'].includes(policy.scopeType) && roles.value.some(role => role.id === policy.roleId))
    cities.value = areaRows.filter(city => city.status === 'ACTIVE')
    if (!users.value.some(user => user.id === userId.value)) userId.value = ''
    policyIds.value = policyIds.value.filter(id => allowedPolicies.value.some(policy => policy.id === id))
    regionCodes.value = regionCodes.value.filter(code => cities.value.some(city => city.code === code))
  } catch (cause) {
    error.value = biErrorMessage(cause, '权限配置选项加载失败')
  } finally { loading.value = false }
}

async function synchronize() {
  if (!ready.value || saving.value) return
  saving.value = true
  error.value = ''; result.value = null
  try {
    result.value = await synchronizeBiDataScope({ userId: userId.value, iamPolicyIds: [...policyIds.value], regionCodes: [...regionCodes.value] })
    ElMessage.success('数据范围已保存')
    emit('changed')
  } catch (cause) { error.value = biErrorMessage(cause, '身份或范围校验失败，旧范围已撤销') }
  finally { saving.value = false }
}

async function revoke() {
  if (!userId.value || saving.value) return
  try { await ElMessageBox.confirm('撤销后，该账号将不能读取看板业务数据。', '撤销看板访问', { type: 'warning' }) }
  catch { return }
  saving.value = true; error.value = ''
  try {
    await revokeBiDataScope(userId.value)
    result.value = null
    ElMessage.success('看板数据访问已撤销')
    emit('changed')
  } catch (cause) { error.value = biErrorMessage(cause, '撤销失败，请重试') }
  finally { saving.value = false }
}

watch(() => props.modelValue, open => { if (open) void load() }, { immediate: true })
</script>

<style scoped>
.el-select { width: 100%; }
.scope-message { margin-bottom: 16px; }
.scope-empty { margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.scope-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.scope-actions .el-button { margin-left: 0; }
</style>
