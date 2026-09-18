<template>
  <div class="supply-page">
    <header class="heading">
      <div>
        <SupplyPageTitle>角色管理</SupplyPageTitle>
        <p>配置菜单、操作权限及各项业务的数据范围。</p>
      </div>
      <el-button v-if="access.can('supply:role:create')" type="primary" @click="edit()"
        >新增角色</el-button
      >
    </header>
    <el-button
      v-if="access.context?.mode === 'PREPARING' && access.can('supply:role:grant')"
      style="margin-bottom: 16px"
      @click="showLegacyRoles"
      >从旧角色迁入 / 查看来源</el-button
    >
    <el-dialog v-model="legacyVisible" title="旧供应链角色迁入" width="min(900px,96vw)">
      <el-alert
        title="仅复制当前供应链可用功能。迁入角色保持停用，数据范围均为无；请编辑授权并核对后启用，随后再为用户分配。"
        type="warning"
        :closable="false"
      />
      <el-table :data="legacyRoles" max-height="450">
        <el-table-column type="expand"
          ><template #default="{ row }"
            ><p>{{ row.permissions.join('、') }}</p>
            <p v-if="row.importedRoleId">供应链角色编号：{{ row.importedRoleId }}</p></template
          ></el-table-column
        >
        <el-table-column prop="name" label="旧角色" /><el-table-column
          prop="code"
          label="旧角色编码"
        />
        <el-table-column label="可复制功能数"
          ><template #default="{ row }">{{ row.permissions.length }}</template></el-table-column
        >
        <el-table-column label="迁入状态"
          ><template #default="{ row }">{{
            row.importedRoleId ? '已迁入' : '未迁入'
          }}</template></el-table-column
        >
        <!-- @vue-generic {LegacySupplyRole} -->
        <el-table-column label="操作"
          ><template #default="{ row }"
            ><el-button v-if="!row.importedRoleId" link type="primary" @click="importLegacy(row)"
              >预览并迁入</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-dialog>
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
      /><el-table-column prop="description" label="说明" min-width="240" /><el-table-column
        prop="userCount"
        label="用户数"
        width="90"
      /><el-table-column label="状态" width="130"
        ><template #default="{ row }">{{
          row.protectedRole ? '内置管理员' : row.status === 'ACTIVE' ? '启用' : '停用'
        }}</template></el-table-column
      >
      <!-- @vue-generic {SupplyRole} -->
      <el-table-column label="操作" width="160"
        ><template #default="{ row }"
          ><el-button
            v-if="access.can('supply:role:update') && access.can('supply:role:grant')"
            link
            type="primary"
            @click="edit(row)"
            >{{ row.protectedRole ? '查看' : '编辑授权' }}</el-button
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
          /></el-form-item>
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
          description="包括菜单、按钮、客户、部门和仓库范围；后续新增功能自动生效，无需逐项勾选。企业之间的数据仍严格隔离。"
          type="info"
          show-icon
          :closable="false"
        />
        <template v-else>
          <el-alert
            v-if="access.context?.mode === 'PREPARING'"
            class="scope-notice"
            type="warning"
            show-icon
            :closable="false"
            title="当前处于配置准备阶段"
            description="本页保存角色方案；业务请求仍按原授权执行。完成用户分配和权限核验后，需在系统设置首页启用新授权，数据范围才正式生效。"
          />
          <el-tabs v-model="tab"
            ><el-tab-pane label="菜单与操作权限" name="menus"
              ><p class="field-help">
                勾选或取消目录会同步处理全部可用下级菜单和按钮；部分选中时，父级显示半选。
              </p>
              <el-tree
                ref="menuTree"
                :data="menuNodes"
                node-key="id"
                show-checkbox
                :props="{ label: 'name', children: 'children', disabled: 'disabled' }"
                @check="menuChecked"
            /></el-tab-pane>
            <el-tab-pane label="业务数据范围" name="scopes">
              <el-alert
                type="info"
                :closable="false"
                title="功能权限决定能做什么；数据范围决定能对哪些记录操作。"
                description="先勾选菜单与按钮，再选择需要限制的操作，例如查看客户、查看订单、选择发货仓库、确认出库。每个操作单独配置，查看权限不会自动授予编辑或出库权限。"
              />
              <el-empty
                v-if="!actions.length"
                description="尚未选择可配置数据范围的功能，请先勾选具体业务菜单或按钮。"
                :image-size="64"
              >
                <el-button @click="tab = 'menus'">去选择功能</el-button>
              </el-empty>
              <p v-else class="field-help">
                已选 {{ actions.length }} 项可配置操作，{{ unconfiguredActions.length }}
                项尚未配置范围。新授权启用后，此角色不为未配置范围的操作提供业务记录权限。
              </p>
              <el-collapse class="scope-guide">
                <el-collapse-item title="这些范围怎么选？查看说明与示例" name="help">
                  <p>
                    普通销售：客户选“本人负责”，订单选“本人归属”；城市总：客户选“客户归属地区”，订单可选“部门范围”。具体杭州地区、杭州部门可以在用户分配角色时指定。
                  </p>
                  <p>
                    “分配角色时指定”：同一个城市总角色可分别给杭州、金华用户设置不同范围。“角色固定范围”：所有获此角色的用户共用指定范围。
                  </p>
                  <p>
                    同一条规则中的部门、客户地区、仓库条件需要同时满足。多个角色按各自完整规则合并，最后仍受用户客户地区、仓库授权上限限制。
                  </p>
                  <p>
                    客户可见范围不改变客户主责或订单业绩归属；订单选仓与确认出库要分别授权。部门负责人身份本身不会自动获得下级数据权限。
                  </p>
                </el-collapse-item>
              </el-collapse>
              <section v-for="(rule, index) in form.rules" :key="rule.id || index" class="rule">
                <div class="grid">
                  <el-form-item label="需要控制数据的操作" required
                    ><el-select
                      v-model="rule.actionCode"
                      placeholder="选择已勾选的业务操作"
                      filterable
                      @change="setObject(rule)"
                      ><el-option
                        v-for="action in availableActions(rule)"
                        :key="action.code"
                        :label="action.name"
                        :value="action.code" /></el-select></el-form-item
                  ><el-form-item label="数据范围" required
                    ><el-select
                      v-model="rule.scopeMode"
                      :disabled="!rule.actionCode"
                      @change="setScopeMode(rule)"
                      ><el-option
                        v-for="mode in allowedScopeModes(rule)"
                        :key="mode.value"
                        :label="mode.label"
                        :value="mode.value" /></el-select
                  ></el-form-item>
                </div>
                <p class="field-help">{{ scopeHelp(rule) }}</p>
                <div v-if="rule.actionCode && rule.scopeMode !== 'NONE'" class="grid">
                  <el-form-item
                    v-if="!['CUSTOMER', 'INVENTORY'].includes(rule.objectType)"
                    label="部门范围"
                    ><el-select
                      v-model="rule.departmentMode"
                      @change="clearFixed(rule, 'DEPARTMENT')"
                      ><el-option
                        v-if="rule.scopeMode !== 'DEPARTMENT'"
                        label="不额外限制部门"
                        value="NONE" /><el-option
                        label="跟随用户当前部门"
                        value="CURRENT" /><el-option
                        label="分配角色时指定管理部门"
                        value="MANAGED" /><el-option
                        label="角色固定部门"
                        value="SPECIFIED" /><el-option label="全部部门" value="ALL" /></el-select
                    ><ScopeReferencePicker
                      v-if="rule.departmentMode === 'SPECIFIED'"
                      v-model="rule.references.DEPARTMENT"
                      dimension="DEPARTMENT"
                  /></el-form-item>
                  <el-form-item
                    v-if="!['EMPLOYEE', 'INVENTORY'].includes(rule.objectType)"
                    label="客户地区范围"
                    ><el-select v-model="rule.regionMode" @change="clearFixed(rule, 'REGION')"
                      ><el-option
                        v-for="m in allowedDimensionModes(rule, 'REGION')"
                        :key="m.value"
                        :label="m.label"
                        :value="m.value" /></el-select
                    ><ScopeReferencePicker
                      v-if="rule.regionMode === 'SPECIFIED'"
                      v-model="rule.references.REGION"
                      dimension="REGION"
                  /></el-form-item>
                  <el-form-item
                    v-if="!['EMPLOYEE', 'CUSTOMER'].includes(rule.objectType)"
                    label="仓库范围"
                    ><el-select v-model="rule.warehouseMode" @change="clearFixed(rule, 'WAREHOUSE')"
                      ><el-option
                        v-for="m in allowedDimensionModes(rule, 'WAREHOUSE')"
                        :key="m.value"
                        :label="m.label"
                        :value="m.value" /></el-select
                    ><ScopeReferencePicker
                      v-if="rule.warehouseMode === 'SPECIFIED'"
                      v-model="rule.references.WAREHOUSE"
                      dimension="WAREHOUSE"
                  /></el-form-item>
                </div>
                <el-checkbox
                  v-if="
                    rule.scopeMode !== 'NONE' && rule.actionCode && rule.objectType !== 'INVENTORY'
                  "
                  v-model="rule.includeDescendants"
                  >包含部门、地区的下级</el-checkbox
                ><el-button link type="danger" @click="form.rules.splice(index, 1)"
                  >删除此规则</el-button
                >
              </section>
              <el-button :disabled="!unconfiguredActions.length" @click="addRule"
                >新增数据规则</el-button
              >
            </el-tab-pane></el-tabs
          ></template
        > </el-form
      ><template #footer
        ><el-button @click="visible = false">关闭</el-button
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
  supplySettingsApi,
  type LegacySupplyRole,
  type SupplyRole,
  type SupplyRoleImpact,
  type SupplyRoleCommand,
  type SupplyMenuNode,
  type ScopeRule,
  type ScopeDimension,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import ScopeReferencePicker from './ScopeReferencePicker.vue'
const legacyVisible = ref(false),
  legacyRoles = ref<LegacySupplyRole[]>([])
async function showLegacyRoles() {
  try {
    legacyRoles.value = await supplySettingsApi.legacyRoles()
    legacyVisible.value = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '旧角色读取失败')
  }
}
async function importLegacy(source: LegacySupplyRole) {
  try {
    const result = await ElMessageBox.prompt(
      `将复制 ${source.permissions.length} 个供应链功能，角色暂不启用。请填写供应链角色名称。`,
      '确认迁入',
      {
        inputValue: source.name,
        inputValidator: (v: string) =>
          (v.trim().length > 0 && v.length <= 128) || '名称需为1至128字',
      },
    )
    const role = await supplySettingsApi.importLegacyRole(source, result.value)
    await load()
    legacyVisible.value = false
    ElMessage.success('已迁入，请核对并配置数据范围')
    await edit(role)
  } catch (e) {
    if (e !== 'cancel' && e !== 'close')
      ElMessage.error(e instanceof Error ? e.message : '角色迁入失败')
  }
}
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
})
const form = reactive<SupplyRoleCommand>(empty())
const impactVisible = ref(false)
const disableImpact = ref<SupplyRoleImpact | null>(null)
const filtered = computed(() =>
  roles.value.filter((r) => (r.name + r.code).includes(keyword.value)),
)
type Menu = SupplyMenuNode & { children: Menu[]; disabled: boolean }
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
  return roots
})
const actions = computed(() =>
  menus.value
    .filter(
      (n) =>
        enabledMenuIds.value.has(n.id) &&
        form.menuNodeIds.includes(n.id) &&
        n.permissionCode &&
        /^(crm|hr|order|erp|bi|analytics):/.test(n.permissionCode),
    )
    .map((n) => ({ code: n.permissionCode!, name: actionPath(n) }))
    .filter((n, index, all) => all.findIndex((x) => x.code === n.code) === index),
)
const scopeModes = [
  { value: 'NONE', label: '不允许访问业务记录' },
  { value: 'SELF', label: '本人负责 / 本人归属' },
  { value: 'DEPARTMENT', label: '部门范围' },
  { value: 'REGION', label: '客户归属地区范围' },
  { value: 'WAREHOUSE', label: '仓库范围' },
  { value: 'ALL', label: '全部记录（仍受下方条件和用户上限限制）' },
]
const dimensionModes = [
  { value: 'NONE', label: '不额外限制' },
  { value: 'MEMBER', label: '分配角色时指定' },
  { value: 'SPECIFIED', label: '角色固定范围' },
  { value: 'ALL', label: '全部' },
]
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
  const codes = new Set(actions.value.map((action) => action.code))
  const removed = form.rules.filter((rule) => rule.actionCode && !codes.has(rule.actionCode)).length
  form.rules = form.rules.filter((rule) => !rule.actionCode || codes.has(rule.actionCode))
  if (removed) ElMessage.info(`已移除 ${removed} 条对应的数据规则；保存角色后生效`)
}
function actionPath(node: SupplyMenuNode) {
  const names = [node.name],
    seen = new Set([node.id])
  let parent = menus.value.find((n) => n.id === node.parentId)
  while (parent && !seen.has(parent.id)) {
    names.unshift(parent.name)
    seen.add(parent.id)
    parent = menus.value.find((n) => n.id === parent!.parentId)
  }
  return names.join(' / ')
}
const unconfiguredActions = computed(() =>
  actions.value.filter((action) => !form.rules.some((rule) => rule.actionCode === action.code)),
)
function availableActions(rule: ScopeRule) {
  return actions.value.filter(
    (action) =>
      action.code === rule.actionCode || !form.rules.some((r) => r.actionCode === action.code),
  )
}
function allowedDimensionModes(rule: ScopeRule, dimension: ScopeDimension) {
  const required =
    dimension === 'REGION'
      ? rule.objectType === 'CUSTOMER' || rule.scopeMode === 'REGION'
      : ['INVENTORY', 'FULFILLMENT'].includes(rule.objectType) || rule.scopeMode === 'WAREHOUSE'
  return dimensionModes.filter((mode) => !required || mode.value !== 'NONE')
}
function setScopeMode(rule: ScopeRule) {
  if (rule.scopeMode === 'DEPARTMENT' && rule.departmentMode === 'NONE')
    rule.departmentMode = 'CURRENT'
  if (rule.scopeMode === 'REGION' && rule.regionMode === 'NONE') rule.regionMode = 'MEMBER'
  if (rule.scopeMode === 'WAREHOUSE' && rule.warehouseMode === 'NONE') rule.warehouseMode = 'MEMBER'
}
function scopeHelp(rule: ScopeRule) {
  if (!rule.actionCode) return '先选择操作，再设置它允许访问的记录。'
  if (rule.scopeMode === 'NONE')
    return '此角色不为该操作提供业务记录范围；其他角色的授权仍可生效。菜单是否显示由功能权限决定。'
  if (rule.scopeMode === 'SELF')
    return rule.objectType === 'CUSTOMER'
      ? '本人负责：按客户负责关系判断，还需满足客户地区范围和用户地区上限。'
      : rule.objectType === 'EMPLOYEE'
        ? '只允许访问关联 HR 员工本人的记录。'
        : '按记录中的员工归属判断；历史订单使用保存的归属快照。'
  if (rule.scopeMode === 'DEPARTMENT')
    return '按部门筛选员工或订单归属；勾选包含下级后，同时覆盖下级部门。'
  if (rule.scopeMode === 'REGION') return '按客户归属地区筛选，不是收货地址，也不是员工所在部门。'
  if (rule.scopeMode === 'WAREHOUSE') return '按仓库筛选；订单选择仓库与确认出库是两项独立权限。'
  return '不按本人或部门归属筛选，但下方配置的范围以及用户地区、仓库上限仍然有效。'
}
function allowedScopeModes(rule: ScopeRule) {
  const options: Record<string, string[]> = {
    CUSTOMER: ['NONE', 'SELF', 'REGION', 'ALL'],
    INVENTORY: ['NONE', 'WAREHOUSE', 'ALL'],
    EMPLOYEE: ['NONE', 'SELF', 'DEPARTMENT', 'ALL'],
  }
  return scopeModes.filter(
    (m) => !options[rule.objectType] || options[rule.objectType].includes(m.value),
  )
}
function setObject(r: ScopeRule) {
  r.departmentMode = 'NONE'
  r.regionMode = 'NONE'
  r.warehouseMode = 'NONE'
  r.references = {}
  r.scopeMode = 'NONE'

  r.objectType = r.actionCode.startsWith('crm:')
    ? 'CUSTOMER'
    : r.actionCode.startsWith('hr:')
      ? 'EMPLOYEE'
      : r.actionCode.startsWith('erp:')
        ? 'INVENTORY'
        : r.actionCode.startsWith('bi:') || r.actionCode.startsWith('analytics:')
          ? 'ANALYTICS'
          : /outbound|stock-out/.test(r.actionCode)
            ? 'FULFILLMENT'
            : 'ORDER'
  if (r.objectType === 'CUSTOMER') r.regionMode = 'MEMBER'
  if (['INVENTORY', 'FULFILLMENT'].includes(r.objectType)) r.warehouseMode = 'MEMBER'
}
function clearFixed(r: ScopeRule, d: ScopeDimension) {
  const mode =
    d === 'DEPARTMENT' ? r.departmentMode : d === 'REGION' ? r.regionMode : r.warehouseMode
  if (mode !== 'SPECIFIED') delete r.references[d]
}
function addRule() {
  form.rules.push({
    id: null,
    actionCode: '',
    objectType: 'ORDER',
    scopeMode: 'NONE',
    departmentMode: 'NONE',
    regionMode: 'NONE',
    warehouseMode: 'NONE',
    includeDescendants: false,
    references: {},
  })
}
function validateRules(): string | null {
  const seen = new Set<string>()
  for (const rule of form.rules) {
    if (!rule.actionCode) return '请为每条数据规则选择操作，或删除空规则'
    if (!actions.value.some((a) => a.code === rule.actionCode))
      return '数据规则对应的功能未勾选，请核对菜单权限'
    if (seen.has(rule.actionCode)) return '同一操作只能配置一条规则'
    seen.add(rule.actionCode)
    if (rule.scopeMode === 'NONE') continue
    if (!allowedScopeModes(rule).some((mode) => mode.value === rule.scopeMode))
      return '该操作不支持当前数据范围'
    if (rule.scopeMode === 'DEPARTMENT' && rule.departmentMode === 'NONE') return '请选择部门范围'
    if (!allowedDimensionModes(rule, 'REGION').some((m) => m.value === rule.regionMode))
      return '请选择客户地区范围'
    if (!allowedDimensionModes(rule, 'WAREHOUSE').some((m) => m.value === rule.warehouseMode))
      return '请选择仓库范围'
    for (const d of ['DEPARTMENT', 'REGION', 'WAREHOUSE'] as const) {
      const mode =
        d === 'DEPARTMENT'
          ? rule.departmentMode
          : d === 'REGION'
            ? rule.regionMode
            : rule.warehouseMode
      if (mode === 'SPECIFIED' && !rule.references[d]?.length)
        return '请选择角色固定范围中的具体部门、地区或仓库'
    }
  }
  return null
}
async function save() {
  if (saving.value) return
  syncChecked()
  if (!form.name.trim() || !form.code.trim()) {
    ElMessage.warning('请输入角色名称和编码')
    return
  }
  const error = validateRules()
  if (error) {
    tab.value = 'scopes'
    ElMessage.warning(error)
    return
  }
  try {
    if (editingId.value) {
      const role = roles.value.find((r) => r.id === editingId.value)
      if (role?.status === 'ACTIVE' && form.status === 'DISABLED') {
        disableImpact.value = await supplyAccessApi.roleImpact(role.id)
        if (disableImpact.value.version !== form.version) {
          ElMessage.warning('角色已变化，请关闭并重新编辑后预览')
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
    if (e !== 'cancel' && e !== 'close')
      ElMessage.error(e instanceof Error ? e.message : '角色保存失败')
  }
}
async function persistRole() {
  if (impactVisible.value && !disableImpact.value?.canDisable) return
  try {
    saving.value = true
    await supplyAccessApi.saveRole(editingId.value, JSON.parse(JSON.stringify(form)))
    visible.value = false
    impactVisible.value = false
    await Promise.all([load(), access.refresh()])
    ElMessage.success('角色及授权已保存')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close')
      ElMessage.error(e instanceof Error ? e.message : '角色保存失败')
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
.scope-notice,
.scope-guide {
  margin-bottom: 16px;
}
.field-help {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}
.scope-guide p {
  margin: 8px 0;
}
.rule {
  padding: 18px;
  margin: 16px 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
