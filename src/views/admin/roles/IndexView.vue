<template>
  <section class="management-page role-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">系统管理 · 角色权限</p>
        <h1>角色权限</h1>
      </div>
      <div class="page-actions">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="角色名称、编码"
          class="keyword-input"
        />
        <el-select v-model="filters.status" clearable placeholder="全部状态" class="status-select">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="canManage" type="primary" :icon="Plus" @click="open()">新增角色</el-button>
      </div>
    </header>

    <el-table v-loading="loading" :data="filteredRoles" row-key="id" class="management-table">
      <el-table-column type="index" label="序号" width="72" />
      <el-table-column prop="code" label="角色编码" width="160" fixed="left" />
      <el-table-column prop="name" label="角色名称" min-width="160" />
      <el-table-column prop="description" label="角色说明" min-width="240">
        <template #default="scope">{{ scope.row.description || '—' }}</template>
      </el-table-column>
      <el-table-column label="类型" width="120">
        <template #default="scope">
          <el-tag :type="scope.row.type === 'SYSTEM' ? 'warning' : 'info'">
            {{ formatPortalRoleType(scope.row.type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'">
            {{ formatPortalStatus(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="授权范围" min-width="180">
        <template #default="scope">{{ grantSummary(scope.row) }}</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="180">
        <template #default="scope">{{ formatTime(scope.row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.type === 'CUSTOM' && canManage"
            link
            type="primary"
            @click="open(scope.row)"
          >
            配置
          </el-button>
          <el-button v-else link type="primary" @click="open(scope.row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '角色权限' : '新增角色'" width="980px">
      <el-form label-width="96px" class="role-form">
        <el-form-item v-if="editingId" label="角色编码">
          <el-input v-model="form.code" disabled />
        </el-form-item>
        <el-form-item label="角色名称" required>
          <el-input v-model="form.name" maxlength="128" :disabled="readOnly" />
        </el-form-item>
        <el-form-item label="角色说明">
          <el-input
            v-model="form.description"
            type="textarea"
            maxlength="500"
            :rows="3"
            :disabled="readOnly"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%" :disabled="readOnly">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>

      <section class="permission-panel">
        <header class="permission-panel__header">
          <strong>授权范围</strong>
          <el-tag>{{ selectedResourceIds.size }} 项</el-tag>
        </header>

        <el-tabs v-model="activeApplicationId" class="permission-tabs">
          <el-tab-pane
            v-for="group in resourceGroups"
            :key="group.applicationId"
            :label="group.applicationName"
            :name="group.applicationId"
          >
            <div class="application-grant-header">
              <div>
                <strong>{{ group.applicationName }}</strong>
                <span>{{ selectedCount(group) }} / {{ group.flatResources.length }}</span>
              </div>
              <el-checkbox
                :model-value="isApplicationChecked(group)"
                :indeterminate="isApplicationIndeterminate(group)"
                :disabled="readOnly"
                @change="toggleApplication(group, Boolean($event))"
              >
                全选
              </el-checkbox>
            </div>

            <div class="permission-list">
              <div
                v-for="resource in group.flatResources"
                :key="resource.id"
                class="permission-row"
                :style="{ paddingLeft: `${resource.depth * 22}px` }"
              >
                <el-checkbox
                  :model-value="selectedResourceIds.has(resource.id)"
                  :indeterminate="isResourceIndeterminate(resource)"
                  :disabled="readOnly"
                  @change="toggleResource(resource, Boolean($event))"
                />
                <el-tag size="small" :type="resourceTypeTag(resource.type)">
                  {{ formatPortalResourceType(resource.type) }}
                </el-tag>
                <span class="permission-name">{{ resource.displayName }}</span>
                <small>{{ resource.permissionCode || resource.routePath || resource.code }}</small>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ readOnly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!readOnly" type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import { formatPortalResourceType, formatPortalRoleType, formatPortalStatus } from '@/utils/portal-labels'

interface RolePermissionRecord {
  id: string
  code: string
  name: string
  description: string | null
  type: string
  status: string
  version: number
  updatedAt: string | null
  resourceIds: string[]
}

interface GrantableResourceRecord {
  id: string
  applicationId: string
  applicationCode: string
  applicationName: string
  parentId: string | null
  code: string
  type: string
  permissionCode: string | null
  displayName: string
  sortOrder: number
  status: string
  routeKey: string | null
  routePath: string | null
  iconKey: string | null
  visible: boolean
  keepAlive: boolean
}

interface ResourceNode extends GrantableResourceRecord {
  children: ResourceNode[]
  depth: number
}

interface ApplicationResourceGroup {
  applicationId: string
  applicationCode: string
  applicationName: string
  roots: ResourceNode[]
  flatResources: ResourceNode[]
}

const auth = useAuthStore()
const roles = ref<RolePermissionRecord[]>([])
const resources = ref<GrantableResourceRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref('')
const readOnly = ref(false)
const activeApplicationId = ref('')
const selectedResourceIds = ref<Set<string>>(new Set())
const filters = reactive({ keyword: '', status: '' })
const form = reactive({
  code: '',
  name: '',
  description: '',
  status: 'ACTIVE',
  version: 0,
})

const canManage = computed(() => auth.hasPermission('iam:role:write') && auth.hasPermission('iam:role:grant'))
const resourceById = computed(() => new Map(resources.value.map((resource) => [resource.id, resource])))
const filteredRoles = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return roles.value.filter((role) => {
    const matchKeyword = !keyword
      || role.code.toLowerCase().includes(keyword)
      || role.name.toLowerCase().includes(keyword)
    const matchStatus = !filters.status || role.status === filters.status
    return matchKeyword && matchStatus
  })
})
const resourceGroups = computed<ApplicationResourceGroup[]>(() => {
  const groups = new Map<string, ApplicationResourceGroup>()
  const nodes = new Map<string, ResourceNode>()
  for (const resource of resources.value) {
    nodes.set(resource.id, { ...resource, children: [], depth: 0 })
    if (!groups.has(resource.applicationId)) {
      groups.set(resource.applicationId, {
        applicationId: resource.applicationId,
        applicationCode: resource.applicationCode,
        applicationName: resource.applicationName,
        roots: [],
        flatResources: [],
      })
    }
  }
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent && parent.applicationId === node.applicationId) {
      parent.children.push(node)
    } else {
      groups.get(node.applicationId)?.roots.push(node)
    }
  }
  for (const group of groups.values()) {
    sortNodes(group.roots)
    group.flatResources = flattenNodes(group.roots, 0)
  }
  return [...groups.values()]
})

async function load() {
  loading.value = true
  try {
    ;[roles.value, resources.value] = await Promise.all([
      apiClient.get('/management/tenant/role-permissions/roles') as Promise<RolePermissionRecord[]>,
      apiClient.get('/management/tenant/role-permissions/grantable-resources') as Promise<GrantableResourceRecord[]>,
    ])
    if (!activeApplicationId.value && resourceGroups.value.length > 0) {
      activeApplicationId.value = resourceGroups.value[0].applicationId
    }
  } finally {
    loading.value = false
  }
}

function open(row?: RolePermissionRecord) {
  editingId.value = row?.id || ''
  readOnly.value = !!row && (row.type !== 'CUSTOM' || !canManage.value)
  Object.assign(form, row
    ? {
        code: row.code,
        name: row.name,
        description: row.description || '',
        status: row.status,
        version: row.version,
      }
    : {
        code: '',
        name: '',
        description: '',
        status: 'ACTIVE',
        version: 0,
      })
  selectedResourceIds.value = new Set(row?.resourceIds || [])
  if (!activeApplicationId.value && resourceGroups.value.length > 0) {
    activeApplicationId.value = resourceGroups.value[0].applicationId
  }
  dialogVisible.value = true
}

async function save() {
  try {
    if (!form.name.trim()) throw new Error('请填写角色名称')
    saving.value = true
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      resourceIds: [...selectedResourceIds.value],
      version: form.version,
    }
    if (editingId.value) {
      await apiClient.put(`/management/tenant/role-permissions/roles/${editingId.value}`, payload)
    } else {
      await apiClient.post('/management/tenant/role-permissions/roles', payload)
    }
    ElMessage.success('角色权限已保存')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色权限保存失败')
  } finally {
    saving.value = false
  }
}

function toggleApplication(group: ApplicationResourceGroup, checked: boolean) {
  const next = new Set(selectedResourceIds.value)
  for (const resource of group.flatResources) {
    if (checked) next.add(resource.id)
    else next.delete(resource.id)
  }
  selectedResourceIds.value = next
}

function toggleResource(resource: ResourceNode, checked: boolean) {
  const next = new Set(selectedResourceIds.value)
  const relatedIds = [resource.id, ...descendantIds(resource)]
  if (checked) {
    relatedIds.forEach((id) => next.add(id))
    ancestorIds(resource).forEach((id) => next.add(id))
  } else {
    relatedIds.forEach((id) => next.delete(id))
  }
  selectedResourceIds.value = next
}

function isApplicationChecked(group: ApplicationResourceGroup) {
  return group.flatResources.length > 0
    && group.flatResources.every((resource) => selectedResourceIds.value.has(resource.id))
}

function isApplicationIndeterminate(group: ApplicationResourceGroup) {
  const selected = selectedCount(group)
  return selected > 0 && selected < group.flatResources.length
}

function selectedCount(group: ApplicationResourceGroup) {
  return group.flatResources.filter((resource) => selectedResourceIds.value.has(resource.id)).length
}

function isResourceIndeterminate(resource: ResourceNode) {
  const children = descendantIds(resource)
  if (children.length === 0 || selectedResourceIds.value.has(resource.id)) return false
  return children.some((id) => selectedResourceIds.value.has(id))
}

function descendantIds(resource: ResourceNode): string[] {
  return resource.children.flatMap((child) => [child.id, ...descendantIds(child)])
}

function ancestorIds(resource: GrantableResourceRecord): string[] {
  const ids: string[] = []
  let current = resource.parentId ? resourceById.value.get(resource.parentId) : undefined
  while (current) {
    ids.push(current.id)
    current = current.parentId ? resourceById.value.get(current.parentId) : undefined
  }
  return ids
}

function sortNodes(nodes: ResourceNode[]) {
  nodes.sort((first, second) => first.sortOrder - second.sortOrder || first.code.localeCompare(second.code))
  nodes.forEach((node) => sortNodes(node.children))
}

function flattenNodes(nodes: ResourceNode[], depth: number): ResourceNode[] {
  return nodes.flatMap((node) => {
    node.depth = depth
    return [node, ...flattenNodes(node.children, depth + 1)]
  })
}

function grantSummary(role: RolePermissionRecord) {
  const permissionCount = role.resourceIds
    .map((id) => resourceById.value.get(id))
    .filter((resource): resource is GrantableResourceRecord => !!resource?.permissionCode)
    .length
  return `${role.resourceIds.length} 项，${permissionCount} 个权限`
}

function resourceTypeTag(type: string) {
  if (type === 'MENU') return 'info'
  if (type === 'PAGE') return 'success'
  if (type === 'API') return 'warning'
  return ''
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.management-page {
  display: grid;
  gap: 18px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.page-kicker {
  margin: 0 0 6px;
  color: #2563eb;
  font-weight: 700;
}

.page-header h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.page-actions {
  display: flex;
  gap: 10px;
}

.keyword-input {
  width: 220px;
}

.status-select {
  width: 140px;
}

.management-table {
  border: 1px solid #e2e8f0;
}

.role-form {
  max-width: 720px;
}

.permission-panel {
  display: grid;
  gap: 12px;
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.permission-panel__header,
.application-grant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.application-grant-header span {
  margin-left: 10px;
  color: #64748b;
  font-size: 13px;
}

.permission-tabs {
  min-height: 360px;
}

.permission-list {
  display: grid;
  max-height: 420px;
  overflow: auto;
  border: 1px solid #e2e8f0;
}

.permission-row {
  display: grid;
  grid-template-columns: 28px 64px minmax(160px, 1fr) minmax(180px, 1.2fr);
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #eef2f7;
}

.permission-row:last-child {
  border-bottom: 0;
}

.permission-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-weight: 600;
}

.permission-row small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}
</style>
