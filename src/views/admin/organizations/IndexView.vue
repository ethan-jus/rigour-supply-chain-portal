<template>
  <section class="organization-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">系统管理 · 组织与人员</p>
        <h1>组织架构</h1>
      </div>
      <div class="page-actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button
          v-if="canWrite"
          type="primary"
          :icon="Plus"
          @click="openCreate(selectedOrganization?.id ?? null)"
        >
          新增下级
        </el-button>
      </div>
    </header>

    <div class="organization-shell">
      <section class="directory-panel" aria-label="组织下级">
        <div class="company-summary">
          <div>
            <span>当前组织</span>
            <strong>{{ selectedOrganization?.name || rootTitle }}</strong>
          </div>
          <el-tag round>{{ currentScopeUserCount }} 人</el-tag>
        </div>

        <nav v-if="breadcrumbs.length > 0" class="breadcrumb-row" aria-label="组织路径">
          <el-button
            v-if="parentOrganization"
            link
            type="primary"
            :icon="Back"
            @click="enterOrganization(parentOrganization.id)"
          >
            上级
          </el-button>
          <button
            v-for="item in breadcrumbs"
            :key="item.id"
            class="breadcrumb-link"
            type="button"
            @click="enterOrganization(item.id)"
          >
            {{ item.name }}
          </button>
        </nav>

        <div class="directory-list">
          <article
            v-for="organization in currentChildren"
            :key="organization.id"
            class="directory-item"
            :class="{ 'is-disabled': organization.status !== 'ACTIVE' }"
          >
            <button
              class="directory-main"
              type="button"
              @click="enterOrganization(organization.id)"
            >
              <span class="directory-icon">
                <el-icon><Connection /></el-icon>
              </span>
              <span class="directory-copy">
                <strong
                  >{{ organization.name }}({{
                    organizationUserCounts.get(organization.id) ?? 0
                  }})</strong
                >
                <small
                  >{{ formatPortalOrganizationType(organization.type) }} ·
                  {{ formatPortalStatus(organization.status) }}</small
                >
              </span>
            </button>
            <div class="directory-actions">
              <el-button
                link
                type="primary"
                :disabled="childCount(organization.id) === 0"
                @click="enterOrganization(organization.id)"
              >
                下级
              </el-button>
              <el-button v-if="canWrite" link type="primary" @click="openEdit(organization)">
                编辑
              </el-button>
            </div>
          </article>

          <el-empty
            v-if="!loading && currentChildren.length === 0"
            :description="selectedOrganization ? '暂无下级组织' : '暂无组织'"
          />
        </div>
      </section>

      <aside class="detail-panel" aria-label="组织详情">
        <div class="detail-heading">
          <div>
            <span>{{
              selectedOrganization
                ? formatPortalOrganizationType(selectedOrganization.type)
                : '公司'
            }}</span>
            <h2>{{ selectedOrganization?.name || rootTitle }}</h2>
          </div>
          <el-tag :type="selectedOrganization?.status === 'DISABLED' ? 'info' : 'success'">
            {{ selectedOrganization ? formatPortalStatus(selectedOrganization.status) : '启用' }}
          </el-tag>
        </div>

        <div class="metric-grid">
          <div>
            <span>下级组织</span>
            <strong>{{ currentChildren.length }}</strong>
          </div>
          <div>
            <span>本级人员</span>
            <strong>{{ directUsers.length }}</strong>
          </div>
          <div>
            <span>组织人员</span>
            <strong>{{ currentScopeUserCount }}</strong>
          </div>
        </div>

        <section class="staff-section">
          <div class="section-title">
            <strong>本级人员</strong>
            <span>{{ directUsers.length }} 人</span>
          </div>
          <div v-if="directUsers.length > 0" class="staff-list">
            <article v-for="user in directUsers" :key="user.id" class="staff-row">
              <span class="staff-avatar">{{ avatarText(user.displayName) }}</span>
              <div>
                <strong>{{ user.displayName }}</strong>
                <small>{{ user.username }} · {{ roleNames(user.roleIds) || '未分配角色' }}</small>
              </div>
              <el-tag size="small" :type="user.status === 'ACTIVE' ? 'success' : 'info'">
                {{ userStatusLabel(user.status) }}
              </el-tag>
            </article>
          </div>
          <el-empty v-else description="暂无本级人员" />
        </section>
      </aside>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑组织' : '新增组织'" width="560px">
      <el-form label-width="96px">
        <el-form-item label="上级组织">
          <el-select v-model="form.parentId" clearable filterable style="width: 100%">
            <el-option label="无上级组织" :value="null" />
            <el-option
              v-for="organization in parentOptions"
              :key="organization.id"
              :label="organization.optionLabel"
              :value="organization.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="组织编码" required>
          <el-input v-model="form.code" :disabled="!!editingId" maxlength="64" />
        </el-form-item>
        <el-form-item label="组织名称" required>
          <el-input v-model="form.name" maxlength="128" />
        </el-form-item>
        <el-form-item label="组织类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="公司" value="COMPANY" />
            <el-option label="区域" value="REGION" />
            <el-option label="城市" value="CITY" />
            <el-option label="部门" value="DEPARTMENT" />
            <el-option label="团队" value="TEAM" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Back, Connection, Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import type { OrganizationRecord, RoleRecord, UserRecord } from '@/types/management'
import { formatPortalOrganizationType, formatPortalStatus } from '@/utils/portal-labels'

interface OrganizationOption extends OrganizationRecord {
  optionLabel: string
}

const auth = useAuthStore()
const organizations = ref<OrganizationRecord[]>([])
const users = ref<UserRecord[]>([])
const roles = ref<RoleRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const selectedOrganizationId = ref<string | null>(null)
const dialogVisible = ref(false)
const editingId = ref('')
const form = reactive({
  parentId: null as string | null,
  code: '',
  name: '',
  type: 'DEPARTMENT',
  sortOrder: 0,
  status: 'ACTIVE',
  version: 0,
})

const canWrite = computed(() => auth.hasPermission('iam:organization:write'))
const organizationById = computed(() => new Map(organizations.value.map((item) => [item.id, item])))
const usersByOrganization = computed(() => {
  const result = new Map<string, UserRecord[]>()
  for (const user of users.value) {
    for (const organizationId of user.organizationIds) {
      const list = result.get(organizationId) ?? []
      list.push(user)
      result.set(organizationId, list)
    }
  }
  return result
})
const childrenByParent = computed(() => {
  const result = new Map<string | null, OrganizationRecord[]>()
  for (const organization of organizations.value) {
    const parentId = organization.parentId ?? null
    const list = result.get(parentId) ?? []
    list.push(organization)
    result.set(parentId, list)
  }
  for (const list of result.values()) {
    list.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-Hans-CN'),
    )
  }
  return result
})
const rootOrganizations = computed(() => childrenByParent.value.get(null) ?? [])
const selectedOrganization = computed(() =>
  selectedOrganizationId.value
    ? (organizationById.value.get(selectedOrganizationId.value) ?? null)
    : null,
)
const rootTitle = computed(() => rootOrganizations.value[0]?.name ?? '组织架构')
const currentChildren = computed(() => childOrganizations(selectedOrganizationId.value))
const parentOrganization = computed(() =>
  selectedOrganization.value?.parentId
    ? (organizationById.value.get(selectedOrganization.value.parentId) ?? null)
    : null,
)
const breadcrumbs = computed(() => {
  const result: OrganizationRecord[] = []
  let current = selectedOrganization.value
  while (current) {
    result.unshift(current)
    current = current.parentId ? (organizationById.value.get(current.parentId) ?? null) : null
  }
  return result
})
const directUsers = computed(() => {
  if (!selectedOrganizationId.value) return []
  return usersByOrganization.value.get(selectedOrganizationId.value) ?? []
})
const organizationUserCounts = computed(() => {
  const result = new Map<string, number>()
  const userSets = new Map<string, Set<string>>()
  for (const organization of organizations.value) userSets.set(organization.id, new Set())
  for (const user of users.value) {
    for (const organizationId of user.organizationIds) {
      let current = organizationById.value.get(organizationId)
      while (current) {
        userSets.get(current.id)?.add(user.id)
        current = current.parentId ? organizationById.value.get(current.parentId) : undefined
      }
    }
  }
  for (const [organizationId, userSet] of userSets.entries())
    result.set(organizationId, userSet.size)
  return result
})
const currentScopeUserCount = computed(() =>
  selectedOrganizationId.value
    ? (organizationUserCounts.value.get(selectedOrganizationId.value) ?? 0)
    : users.value.length,
)
const parentOptions = computed<OrganizationOption[]>(() =>
  organizations.value
    .filter((item) => item.id !== editingId.value && !isDescendantOf(item.id, editingId.value))
    .map((item) => ({
      ...item,
      optionLabel: `${'　'.repeat(depthOf(item))}${item.name}`,
    })),
)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [organizationRows, userRows, roleRows] = await Promise.all([
      apiClient.get('/management/tenant/organizations') as Promise<OrganizationRecord[]>,
      apiClient.get('/management/tenant/users') as Promise<UserRecord[]>,
      apiClient.get('/management/tenant/roles') as Promise<RoleRecord[]>,
    ])
    organizations.value = organizationRows
    users.value = userRows
    roles.value = roleRows
    if (
      !selectedOrganizationId.value ||
      !organizationById.value.has(selectedOrganizationId.value)
    ) {
      selectedOrganizationId.value = rootOrganizations.value[0]?.id ?? null
    }
  } finally {
    loading.value = false
  }
}

function childOrganizations(parentId: string | null): OrganizationRecord[] {
  return childrenByParent.value.get(parentId) ?? []
}

function childCount(organizationId: string): number {
  return childOrganizations(organizationId).length
}

function enterOrganization(organizationId: string): void {
  selectedOrganizationId.value = organizationId
}

function openCreate(parentId: string | null): void {
  editingId.value = ''
  Object.assign(form, {
    parentId,
    code: '',
    name: '',
    type: defaultChildType(parentId),
    sortOrder: childOrganizations(parentId).length + 1,
    status: 'ACTIVE',
    version: 0,
  })
  dialogVisible.value = true
}

function openEdit(row: OrganizationRecord): void {
  editingId.value = row.id
  Object.assign(form, {
    parentId: row.parentId,
    code: row.code,
    name: row.name,
    type: row.type,
    sortOrder: row.sortOrder,
    status: row.status,
    version: row.version,
  })
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!form.code.trim() || !form.name.trim()) {
    ElMessage.error('请填写组织编码和组织名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
    }
    const saved = editingId.value
      ? ((await apiClient.put(
          `/management/tenant/organizations/${editingId.value}`,
          payload,
        )) as OrganizationRecord)
      : ((await apiClient.post('/management/tenant/organizations', payload)) as OrganizationRecord)
    ElMessage.success('组织已保存')
    dialogVisible.value = false
    selectedOrganizationId.value = saved.id
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '组织保存失败')
  } finally {
    saving.value = false
  }
}

function defaultChildType(parentId: string | null): string {
  const parentType = parentId ? organizationById.value.get(parentId)?.type : null
  if (parentType === 'REGION') return 'CITY'
  if (parentType === 'DEPARTMENT' || parentType === 'CITY') return 'TEAM'
  return 'DEPARTMENT'
}

function depthOf(organization: OrganizationRecord): number {
  let depth = 0
  let current = organization.parentId ? organizationById.value.get(organization.parentId) : null
  while (current) {
    depth += 1
    current = current.parentId ? organizationById.value.get(current.parentId) : null
  }
  return depth
}

function isDescendantOf(candidateId: string, ancestorId: string): boolean {
  if (!ancestorId) return false
  let current = organizationById.value.get(candidateId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = organizationById.value.get(current.parentId)
  }
  return false
}

function avatarText(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '人'
}

function roleNames(roleIds: string[]): string {
  return roleIds
    .map((roleId) => roles.value.find((role) => role.id === roleId)?.name || roleId)
    .join('、')
}

function userStatusLabel(status: string): string {
  return { ACTIVE: '启用', LOCKED: '锁定', DISABLED: '停用' }[status] || status
}

onMounted(() => {
  void load()
})
</script>

<style scoped lang="scss">
.organization-page {
  display: grid;
  gap: 18px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-kicker {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}

.page-header h1 {
  margin: 0;
  color: #172033;
  font-size: 28px;
  line-height: 1.2;
}

.page-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.organization-shell {
  display: grid;
  grid-template-columns: minmax(420px, 1.25fr) minmax(320px, 0.75fr);
  gap: 18px;
  min-height: 680px;
}

.directory-panel,
.detail-panel {
  min-width: 0;
  border: 1px solid #dbe4f0;
  background: #fff;
}

.directory-panel {
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.company-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 28px;
  border-bottom: 1px solid #e5edf6;
}

.company-summary div {
  display: grid;
  gap: 4px;
}

.company-summary span,
.detail-heading span,
.metric-grid span,
.section-title span,
.staff-row small,
.directory-copy small {
  color: #718096;
  font-size: 13px;
}

.company-summary strong {
  color: #172033;
  font-size: 18px;
}

.breadcrumb-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 48px;
  padding: 0 24px;
  border-bottom: 1px solid #edf2f7;
}

.breadcrumb-link {
  border: 0;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font: inherit;
}

.breadcrumb-link::after {
  content: '/';
  margin-left: 8px;
  color: #cbd5e1;
}

.breadcrumb-link:last-child {
  color: #1d4ed8;
  font-weight: 700;
}

.breadcrumb-link:last-child::after {
  content: '';
  margin: 0;
}

.directory-list {
  overflow: auto;
}

.directory-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 92px;
  padding: 0 28px;
  border-bottom: 1px solid #edf2f7;
}

.directory-item.is-disabled {
  background: #f8fafc;
}

.directory-main {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.directory-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 50%;
  background: #4f63f4;
  color: #fff;
  font-size: 22px;
}

.directory-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.directory-copy strong {
  overflow: hidden;
  color: #172033;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.detail-panel {
  align-self: start;
  padding: 24px;
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-heading h2 {
  margin: 4px 0 0;
  color: #172033;
  font-size: 22px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}

.metric-grid div {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e5edf6;
  background: #f8fafc;
}

.metric-grid strong {
  color: #172033;
  font-size: 24px;
}

.staff-section {
  display: grid;
  gap: 14px;
  margin-top: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title strong {
  color: #172033;
}

.staff-list {
  display: grid;
  gap: 10px;
}

.staff-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5edf6;
  background: #fff;
}

.staff-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 700;
}

.staff-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.staff-row strong,
.staff-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .page-header,
  .directory-item {
    align-items: stretch;
    flex-direction: column;
  }

  .page-actions,
  .directory-actions {
    justify-content: flex-start;
  }

  .organization-shell {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
