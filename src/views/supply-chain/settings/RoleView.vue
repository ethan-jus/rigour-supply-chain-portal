<template>
  <div class="supply-page">
    <header class="heading">
      <div>
        <SupplyPageTitle>角色管理</SupplyPageTitle>
        <p>先配置能使用的菜单和按钮，再统一设置能查看、操作的数据。</p>
      </div>
      <el-button v-if="access.can('supply:role:create')" type="primary" @click="edit()"
        >新增角色</el-button
      >
    </header>
    <el-input
      v-model="keyword"
      clearable
      placeholder="搜索角色名称或编码"
      style="max-width: 340px; margin-bottom: 16px"
    />
    <el-table v-loading="loading" :data="filtered" row-key="id"
      ><el-table-column prop="name" label="角色名称" min-width="180" /><el-table-column
        prop="code"
        label="角色编码"
        min-width="180"
      /><!-- @vue-generic {SupplyRole} --><el-table-column label="数据范围" min-width="180"
        ><template #default="{ row }"
          ><el-tag :type="row.protectedRole || row.dataScope ? 'info' : 'warning'">{{
            scopeLabel(row)
          }}</el-tag></template
        ></el-table-column
      ><el-table-column prop="description" label="说明" min-width="160" /><el-table-column
        prop="userCount"
        label="用户数"
        width="90"
      /><el-table-column label="状态" width="130"
        ><template #default="{ row }">{{
          row.protectedRole ? '内置管理员' : row.status === 'ACTIVE' ? '启用' : '停用'
        }}</template></el-table-column
      >
      <!-- @vue-generic {SupplyRole} -->
      <el-table-column label="操作" width="260"
        ><template #default="{ row }"
          ><el-button
            v-if="access.can('supply:role:update') && access.can('supply:role:grant')"
            link
            type="primary"
            @click="edit(row)"
            >{{ row.protectedRole ? '查看' : '编辑授权' }}</el-button
          ><el-button
            v-if="
              !row.protectedRole &&
              access.can('supply:user:read') &&
              access.can('supply:user:assign-role')
            "
            link
            type="primary"
            @click="roleMembers?.open(row)"
            >分配用户</el-button
          ><el-button
            v-if="!row.protectedRole && access.can('supply:role:delete')"
            link
            type="danger"
            :disabled="row.status !== 'DISABLED' || row.userCount > 0"
            title="角色须先停用并解除全部用户关联，才能删除"
            @click="remove(row)"
            >删除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <RoleMembersDrawer ref="roleMembers" @saved="load" />
    <el-drawer
      v-model="visible"
      :title="protectedRole ? '查看内置管理员' : editingId ? '编辑角色' : '新增角色'"
      size="min(1050px,96vw)"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" :disabled="protectedRole">
        <div class="grid">
          <el-form-item label="角色名称" required
            ><el-input v-model="form.name" maxlength="128" /></el-form-item
          ><el-form-item label="角色编码" required
            ><el-input
              v-model="form.code"
              :disabled="!!editingId"
              placeholder="例如 CITY_MANAGER"
              maxlength="64"
            /><small>2–64 位字母、数字或下划线，以字母开头；小写自动转为大写。</small></el-form-item
          >
        </div>
        <el-form-item label="说明"
          ><el-input v-model="form.description" maxlength="500" /></el-form-item
        ><el-form-item label="状态"
          ><el-radio-group v-model="form.status"
            ><el-radio value="ACTIVE">启用</el-radio
            ><el-radio value="DISABLED">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-alert
          v-if="protectedRole"
          title="自动拥有本企业全部已启用功能与业务数据权限"
          description="可使用全部菜单、按钮和当前企业的全部数据。企业之间的数据仍严格隔离。"
          type="info"
          show-icon
          :closable="false"
        />
        <template v-else>
          <el-alert
            title="保存后立即生效。菜单决定可用功能，数据范围决定可访问的记录。"
            type="info"
            :closable="false"
          />
          <el-tabs v-model="tab"
            ><el-tab-pane label="菜单与操作权限" name="menus"
              ><div class="menu-toolbar">
                <span class="field-help"
                  >点击“全部菜单”全选或取消；选择目录会包含下级菜单和按钮。</span
                ><el-tag type="info"
                  >已选 {{ form.menuNodeIds.length }} / {{ enabledMenuIds.size }} 项</el-tag
                >
              </div>
              <el-tree
                ref="menuTree"
                :data="menuNodes"
                :default-expanded-keys="[ALL_MENUS]"
                node-key="id"
                show-checkbox
                :props="{ label: 'name', children: 'children', disabled: 'disabled' }"
                @check="menuChecked"
            /></el-tab-pane>
            <el-tab-pane label="业务数据范围" name="scopes">
              <div class="scope-intro">
                <h3>这个角色可以访问哪些数据？</h3>
                <p>
                  选择一次，统一应用到该角色已勾选的业务菜单和按钮。功能权限仍决定能否新增、修改、删除或导出。
                </p>
              </div>
              <el-radio-group v-model="scopeMode" class="scope-options" aria-label="业务数据范围">
                <el-radio
                  v-for="option in scopeOptions"
                  :key="option.value"
                  :value="option.value"
                  border
                >
                  <span class="scope-option-title">{{ option.label }}</span>
                  <span class="scope-option-description">{{ option.description }}</span>
                </el-radio>
              </el-radio-group>
              <section v-if="scopeMode === 'CUSTOM'" class="department-selection">
                <el-form-item label="选择可访问的部门" required>
                  <ScopeReferencePicker v-model="departmentIds" dimension="DEPARTMENT" />
                </el-form-item>
                <p class="field-help">
                  已选择 {{ departmentIds.length }} 个部门。各部门独立选择，不自动包含下级部门。
                </p>
              </section>
              <div class="scope-summary" role="status">
                <strong>范围说明</strong>
                <p>{{ selectedScopeHelp }}</p>
                <p>数据范围仅限当前企业，统一按角色配置执行。</p>
                <p>用户有多个角色时，仅合并授予当前功能的角色数据范围。</p>
              </div>
            </el-tab-pane></el-tabs
          ></template
        > </el-form
      ><template #footer>
        <el-alert
          v-if="saveError"
          class="role-save-error"
          :title="saveError"
          type="error"
          show-icon
          :closable="false"
        />
        <el-button @click="visible = false">关闭</el-button
        ><el-button v-if="!protectedRole" type="primary" :loading="saving" @click="save"
          >保存角色及授权</el-button
        ></template
      >
    </el-drawer>
    <el-dialog
      v-model="impactVisible"
      title="角色停用影响预览"
      width="min(760px,95vw)"
      :close-on-click-modal="false"
    >
      <template v-if="disableImpact">
        <p>
          关联 {{ disableImpact.userCount }} 人，其中启用用户
          {{ disableImpact.activeUserCount }} 人。最多展示前 100 个账号。
        </p>
        <p>受影响账号：{{ disableImpact.usernames.join('、') || '无' }}</p>
        <el-alert
          v-if="disableImpact.lastRoleUsernames.length"
          type="error"
          :closable="false"
          :title="
            '以下启用用户将失去最后一个有效角色，请先分配替代角色：' +
            disableImpact.lastRoleUsernames.join('、')
          "
        />
        <el-alert
          v-if="disableImpact.managementEntryUsernames.length"
          type="error"
          :closable="false"
          :title="
            '以下用户将失去管理入口，请先完成交接：' +
            disableImpact.managementEntryUsernames.join('、')
          "
        />
        <el-alert
          v-if="!disableImpact.canDisable"
          type="warning"
          :closable="false"
          title="当前不允许停用。完成角色交接后，请重新生成预览。"
        />
      </template>
      <template #footer
        ><el-button @click="impactVisible = false">返回调整</el-button
        ><el-button
          type="primary"
          :disabled="!disableImpact?.canDisable"
          :loading="saving"
          @click="persistRole"
          >确认停用并保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElTree } from 'element-plus'
import {
  supplyAccessApi,
  type SupplyRole,
  type SupplyRoleImpact,
  type SupplyRoleCommand,
  type SupplyMenuNode,
  type RoleDataScope,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import ScopeReferencePicker from './ScopeReferencePicker.vue'
import RoleMembersDrawer from './RoleMembersDrawer.vue'
const roleMembers = ref<InstanceType<typeof RoleMembersDrawer>>()
import { errorMessage } from '@/api/core/error'
const access = useSupplyAuthorizationStore(),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  keyword = ref(''),
  editingId = ref<string | null>(null),
  protectedRole = ref(false),
  tab = ref('menus')
const roles = ref<SupplyRole[]>([]),
  menus = ref<SupplyMenuNode[]>([]),
  menuTree = ref<InstanceType<typeof ElTree>>()
const empty = (): SupplyRoleCommand => ({
  code: '',
  name: '',
  description: null,
  status: 'ACTIVE',
  version: 0,
  menuNodeIds: [],
  rules: [],
  dataScope: { mode: 'ALL', departmentIds: [] },
})
const form = reactive<SupplyRoleCommand>(empty())
const saveError = ref('')
const impactVisible = ref(false)
const disableImpact = ref<SupplyRoleImpact | null>(null)
const filtered = computed(() =>
  roles.value.filter((r) => (r.name + r.code).includes(keyword.value)),
)
const ALL_MENUS = '__all_menus__'
type Menu = { id: string; name: string; children: Menu[]; disabled: boolean }
const scopeOptions = [
  { value: 'ALL', label: '全部数据', description: '当前企业的全部业务数据' },
  { value: 'CUSTOM', label: '选择部门', description: '仅所选部门归属的业务数据' },
  { value: 'DEPARTMENT', label: '本部门', description: '跟随用户当前所在部门' },
  { value: 'SELF', label: '本人数据', description: '仅本人负责或归属的业务数据' },
] as const
const scopeMode = computed({
  get: () => form.dataScope?.mode ?? '',
  set: (mode: string) => {
    saveError.value = ''
    form.dataScope = {
      mode: mode as RoleDataScope['mode'],
      departmentIds: mode === 'CUSTOM' ? (form.dataScope?.departmentIds ?? []) : [],
    }
  },
})
const departmentIds = computed({
  get: () => form.dataScope?.departmentIds ?? [],
  set: (ids: string[]) => {
    if (form.dataScope) form.dataScope.departmentIds = ids
  },
})
function scopeLabel(role: SupplyRole) {
  if (role.protectedRole) return '全部数据'
  if (!role.dataScope) return '全部数据'
  const label = scopeOptions.find((o) => o.value === role.dataScope?.mode)?.label ?? '待设置'
  return role.dataScope.mode === 'CUSTOM'
    ? `${label} · ${role.dataScope.departmentIds.length} 个`
    : label
}
const selectedScopeHelp = computed(
  () =>
    ({
      ALL: '该角色可对当前企业全部业务记录执行已授权操作。',
      CUSTOM: '按业务记录归属部门过滤；勾选几个部门，就能访问这些部门的数据。',
      DEPARTMENT:
        '按登录用户关联员工的当前部门过滤，不自动包含下级部门；没有有效部门时不能访问业务记录。',
      SELF: '客户按主责员工、订单按归属员工、人事按员工本人过滤。自己创建的订单草稿仍可处理，其他已归属记录按归属员工判断。',
    })[scopeMode.value as RoleDataScope['mode']] ?? '请选择一种数据范围；未选择时无法保存。',
)
const enabledMenuIds = computed(() => {
  const nodes = new Map(menus.value.map((n) => [n.id, n]))
  return new Set(
    menus.value
      .filter((n) => {
        const seen = new Set<string>()
        let current: SupplyMenuNode | undefined = n
        while (current) {
          if (current.status !== 'ACTIVE' || seen.has(current.id)) return false
          seen.add(current.id)
          if (current.parentId && !nodes.has(current.parentId)) return false
          current = current.parentId ? nodes.get(current.parentId) : undefined
        }
        return true
      })
      .map((n) => n.id),
  )
})
const menuNodes = computed(() => {
  const map = new Map(
    menus.value
      .filter((n) => enabledMenuIds.value.has(n.id))
      .map((n) => [
        n.id,
        {
          ...n,
          children: [] as Menu[],
          disabled: !enabledMenuIds.value.has(n.id) || protectedRole.value,
        },
      ]),
  )
  const roots: Menu[] = []
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return [
    {
      id: ALL_MENUS,
      name: '全部菜单',
      children: roots,
      disabled: protectedRole.value || !roots.length,
    },
  ]
})
async function load() {
  loading.value = true
  try {
    roles.value = await supplyAccessApi.roles()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '角色加载失败')
  } finally {
    loading.value = false
  }
}
async function edit(row?: SupplyRole) {
  saveError.value = ''
  try {
    menus.value = await supplyAccessApi.menus()
    editingId.value = row?.id ?? null
    protectedRole.value = row?.protectedRole ?? false
    Object.assign(
      form,
      row
        ? JSON.parse(
            JSON.stringify({
              code: row.code,
              name: row.name,
              description: row.description,
              status: row.status,
              version: row.version,
              menuNodeIds: row.menuNodeIds,
              rules: row.rules,
              dataScope: row.dataScope ?? { mode: 'ALL', departmentIds: [] },
            }),
          )
        : empty(),
    )
    tab.value = 'menus'
    visible.value = true
    await nextTick()
    // 逐项恢复已有授权；不能用 setCheckedKeys 把保存的半选父级扩展成全部下级权限。
    menuTree.value?.setCheckedKeys([])
    const restore = (nodes: Menu[]) =>
      nodes.forEach((node) => {
        if (enabledMenuIds.value.has(node.id) && form.menuNodeIds.includes(node.id))
          menuTree.value?.setChecked(node.id, true, false)
        restore(node.children)
      })
    restore(menuNodes.value)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '授权目录加载失败')
  }
}
function syncChecked() {
  form.menuNodeIds = [
    ...new Set(
      [
        ...(menuTree.value?.getCheckedKeys(false) ?? []),
        ...(menuTree.value?.getHalfCheckedKeys() ?? []),
      ].map(String),
    ),
  ].filter((id) => enabledMenuIds.value.has(id))
}
function menuChecked() {
  syncChecked()
}
function validateScope(): string | null {
  if (!form.dataScope) return '请选择业务数据范围'
  if (form.dataScope.mode === 'CUSTOM' && !form.dataScope.departmentIds.length)
    return '请至少选择一个部门'
  return null
}
async function save() {
  if (saving.value) return
  saveError.value = ''
  syncChecked()
  form.name = form.name.trim()
  form.code = form.code.trim().toUpperCase()
  if (!form.name.trim() || !form.code.trim()) {
    saveError.value = '请输入角色名称和编码'
    return
  }
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(form.code)) {
    saveError.value = '角色编码需为 2–64 位字母、数字或下划线，且以字母开头'
    return
  }
  const error = validateScope()
  if (error) {
    tab.value = 'scopes'
    saveError.value = error
    return
  }
  try {
    if (editingId.value) {
      const role = roles.value.find((r) => r.id === editingId.value)
      if (role?.status === 'ACTIVE' && form.status === 'DISABLED') {
        disableImpact.value = await supplyAccessApi.roleImpact(role.id)
        if (disableImpact.value.version !== form.version) {
          saveError.value = '角色已变化，请关闭并重新编辑后预览'
          return
        }
        impactVisible.value = true
        return
      }
      if (role?.userCount)
        await ElMessageBox.confirm(
          `本次变更将影响 ${role.userCount} 名用户的后续操作。`,
          '确认角色变更',
          { type: 'warning' },
        )
    }
    await persistRole()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') saveError.value = errorMessage(e, '角色保存失败，请重试')
  }
}
async function persistRole() {
  if (impactVisible.value && !disableImpact.value?.canDisable) return
  try {
    saving.value = true
    saveError.value = ''
    await supplyAccessApi.saveRole(editingId.value, {
      ...JSON.parse(JSON.stringify(form)),
      rules: [], // 动作规则由后端依据统一范围及实际菜单权限生成。
    })
    visible.value = false
    impactVisible.value = false
    await Promise.all([load(), access.refresh()])
    ElMessage.success('角色及授权已保存，数据范围已生效')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') saveError.value = errorMessage(e, '角色保存失败，请重试')
  } finally {
    saving.value = false
  }
}
async function remove(role: SupplyRole) {
  try {
    const impact = await supplyAccessApi.roleImpact(role.id)
    if (!impact.canDelete) {
      ElMessage.warning('请先停用角色并解除全部用户关联，再删除')
      return
    }
    await ElMessageBox.confirm(`删除已停用且无关联用户的角色“${role.name}”？`, '删除角色', {
      type: 'warning',
    })
    await supplyAccessApi.deleteRole(role.id, impact.version)
    await Promise.all([load(), access.refresh()])
  } catch (e) {
    if (e !== 'cancel' && e !== 'close')
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
onMounted(load)
</script>
<style scoped>
.role-save-error {
  margin-bottom: 12px;
  text-align: left;
}
.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.heading p {
  color: #64748b;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.scope-notice {
  margin-bottom: 16px;
}
.field-help {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}
.menu-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.scope-intro h3 {
  margin: 8px 0;
  font-size: 16px;
}
.scope-intro p,
.scope-summary p {
  color: #64748b;
  font-size: 13px;
  line-height: 1.8;
}
.scope-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.scope-options .el-radio {
  height: auto;
  min-height: 82px;
  padding: 16px;
  margin: 0;
  white-space: normal;
}
.scope-option-title {
  display: block;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 6px;
}
.scope-option-description {
  display: block;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}
.scope-summary {
  border-top: 1px solid #e2e8f0;
  padding-top: 18px;
  margin-top: 22px;
}
.department-selection {
  padding: 18px;
  background: #f8fafc;
  border-radius: 8px;
}
@media (max-width: 700px) {
  .grid,
  .scope-options {
    grid-template-columns: 1fr;
  }
}
</style>
