<template>
  <div class="menu-management">
    <section class="page-heading">
      <div>
        <span class="eyebrow">SYSTEM SETTINGS</span>
        <h1>菜单管理</h1>
        <p>配置当前租户已开通菜单的显示方式。页面路由、按钮和 API 权限仍由平台资源目录统一维护。</p>
      </div>
      <el-button v-if="canWrite" type="primary" @click="openGroup()">新增自定义分组</el-button>
    </section>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>菜单启用不等于角色授权</template>
      租户菜单在这里启用后，仍需到“角色与资源授权”为普通角色分配权限；自定义分组只组织导航，不会创建新页面或权限。
    </el-alert>

    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <el-select v-model="applicationCode" placeholder="选择应用" class="application-select">
          <el-option v-for="item in applications" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
        <el-input v-model="keyword" clearable placeholder="搜索菜单名称或资源编码" class="search-input" />
        <span class="summary">{{ filteredMenus.length }} 个可配置菜单</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="系统菜单" name="menus">
          <el-table :data="filteredMenus" row-key="resourceId">
            <el-table-column label="菜单名称" min-width="220">
              <template #default="scope">
                <div class="name-cell">
                  <strong>{{ scope.row.displayName }}</strong>
                  <small v-if="scope.row.displayName !== scope.row.originalDisplayName">
                    平台名称：{{ scope.row.originalDisplayName }}
                  </small>
                  <small v-else>{{ scope.row.code }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="90">
              <template #default="scope">
                <el-tag effect="plain" :type="scope.row.type === 'MENU' ? 'primary' : 'info'">
                  {{ scope.row.type === 'MENU' ? '目录' : '页面' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="自定义分组" min-width="160">
              <template #default="scope">{{ groupName(scope.row.parentGroupId) }}</template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="90" />
            <el-table-column label="平台状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.platformVisible ? 'success' : 'danger'" effect="light">
                  {{ scope.row.platformVisible ? '可展示' : '已停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="租户显示" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.visible ? 'success' : 'info'" effect="light">
                  {{ scope.row.visible ? '已启用' : '未启用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="scope">
                <el-button v-if="canWrite" link type="primary" @click="openMenu(scope.row)">配置</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`自定义分组 (${filteredGroups.length})`" name="groups">
          <el-empty v-if="filteredGroups.length === 0" description="当前应用还没有自定义分组" />
          <el-table v-else :data="filteredGroups" row-key="id">
            <el-table-column prop="displayName" label="分组名称" min-width="200" />
            <el-table-column prop="code" label="分组编码" min-width="220" />
            <el-table-column label="上级分组" min-width="160">
              <template #default="scope">{{ groupName(scope.row.parentId) }}</template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="90" />
            <el-table-column label="状态" width="110">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'ACTIVE' && scope.row.visible ? 'success' : 'info'">
                  {{ scope.row.status === 'ACTIVE' && scope.row.visible ? '显示' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="scope">
                <el-button v-if="canWrite" link type="primary" @click="openGroup(scope.row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="menuDialog" title="配置租户菜单" width="560px">
      <el-form label-width="110px">
        <el-form-item label="平台资源">
          <div class="readonly-field">
            <strong>{{ editingMenu?.originalDisplayName }}</strong>
            <span>{{ editingMenu?.code }}</span>
          </div>
        </el-form-item>
        <el-form-item label="租户显示名称">
          <el-input v-model="menuForm.displayName" maxlength="128" placeholder="留空则使用平台名称" />
        </el-form-item>
        <el-form-item label="图标标识">
          <el-input v-model="menuForm.iconKey" maxlength="128" placeholder="留空则使用平台图标" />
        </el-form-item>
        <el-form-item label="显示排序">
          <el-input-number v-model="menuForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="自定义分组">
          <el-select v-model="menuForm.parentGroupId" clearable placeholder="沿用平台菜单层级" style="width: 100%">
            <el-option v-for="item in availableGroups" :key="item.id" :label="item.displayName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="租户启用">
          <el-switch v-model="menuForm.visible" :disabled="!editingMenu?.platformVisible" />
          <span v-if="!editingMenu?.platformVisible" class="field-help">平台已停用，租户不能强制开启</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="menuDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMenu">保存配置</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="groupDialog" :title="editingGroupId ? '编辑自定义分组' : '新增自定义分组'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="所属应用" required>
          <el-select v-model="groupForm.applicationId" :disabled="!!editingGroupId" style="width: 100%">
            <el-option v-for="item in applications" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分组编码" required>
          <el-input v-model="groupForm.code" :disabled="!!editingGroupId" maxlength="128" placeholder="如 SALES_DAILY" />
        </el-form-item>
        <el-form-item label="分组名称" required>
          <el-input v-model="groupForm.displayName" maxlength="128" />
        </el-form-item>
        <el-form-item label="上级分组">
          <el-select v-model="groupForm.parentId" clearable placeholder="一级分组" style="width: 100%">
            <el-option
              v-for="item in groupParentOptions"
              :key="item.id"
              :label="item.displayName"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="图标标识"><el-input v-model="groupForm.iconKey" maxlength="128" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="groupForm.sortOrder" :min="0" :max="9999" /></el-form-item>
        <el-form-item label="显示"><el-switch v-model="groupForm.visible" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="groupForm.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveGroup">保存分组</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import type { TenantMenuGroupRecord, TenantMenuRecord } from '@/types/management'

interface TenantApplicationOption {
  id: string
  code: string
  name: string
}

const auth = useAuthStore()
const menus = ref<TenantMenuRecord[]>([])
const groups = ref<TenantMenuGroupRecord[]>([])
const applicationCode = ref('')
const keyword = ref('')
const activeTab = ref('menus')
const menuDialog = ref(false)
const groupDialog = ref(false)
const saving = ref(false)
const editingMenu = ref<TenantMenuRecord | null>(null)
const editingGroupId = ref('')

const menuForm = reactive({ displayName: '', iconKey: '', sortOrder: 0, parentGroupId: null as string | null, visible: false })
const groupForm = reactive({
  applicationId: '', parentId: null as string | null, code: '', displayName: '', iconKey: '',
  sortOrder: 0, visible: true, status: 'ACTIVE', version: 0,
})

const canWrite = computed(() => auth.hasPermission('iam:menu:write'))
const applications = computed<TenantApplicationOption[]>(() => {
  const values = new Map<string, TenantApplicationOption>()
  menus.value.forEach((item) => values.set(item.applicationCode, {
    id: item.applicationId, code: item.applicationCode, name: item.applicationName,
  }))
  return [...values.values()]
})
const filteredMenus = computed(() => menus.value.filter((item) => {
  const matchesApplication = !applicationCode.value || item.applicationCode === applicationCode.value
  const term = keyword.value.trim().toLowerCase()
  return matchesApplication && (!term
    || item.displayName.toLowerCase().includes(term)
    || item.originalDisplayName.toLowerCase().includes(term)
    || item.code.toLowerCase().includes(term))
}))
const filteredGroups = computed(() => groups.value.filter((item) => !applicationCode.value || item.applicationCode === applicationCode.value))
const availableGroups = computed(() => groups.value.filter((item) => item.applicationId === editingMenu.value?.applicationId
  && item.status === 'ACTIVE'))
const groupParentOptions = computed(() => groups.value.filter((item) => item.applicationId === groupForm.applicationId
  && item.id !== editingGroupId.value))

watch(applications, (items) => {
  if (!applicationCode.value && items[0]) applicationCode.value = items[0].code
}, { immediate: true })

function groupName(id: string | null): string {
  if (!id) return '沿用平台层级'
  return groups.value.find((item) => item.id === id)?.displayName || '未知分组'
}

async function load(): Promise<void> {
  [menus.value, groups.value] = await Promise.all([
    apiClient.get('/management/tenant/menus') as Promise<TenantMenuRecord[]>,
    apiClient.get('/management/tenant/menu-groups') as Promise<TenantMenuGroupRecord[]>,
  ])
}

function openMenu(row: TenantMenuRecord): void {
  editingMenu.value = row
  Object.assign(menuForm, {
    displayName: row.displayName === row.originalDisplayName ? '' : row.displayName,
    iconKey: row.iconKey === row.originalIconKey ? '' : row.iconKey || '',
    sortOrder: row.sortOrder,
    parentGroupId: row.parentGroupId,
    visible: row.platformVisible && row.visible,
  })
  menuDialog.value = true
}

async function saveMenu(): Promise<void> {
  if (!editingMenu.value) return
  saving.value = true
  try {
    await apiClient.put(`/management/tenant/menus/${editingMenu.value.resourceId}`, {
      displayNameOverride: menuForm.displayName.trim() || null,
      iconKeyOverride: menuForm.iconKey.trim() || null,
      sortOrderOverride: menuForm.sortOrder === editingMenu.value.originalSortOrder ? null : menuForm.sortOrder,
      parentGroupId: menuForm.parentGroupId,
      visible: editingMenu.value.platformVisible && menuForm.visible,
      version: editingMenu.value.version,
    })
    ElMessage.success('租户菜单配置已保存')
    menuDialog.value = false
    await load()
  } finally {
    saving.value = false
  }
}

function openGroup(row?: TenantMenuGroupRecord): void {
  editingGroupId.value = row?.id || ''
  const selectedApplication = applications.value.find((item) => item.code === applicationCode.value) || applications.value[0]
  Object.assign(groupForm, row || {
    applicationId: selectedApplication?.id || '', parentId: null, code: '', displayName: '', iconKey: '',
    sortOrder: 0, visible: true, status: 'ACTIVE', version: 0,
  })
  groupDialog.value = true
}

async function saveGroup(): Promise<void> {
  if (!groupForm.applicationId || !groupForm.code.trim() || !groupForm.displayName.trim()) {
    ElMessage.warning('请填写所属应用、分组编码和分组名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...groupForm,
      code: groupForm.code.trim(),
      displayName: groupForm.displayName.trim(),
      iconKey: groupForm.iconKey.trim() || null,
    }
    if (editingGroupId.value) {
      await apiClient.put(`/management/tenant/menu-groups/${editingGroupId.value}`, payload)
    } else {
      await apiClient.post('/management/tenant/menu-groups', payload)
    }
    ElMessage.success('自定义分组已保存')
    groupDialog.value = false
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(() => { void load() })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.menu-management { display: grid; gap: 18px; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; }
.page-heading h1 { margin: 4px 0 6px; color: $color-text-primary; font-size: 24px; }
.page-heading p { margin: 0; color: $color-text-secondary; font-size: 14px; }
.eyebrow { color: $color-primary; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
.content-card { border: 1px solid $color-border-base; }
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.application-select { width: 220px; }
.search-input { width: 300px; }
.summary { margin-left: auto; color: $color-text-secondary; font-size: 13px; }
.name-cell, .readonly-field { display: grid; gap: 3px; }
.name-cell small, .readonly-field span, .field-help { color: $color-text-secondary; font-size: 12px; }
.readonly-field strong { color: $color-text-primary; }

@media (max-width: 900px) {
  .page-heading, .toolbar { align-items: stretch; flex-direction: column; }
  .application-select, .search-input { width: 100%; }
  .summary { margin-left: 0; }
}
</style>
