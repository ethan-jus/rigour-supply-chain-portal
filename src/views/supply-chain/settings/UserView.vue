<template>
  <div class="supply-page">
    <header class="heading">
      <div>
        <SupplyPageTitle>用户管理</SupplyPageTitle>
        <p>普通业务用户关联 HR 员工，并配置供应链角色和适用范围。</p>
      </div>
      <div>
        <el-button
          v-if="access.can('supply:user:assign-role')"
          :disabled="!selected.length"
          @click="openBatch"
          >批量设置角色</el-button
        ><el-button v-if="access.can('supply:user:create')" type="primary" @click="edit()"
          >新增用户</el-button
        >
      </div>
    </header>
    <div class="user-directory-layout">
      <DepartmentSidebar
        :departments="departmentChoices"
        :model-value="departmentId"
        @update:model-value="selectDepartment"
      />
      <section class="user-results">
        <el-alert v-if="directoryError" :title="directoryError" type="error" :closable="false" />
        <el-form inline @submit.prevent="search"
          ><el-form-item
            ><el-input
              v-model="keyword"
              clearable
              placeholder="登录账号 / 员工编码"
              style="width: 280px" /></el-form-item
          ><el-button type="primary" native-type="submit">查询</el-button></el-form
        >
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="id"
          @selection-change="selected = $event"
          ><el-table-column type="selection" width="48" :selectable="selectable" /><el-table-column
            prop="username"
            label="登录账号"
            min-width="150"
          /><el-table-column prop="name" label="员工姓名" min-width="120" /><el-table-column
            label="部门 / 岗位"
            min-width="200"
            ><template #default="{ row }"
              >{{ row.employee?.departmentName || '—' }} /
              {{ row.employee?.positionName || '—' }}</template
            ></el-table-column
          ><el-table-column label="角色" min-width="200"
            ><template #default="{ row }"
              ><el-tag v-for="r in row.roles" :key="r.roleId" style="margin: 2px">{{
                roleName(r.roleId)
              }}</el-tag></template
            ></el-table-column
          ><el-table-column label="账号状态" min-width="220"
            ><template #default="{ row }"
              ><el-tag :type="row.usable ? 'success' : 'info'">{{
                row.kind === 'PROTECTED' ? '受保护账号' : row.status === 'ACTIVE' ? '启用' : '禁用'
              }}</el-tag>
              <div v-if="row.unavailableReason" class="reason">
                {{ row.unavailableReason }}
              </div></template
            ></el-table-column
          >
          <el-table-column label="创建人" min-width="130"
            ><template #default="{ row }">{{
              row.createdByName || '未记录'
            }}</template></el-table-column
          >
          <el-table-column label="创建时间" width="185"
            ><template #default="{ row }">{{
              displayDateTime(row.createdTime)
            }}</template></el-table-column
          >
          <el-table-column label="修改人" min-width="130"
            ><template #default="{ row }">{{
              row.updatedByName || '未记录'
            }}</template></el-table-column
          >
          <el-table-column label="修改时间" width="185"
            ><template #default="{ row }">{{
              displayDateTime(row.updatedTime)
            }}</template></el-table-column
          >
          <!-- @vue-generic {SupplyMember} -->
          <el-table-column label="操作" width="340" fixed="right"
            ><template #default="{ row }"
              ><el-button
                v-if="access.can('supply:role:grant')"
                link
                type="primary"
                @click="previewPermissions(row.id)"
                >权限预览</el-button
              ><el-button
                v-if="
                  row.employeeCode &&
                  (crmCan('crm:customer:read') || crmCan('crm:customer:assign-owner'))
                "
                link
                type="primary"
                @click="customersDrawer?.open(row)"
                >负责客户</el-button
              ><template v-if="row.kind !== 'PROTECTED'"
                ><el-button
                  v-if="access.can('supply:user:update')"
                  link
                  type="primary"
                  @click="edit(row)"
                  >编辑</el-button
                ><el-button
                  v-if="access.can('supply:user:disable')"
                  :disabled="
                    isSelf(row.id) ||
                    (row.status !== 'ACTIVE' && !access.can('supply:user:assign-role'))
                  "
                  :title="
                    isSelf(row.id)
                      ? '不能禁用当前登录用户'
                      : row.status !== 'ACTIVE' && !access.can('supply:user:assign-role')
                        ? '重新启用需具备分配角色权限'
                        : undefined
                  "
                  link
                  @click="toggle(row)"
                  >{{ row.status === 'ACTIVE' ? '禁用' : '启用' }}</el-button
                ><el-button
                  v-if="access.can('supply:user:reset-password')"
                  link
                  @click="password(row)"
                  >重置密码</el-button
                ><el-button
                  v-if="access.can('supply:user:delete')"
                  :disabled="isSelf(row.id)"
                  :title="isSelf(row.id) ? '不能删除当前登录用户' : undefined"
                  link
                  type="danger"
                  @click="remove(row)"
                  >删除</el-button
                ></template
              ></template
            ></el-table-column
          > </el-table
        ><el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total,sizes,prev,pager,next"
          @change="load"
          style="margin-top: 20px"
        />
      </section>
    </div>
    <el-dialog v-model="previewVisible" title="供应链权限预览" width="min(900px,96vw)">
      <template v-if="permissionPreview">
        <p>
          {{ permissionPreview.username }} · 应用版本 {{ permissionPreview.applicationVersion }}
        </p>
        <el-alert
          title="这里展示已保存的新配置；准备阶段仍执行旧授权。数据范围由各业务接口结合实际记录校验。"
          type="info"
          :closable="false"
        />
        <el-alert
          v-if="permissionPreview.unavailableReason"
          :title="permissionPreview.unavailableReason"
          type="warning"
          :closable="false"
        />
        <p>新增权限标识：{{ permissionPreview.added.join('、') || '无' }}</p>
        <p>移除权限标识：{{ permissionPreview.removed.join('、') || '无' }}</p>
        <el-select
          :model-value="permissionPreview.selectedAction"
          style="width: 100%"
          filterable
          placeholder="选择操作查看完整数据范围"
          @change="(action) => previewPermissions(permissionPreview!.userId, String(action))"
        >
          <el-option
            v-for="action in permissionPreview.proposedPermissions"
            :key="action"
            :value="action"
            :label="action"
          />
        </el-select>
        <template v-if="permissionPreview.policy">
          <p>
            关联员工：{{ permissionPreview.policy.employeeCode || '受保护账号' }} · 功能授权：{{
              permissionPreview.policy.functionAllowed ? '允许' : '拒绝'
            }}
          </p>
          <p>
            个人地区上限：{{ formatLimit(permissionPreview.policy.regionLimit) }}；仓库上限：{{
              formatLimit(permissionPreview.policy.warehouseLimit)
            }}
          </p>
          <el-table :data="permissionPreview.policy.clauses">
            <el-table-column label="角色"
              ><template #default="{ row }">{{ roleName(row.roleId) }}</template></el-table-column
            >
            <el-table-column prop="objectType" label="数据对象" />
            <el-table-column label="范围"
              ><template #default="{ row }">{{
                scopeName(row.scopeMode)
              }}</template></el-table-column
            >
            <el-table-column label="部门"
              ><template #default="{ row }">{{
                formatLimit(row.departments)
              }}</template></el-table-column
            >
            <el-table-column label="客户地区"
              ><template #default="{ row }">{{
                formatLimit(row.regions)
              }}</template></el-table-column
            >
            <el-table-column label="仓库"
              ><template #default="{ row }">{{
                formatLimit(row.warehouses)
              }}</template></el-table-column
            >
          </el-table>
          <p>
            每行内部条件同时满足；满足任一完整角色行后，再受个人地区和仓库上限限制。没有数据范围行时，不授予业务数据。
          </p>
        </template>
      </template>
    </el-dialog>
    <el-drawer
      v-model="visible"
      :title="editingId ? '编辑供应链用户' : '新增供应链用户'"
      size="min(760px,96vw)"
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <template v-if="!editingId"
          ><el-form-item label="登录账号来源"
            ><el-radio-group v-model="accountMode"
              ><el-radio value="NEW">新建登录账号</el-radio
              ><el-radio value="EXISTING">使用已有登录账号</el-radio></el-radio-group
            ></el-form-item
          ><template v-if="accountMode === 'NEW'"
            ><el-form-item label="登录账号" required
              ><el-input v-model="form.username" autocomplete="off" maxlength="64" /></el-form-item
            ><el-form-item label="初始密码" required
              ><el-input
                v-model="form.initialPassword"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="14 至 128 位" /></el-form-item></template
          ><el-form-item v-else label="已有登录账号" required
            ><el-select
              v-model="form.existingUserId"
              filterable
              remote
              :remote-method="searchAccounts"
              :loading="accountLoading"
              style="width: 100%"
              ><el-option
                v-for="a in accounts"
                :key="a.id"
                :label="a.username"
                :value="a.id" /></el-select></el-form-item
        ></template>
        <el-form-item v-else label="登录账号"
          ><el-input :model-value="form.username" disabled
        /></el-form-item>
        <el-form-item label="关联员工" required
          ><el-select
            v-model="form.employeeCode"
            filterable
            remote
            :remote-method="searchEmployees"
            :loading="employeeLoading"
            :disabled="!!editingId && !access.can('supply:user:rebind')"
            style="width: 100%"
            placeholder="按姓名或编码搜索已维护的员工"
            ><el-option
              v-for="e in candidates"
              :key="e.employeeCode"
              :value="e.employeeCode"
              :label="
                e.employeeName + ' · ' + e.employeeCode + ' · ' + (e.departmentName || '未登记部门')
              "
              :disabled="!e.usable"
              ><div>
                {{ e.employeeName }} · {{ e.employeeCode
                }}<small v-if="!e.usable">（{{ e.unavailableReason }}）</small>
              </div></el-option
            ></el-select
          ></el-form-item
        >
        <el-descriptions :column="2" border
          ><el-descriptions-item label="真实姓名">{{
            employee?.employeeName || '—'
          }}</el-descriptions-item
          ><el-descriptions-item label="所属部门">{{
            employee?.departmentName || '—'
          }}</el-descriptions-item
          ><el-descriptions-item label="岗位">{{
            employee?.positionName || '—'
          }}</el-descriptions-item
          ><el-descriptions-item label="来源">HR 员工档案</el-descriptions-item></el-descriptions
        >
        <el-form-item
          v-if="editingId && access.can('supply:user:rebind')"
          label="关联更正 / 重新核验原因"
          ><el-input
            v-model="form.bindingReason"
            maxlength="500"
            placeholder="更换员工或离职后重新开通时必填"
        /></el-form-item>
        <el-form-item label="供应链角色" required
          ><RoleAssignmentEditor
            v-model="form.roles"
            :roles="roles"
            :disabled="!access.can('supply:user:assign-role')"
        /></el-form-item>
        <el-form-item label="客户地区适用上限"
          ><el-radio-group
            v-model="form.regionLimit.mode"
            :disabled="!access.can('supply:user:assign-role')"
            @change="form.regionLimit.references = []"
            ><el-radio value="NONE">无</el-radio><el-radio value="SPECIFIED">指定地区</el-radio
            ><el-radio value="ALL">全部地区</el-radio></el-radio-group
          ><ScopeReferencePicker
            v-if="form.regionLimit.mode === 'SPECIFIED'"
            v-model="form.regionLimit.references"
            dimension="REGION"
            :disabled="!access.can('supply:user:assign-role')"
        /></el-form-item>
        <el-form-item label="仓库适用上限"
          ><el-radio-group
            v-model="form.warehouseLimit.mode"
            :disabled="!access.can('supply:user:assign-role')"
            @change="form.warehouseLimit.references = []"
            ><el-radio value="NONE">无</el-radio><el-radio value="SPECIFIED">指定仓库</el-radio
            ><el-radio value="ALL">全部仓库</el-radio></el-radio-group
          ><ScopeReferencePicker
            v-if="form.warehouseLimit.mode === 'SPECIFIED'"
            v-model="form.warehouseLimit.references"
            dimension="WAREHOUSE"
            :disabled="!access.can('supply:user:assign-role')"
        /></el-form-item>
        <el-form-item label="供应链账号状态"
          ><el-radio-group
            v-model="form.status"
            :disabled="!!editingId && (isSelf(editingId) || !access.can('supply:user:disable'))"
            ><el-radio
              value="ACTIVE"
              :disabled="
                !!editingId &&
                editingOriginalStatus !== 'ACTIVE' &&
                !access.can('supply:user:assign-role')
                  ? true
                  : undefined
              "
              >启用</el-radio
            ><el-radio value="DISABLED">禁用</el-radio></el-radio-group
          ></el-form-item
        ><el-form-item label="备注"
          ><el-input v-model="form.remark" maxlength="500" type="textarea"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save">保存用户</el-button></template
      >
    </el-drawer>
    <el-drawer v-model="batchVisible" title="批量设置供应链角色" size="min(700px,95vw)"
      ><p>已选择 {{ selected.length }} 人。本批次全部成功，或全部回滚。</p>
      <el-radio-group v-model="batchMode"
        ><el-radio value="APPEND">追加角色</el-radio><el-radio value="REMOVE">移除角色</el-radio
        ><el-radio value="REPLACE">替换全部角色</el-radio></el-radio-group
      ><RoleAssignmentEditor
        v-model="batchRoles"
        :roles="roles"
        :remove-only="batchMode === 'REMOVE'"
      /><template #footer
        ><el-button @click="batchVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="applyBatch"
          >预览并确认</el-button
        ></template
      ></el-drawer
    >
    <MemberCustomersDrawer ref="customersDrawer" />
  </div>
</template>
<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import DepartmentSidebar from '@/components/supply/DepartmentSidebar.vue'
import type { ScopeReference } from '@/api/core/supply-settings'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  supplyAccessApi,
  supplySettingsApi,
  type SupplyPermissionPreview,
  type SupplyMember,
  type SupplyMemberCommand,
  type SupplyRole,
  type SupplyEmployee,
  type RoleAssignment,
  type BatchRoleCommand,
} from '@/api/core/supply-settings'
import { useAuthStore } from '@/stores/auth'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import ScopeReferencePicker from './ScopeReferencePicker.vue'
import RoleAssignmentEditor from './RoleAssignmentEditor.vue'
import MemberCustomersDrawer from './MemberCustomersDrawer.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const { can: crmCan } = useSupplyPermissions()
const customersDrawer = ref<InstanceType<typeof MemberCustomersDrawer>>()
const auth = useAuthStore()
const isSelf = (id: string) => auth.user?.id === id
const departmentId = ref<number | null>(null),
  departments = ref<ScopeReference[]>([]),
  directoryError = ref('')
const departmentChoices = computed(() =>
  departments.value.map((d) => ({
    id: Number(d.key),
    parentId: d.parentKey ? Number(d.parentKey) : null,
    label: d.name,
  })),
)
function selectDepartment(id: number | null) {
  departmentId.value = id
  selected.value = []
  search()
}
let listRequest = 0
const permissionPreview = ref<SupplyPermissionPreview | null>(null),
  previewVisible = ref(false)
async function previewPermissions(userId: string, action?: string) {
  try {
    permissionPreview.value = await supplySettingsApi.permissionPreview(userId, action)
    previewVisible.value = true
  } catch (e) {
    error(e, '权限预览失败')
  }
}
const scopeName = (mode: string) =>
  ({
    SELF: '本人',
    DEPARTMENT: '部门',
    REGION: '客户地区',
    WAREHOUSE: '仓库',
    ALL: '全部',
    NONE: '无数据',
  })[mode] || mode
const formatLimit = (limit: { mode: string; references: string[] }) =>
  limit.mode === 'ALL' ? '全部' : limit.mode === 'NONE' ? '无' : limit.references.join('、')
const access = useSupplyAuthorizationStore(),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  keyword = ref(''),
  page = ref(1),
  size = ref(20),
  total = ref(0),
  editingId = ref<string | null>(null)
const rows = ref<SupplyMember[]>([]),
  selected = ref<SupplyMember[]>([]),
  roles = ref<SupplyRole[]>([]),
  candidates = ref<SupplyEmployee[]>([]),
  accounts = ref<{ id: string; username: string; status: string }[]>([]),
  employeeLoading = ref(false),
  accountLoading = ref(false),
  accountMode = ref<'NEW' | 'EXISTING'>('NEW')
const editingOriginalStatus = ref('ACTIVE')
const batchVisible = ref(false),
  batchMode = ref<BatchRoleCommand['mode']>('APPEND'),
  batchRoles = ref<RoleAssignment[]>([])
const empty = (): SupplyMemberCommand => ({
  existingUserId: null,
  username: '',
  initialPassword: null,
  employeeCode: '',
  status: 'ACTIVE',
  remark: null,
  version: 0,
  roles: [],
  regionLimit: { mode: 'NONE', references: [] },
  warehouseLimit: { mode: 'NONE', references: [] },
  bindingReason: null,
})
const form = reactive<SupplyMemberCommand>(empty()),
  employee = computed(() => candidates.value.find((e) => e.employeeCode === form.employeeCode))
function selectable(row: SupplyMember) {
  return row.kind !== 'PROTECTED'
}
function roleName(id: string) {
  return roles.value.find((r) => r.id === id)?.name ?? '恢复管理角色'
}
function search() {
  page.value = 1
  void load()
}
async function load() {
  const request = ++listRequest
  loading.value = true
  try {
    const data = await supplyAccessApi.members(
      keyword.value,
      page.value,
      size.value,
      departmentId.value ?? undefined,
    )
    if (request !== listRequest) return
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    if (request === listRequest) {
      rows.value = []
      total.value = 0
      error(e, '用户加载失败')
    }
  } finally {
    if (request === listRequest) loading.value = false
  }
}
async function searchEmployees(keyword: string) {
  employeeLoading.value = true
  try {
    const data = await supplyAccessApi.employees(keyword)
    const current = candidates.value.find((e) => e.employeeCode === form.employeeCode)
    candidates.value = data.items
    if (current && !candidates.value.some((e) => e.employeeCode === current.employeeCode))
      candidates.value.unshift(current)
  } catch (e) {
    error(e, '员工检索失败')
  } finally {
    employeeLoading.value = false
  }
}
async function searchAccounts(keyword: string) {
  accountLoading.value = true
  try {
    accounts.value = await supplyAccessApi.accounts(keyword)
  } catch (e) {
    error(e, '账号检索失败')
  } finally {
    accountLoading.value = false
  }
}
async function edit(row?: SupplyMember) {
  Object.assign(form, empty())
  editingId.value = row?.id ?? null
  editingOriginalStatus.value = row?.status ?? 'ACTIVE'
  accountMode.value = 'NEW'
  candidates.value = row?.employee ? [row.employee] : []
  if (row)
    Object.assign(
      form,
      JSON.parse(
        JSON.stringify({
          username: row.username,
          employeeCode: row.employeeCode,
          status: row.status,
          remark: row.remark,
          version: row.version,
          roles: row.roles,
          regionLimit: row.regionLimit,
          warehouseLimit: row.warehouseLimit,
        }),
      ),
    )
  visible.value = true
  if (!row) await Promise.all([searchEmployees(''), searchAccounts('')])
}
async function save() {
  if (!form.employeeCode || !form.roles.length) {
    ElMessage.warning('请选择关联员工和角色')
    return
  }
  if (!editingId.value && accountMode.value === 'EXISTING' && !form.existingUserId) {
    ElMessage.warning('请选择已有登录账号')
    return
  }
  saving.value = true
  try {
    const data = JSON.parse(JSON.stringify(form)) as SupplyMemberCommand
    if (accountMode.value === 'NEW') data.existingUserId = null
    else data.initialPassword = null
    await supplyAccessApi.saveMember(editingId.value, data)
    visible.value = false
    await Promise.all([load(), access.refresh()])
    ElMessage.success('供应链用户已保存')
  } catch (e) {
    error(e, '保存失败')
  } finally {
    saving.value = false
  }
}
async function toggle(row: SupplyMember) {
  if (row.status !== 'ACTIVE' && !access.can('supply:user:assign-role')) {
    ElMessage.warning('重新启用需具备分配角色权限')
    return
  }
  if (isSelf(row.id)) {
    ElMessage.warning('不能禁用当前登录用户')
    return
  }
  try {
    const status = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    await ElMessageBox.confirm(
      `${status === 'ACTIVE' ? '启用' : '禁用'}“${row.name}”的供应链账号？`,
      '变更供应链资格',
      { type: 'warning' },
    )
    await supplyAccessApi.memberStatus(row.id, status, row.version)
    await load()
  } catch (e) {
    error(e, '状态变更失败')
  }
}
async function remove(row: SupplyMember) {
  if (isSelf(row.id)) {
    ElMessage.warning('不能删除当前登录用户')
    return
  }
  try {
    await ElMessageBox.confirm(
      `删除“${row.name}”的供应链资格和角色分配？历史业务和统一登录账号会保留。`,
      '删除用户',
      { type: 'warning' },
    )
    await supplyAccessApi.deleteMember(row.id, row.version)
    await load()
  } catch (e) {
    error(e, '删除失败')
  }
}
async function password(row: SupplyMember) {
  try {
    const result = await ElMessageBox.prompt(
      '此操作重置统一登录密码，并使原有会话失效。请输入 14 至 128 位新密码。',
      `重置 ${row.username} 的密码`,
      {
        inputType: 'password',
        inputValidator: (value) =>
          (!!value && value.length >= 14 && value.length <= 128) || '密码长度需为 14 至 128 位',
      },
    )
    await supplyAccessApi.resetPassword(row.id, result.value, row.version)
    await load()
    ElMessage.success('密码已重置')
  } catch (e) {
    error(e, '密码重置失败')
  }
}
function openBatch() {
  batchMode.value = 'APPEND'
  batchRoles.value = []
  batchVisible.value = true
}
async function applyBatch() {
  saving.value = true
  try {
    const command: BatchRoleCommand = {
      mode: batchMode.value,
      members: selected.value.map((r) => ({ id: r.id, version: r.version })),
      roles: JSON.parse(JSON.stringify(batchRoles.value)),
      applicationVersion: 0,
    }
    const preview = await supplyAccessApi.previewBatch(command)
    await ElMessageBox.confirm(
      `确认对 ${preview.members.length} 人${{ APPEND: '追加', REMOVE: '移除', REPLACE: '替换' }[command.mode]} ${preview.roleCount} 个角色？`,
      '批量授权预览',
      { type: 'warning' },
    )
    await supplyAccessApi.assignBatch({
      ...command,
      applicationVersion: preview.applicationVersion,
    })
    batchVisible.value = false
    await Promise.all([load(), access.refresh()])
    ElMessage.success('批量角色设置已完成')
  } catch (e) {
    error(e, '批量设置失败')
  } finally {
    saving.value = false
  }
}
function error(e: unknown, fallback: string) {
  if (e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : fallback)
}
onMounted(async () => {
  await Promise.all([
    load(),
    supplyAccessApi
      .references('DEPARTMENT')
      .then((data) => {
        departments.value = data
      })
      .catch((e) => {
        directoryError.value = e instanceof Error ? e.message : '部门树加载失败'
      }),
    supplyAccessApi
      .memberRoles()
      .then((data) => {
        roles.value = data
      })
      .catch((e) => error(e, '角色目录加载失败')),
  ])
})
</script>
<style scoped>
.user-directory-layout {
  display: flex;
  gap: 18px;
  min-width: 0;
}
.user-results {
  flex: 1;
  min-width: 0;
  padding: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
@media (max-width: 900px) {
  .user-directory-layout {
    flex-direction: column;
  }
}

.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.heading p,
.reason {
  color: #64748b;
}
.reason {
  font-size: 12px;
  margin-top: 6px;
}
:deep(.el-form-item__content) {
  gap: 8px;
}
:deep(.el-descriptions) {
  margin-bottom: 18px;
}
</style>
