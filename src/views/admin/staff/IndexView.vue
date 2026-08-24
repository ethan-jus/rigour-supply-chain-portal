<template>
  <section class="management-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">系统管理 · 组织与人员</p>
        <h1>人员管理</h1>
      </div>
      <div class="page-actions">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="姓名、编码、手机号、账号"
          class="keyword-input"
          @keyup.enter="load"
        />
        <el-select v-model="filters.status" clearable placeholder="全部状态" class="status-select">
          <el-option label="在职" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
          <el-option label="离职" value="LEFT" />
        </el-select>
        <el-button :icon="Search" type="primary" :loading="loading" @click="load">查询</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="reset">重置</el-button>
        <el-button v-if="canWrite" type="primary" :icon="Plus" @click="open()">新增人员</el-button>
      </div>
    </header>

    <el-table v-loading="loading" :data="staff" row-key="id" class="management-table">
      <el-table-column type="index" label="序号" width="72" />
      <el-table-column prop="staffCode" label="员工编码" width="160" fixed="left" />
      <el-table-column prop="staffName" label="姓名" min-width="140" />
      <el-table-column prop="primaryOrganizationName" label="主组织" min-width="160">
        <template #default="scope">{{ scope.row.primaryOrganizationName || '未分配' }}</template>
      </el-table-column>
      <el-table-column prop="primaryPositionName" label="主岗位" min-width="150">
        <template #default="scope">{{ scope.row.primaryPositionName || '未分配' }}</template>
      </el-table-column>
      <el-table-column prop="mobile" label="手机号" min-width="140">
        <template #default="scope">{{ scope.row.mobile || '—' }}</template>
      </el-table-column>
      <el-table-column prop="username" label="绑定账号" min-width="150">
        <template #default="scope">
          {{ scope.row.userDisplayName || scope.row.username || '未绑定' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="scope">
          <el-tag :type="staffStatusTag(scope.row.employmentStatus)">
            {{ staffStatusLabel(scope.row.employmentStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" min-width="130">
        <template #default="scope">
          <el-tag :type="scope.row.recordOrigin === 'MANUAL' ? 'success' : 'info'">
            {{ originLabel(scope.row.recordOrigin) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="订货宝快照" min-width="220">
        <template #default="scope">
          <span v-if="scope.row.sourceStaffId">
            {{ scope.row.sourceAccountName || scope.row.sourceStaffId }}
            <small class="muted"> · {{ dhbStaffTypeLabel(scope.row.sourceStaffType) }}</small>
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="scope">
          <el-button v-if="canWrite" link type="primary" @click="open(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑人员' : '新增人员'" width="680px">
      <el-form label-width="104px">
        <el-form-item v-if="editingId" label="员工编码">
          <el-input v-model="form.staffCode" disabled />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="form.staffName" maxlength="128" />
        </el-form-item>
        <el-form-item label="主组织" required>
          <el-select v-model="form.primaryOrganizationId" filterable style="width: 100%">
            <el-option
              v-for="organization in activeOrganizations"
              :key="organization.id"
              :label="organizationLabel(organization)"
              :value="organization.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="主岗位" required>
          <el-select v-model="form.primaryPositionId" filterable style="width: 100%">
            <el-option
              v-for="position in activePositions"
              :key="position.id"
              :label="`${position.name}（${position.code}）`"
              :value="position.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定账号">
          <el-select v-model="form.userId" clearable filterable style="width: 100%">
            <el-option
              v-for="user in activeUsers"
              :key="user.id"
              :label="`${user.displayName}（${user.username}）`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.mobile" maxlength="32" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" maxlength="128" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.employmentStatus" style="width: 100%">
            <el-option label="在职" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
            <el-option label="离职" value="LEFT" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" maxlength="500" :rows="3" />
        </el-form-item>
        <section v-if="editingSource" class="source-snapshot">
          <strong>订货宝来源</strong>
          <dl>
            <div><dt>员工ID</dt><dd>{{ editingSource.sourceStaffId }}</dd></div>
            <div><dt>账号</dt><dd>{{ editingSource.sourceAccountName || '—' }}</dd></div>
            <div><dt>类型</dt><dd>{{ dhbStaffTypeLabel(editingSource.sourceStaffType) }}</dd></div>
            <div><dt>职位</dt><dd>{{ editingSource.sourceTitle || '—' }}</dd></div>
            <div><dt>部门</dt><dd>{{ editingSource.sourceBranchName || '—' }}</dd></div>
            <div><dt>角色</dt><dd>{{ editingSource.sourceRole || '—' }}</dd></div>
          </dl>
        </section>
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
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import type { OrganizationRecord, PositionRecord, StaffRecord, UserRecord } from '@/types/management'

const auth = useAuthStore()
const staff = ref<StaffRecord[]>([])
const organizations = ref<OrganizationRecord[]>([])
const positions = ref<PositionRecord[]>([])
const users = ref<UserRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref('')
const editingSource = ref<StaffRecord | null>(null)
const filters = reactive({ keyword: '', status: '' })
const form = reactive({
  staffCode: '',
  staffName: '',
  mobile: '',
  email: '',
  employmentStatus: 'ACTIVE',
  primaryOrganizationId: '',
  primaryPositionId: '',
  userId: '',
  remark: '',
  version: 0,
})

const canWrite = computed(() => auth.hasPermission('iam:staff:write'))
const activeOrganizations = computed(() => organizations.value.filter((item) => item.status === 'ACTIVE'))
const activePositions = computed(() => positions.value.filter((item) => item.status === 'ACTIVE'))
const activeUsers = computed(() => users.value.filter((item) => item.status === 'ACTIVE'))

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
    if (filters.status) params.set('status', filters.status)
    const staffPath = params.size > 0
      ? `/management/tenant/staff?${params.toString()}`
      : '/management/tenant/staff'
    ;[staff.value, organizations.value, positions.value, users.value] = await Promise.all([
      apiClient.get(staffPath) as Promise<StaffRecord[]>,
      apiClient.get('/management/tenant/organizations') as Promise<OrganizationRecord[]>,
      apiClient.get('/management/tenant/positions') as Promise<PositionRecord[]>,
      apiClient.get('/management/tenant/users') as Promise<UserRecord[]>,
    ])
  } finally {
    loading.value = false
  }
}

function reset() {
  filters.keyword = ''
  filters.status = ''
  void load()
}

function open(row?: StaffRecord) {
  editingId.value = row?.id || ''
  editingSource.value = row?.sourceStaffId ? row : null
  Object.assign(form, row
    ? {
        staffCode: row.staffCode,
        staffName: row.staffName,
        mobile: row.mobile || '',
        email: row.email || '',
        employmentStatus: row.employmentStatus,
        primaryOrganizationId: row.primaryOrganizationId || '',
        primaryPositionId: row.primaryPositionId || '',
        userId: row.userId || '',
        remark: row.remark || '',
        version: row.version,
      }
    : {
        staffCode: '',
        staffName: '',
        mobile: '',
        email: '',
        employmentStatus: 'ACTIVE',
        primaryOrganizationId: '',
        primaryPositionId: '',
        userId: '',
        remark: '',
        version: 0,
      })
  dialogVisible.value = true
}

async function save() {
  try {
    if (!form.staffName.trim()) throw new Error('请填写姓名')
    if (!form.primaryOrganizationId) throw new Error('请选择主组织')
    if (!form.primaryPositionId) throw new Error('请选择主岗位')
    saving.value = true
    const payload = {
      staffName: form.staffName.trim(),
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      employmentStatus: form.employmentStatus,
      primaryOrganizationId: form.primaryOrganizationId,
      primaryPositionId: form.primaryPositionId,
      userId: form.userId || null,
      remark: form.remark.trim() || null,
      version: form.version,
    }
    if (editingId.value) {
      await apiClient.put(`/management/tenant/staff/${editingId.value}`, payload)
    } else {
      await apiClient.post('/management/tenant/staff', payload)
    }
    ElMessage.success('人员已保存')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '人员保存失败')
  } finally {
    saving.value = false
  }
}

function organizationLabel(organization: OrganizationRecord) {
  return `${organization.name}（${organization.code}）`
}

function staffStatusLabel(status: string) {
  return { ACTIVE: '在职', DISABLED: '停用', LEFT: '离职' }[status] || status
}

function staffStatusTag(status: string) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'LEFT') return 'warning'
  return 'info'
}

function originLabel(origin: string) {
  return { MANUAL: '我方维护', DINGHUOBAO: '订货宝导入', IMPORT: '批量导入' }[origin] || origin
}

function dhbStaffTypeLabel(type: string | null) {
  if (!type) return '—'
  return {
    salesman: '业务员',
    boss: '老板',
    indoorwork: '内勤',
    driver: '司机',
  }[type] || type
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
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.keyword-input {
  width: 240px;
}

.status-select {
  width: 140px;
}

.management-table {
  border: 1px solid #e2e8f0;
}

.muted {
  color: #8a97a8;
}

.source-snapshot {
  margin-top: 12px;
  border-top: 1px solid #e5e7eb;
  padding-top: 14px;
}

.source-snapshot strong {
  display: block;
  margin-bottom: 10px;
  color: #111827;
}

.source-snapshot dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 0;
}

.source-snapshot div {
  min-width: 0;
}

.source-snapshot dt {
  color: #8a97a8;
  font-size: 12px;
}

.source-snapshot dd {
  margin: 4px 0 0;
  color: #1f2937;
  overflow-wrap: anywhere;
}
</style>
