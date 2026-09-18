<template>
  <el-drawer
    v-model="visible"
    title="负责客户"
    size="min(1080px,97vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!working"
    :show-close="!working"
  >
    <template v-if="member">
      <h2>{{ member.name }} · {{ member.username }}</h2>
      <p>
        关联员工：{{ member.employeeCode }}。这里读取 CRM
        当前主责关系；保存用户和分配角色不会修改客户主责。
      </p>
      <el-alert
        type="info"
        :closable="false"
        title="仅展示您有权查看或分配的客户。分配候选还受该用户已保存的客户地区上限约束；请先保存用户的员工关联及权限范围。"
      />
      <el-radio-group :disabled="working" :model-value="mode" class="mode" @change="changeMode">
        <el-radio-button value="OWNED">当前负责客户</el-radio-button>
        <el-radio-button v-if="canAssign" value="CANDIDATES">选择分配客户</el-radio-button>
      </el-radio-group>
      <el-form inline @submit.prevent="search">
        <el-form-item
          ><el-input v-model="keyword" :disabled="working" clearable placeholder="客户名称 / 编号"
        /></el-form-item>
        <el-form-item label="客户类型"
          ><el-select
            v-model="customerType"
            clearable
            filterable
            :disabled="working"
            style="width: 150px"
            ><el-option
              v-for="item in filters.customerTypes"
              :key="item.code"
              :value="item.code"
              :label="item.name" /></el-select
        ></el-form-item>
        <el-form-item label="归属地区"
          ><el-select
            v-model="regionCode"
            clearable
            filterable
            :disabled="working"
            style="width: 150px"
            ><el-option
              v-for="item in filters.regions"
              :key="item.code"
              :value="item.code"
              :label="item.name" /></el-select
        ></el-form-item>
        <el-form-item label="客户状态"
          ><el-select v-model="status" clearable :disabled="working" style="width: 120px"
            ><el-option
              v-for="item in filters.statuses"
              :key="item.code"
              :value="item.code"
              :label="item.name" /></el-select
        ></el-form-item>
        <el-button native-type="submit" :disabled="working" :loading="loading">查询</el-button>
      </el-form>
      <p v-if="canAssign" class="selection-summary">
        已勾选 {{ selected.length }} 个客户（跨页保留，最多 100
        个）。筛选仅改变列表，不改变勾选和主责。
        <el-button link :disabled="working || !selected.length" @click="clearSelection"
          >清空勾选</el-button
        >
      </p>
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
      <el-table
        ref="table"
        v-loading="loading"
        :data="rows"
        row-key="customerId"
        @selection-change="onSelection"
      >
        <el-table-column
          v-if="canAssign"
          type="selection"
          :selectable="() => !working"
          reserve-selection
          width="48"
        />
        <el-table-column prop="customerName" label="客户名称" min-width="180" />
        <el-table-column prop="customerCode" label="客户编号" min-width="100" />
        <el-table-column label="客户类型" min-width="100"
          ><template #default="{ row }">{{
            row.customerTypeName || row.customerType || '—'
          }}</template></el-table-column
        >
        <el-table-column label="归属地区" min-width="120"
          ><template #default="{ row }">{{
            row.regionName || row.regionCode || '未分配'
          }}</template></el-table-column
        >
        <el-table-column label="当前主责" min-width="140"
          ><template #default="{ row }">{{
            row.employeeName || row.employeeCode || '未分配'
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="100"
          ><template #default="{ row }">{{ statusName(row.status) }}</template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :disabled="working"
        :page-size="20"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load"
      />
      <template v-if="canAssign">
        <el-form label-position="top" class="reason-form"
          ><el-form-item label="主责变更原因" required
            ><el-input
              v-model="reason"
              :disabled="working"
              type="textarea"
              maxlength="500"
              show-word-limit /></el-form-item
        ></el-form>
        <el-alert
          v-if="mode === 'OWNED'"
          type="warning"
          :closable="false"
          title="解除后客户主责为空，新订单需补齐归属；历史订单归属保留。只解除明确勾选的客户。"
        />
      </template>
    </template>
    <template #footer>
      <el-button :disabled="working" @click="visible = false">关闭</el-button>
      <el-button
        v-if="canAssign"
        type="primary"
        :disabled="!selected.length || selected.length > 100 || loading || !!loadError"
        :loading="working"
        @click="previewChange"
        >{{ mode === 'OWNED' ? '预览解除主责' : '预览分配 / 移交' }}</el-button
      >
    </template>
  </el-drawer>
  <el-dialog
    v-model="previewVisible"
    title="客户主责变更预览"
    width="min(900px,96vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!working"
    :show-close="!working"
  >
    <template v-if="preview">
      <el-alert
        type="warning"
        :closable="false"
        :title="
          preview.operation === 'ASSIGN'
            ? '确认后，所选客户的主责将变更为该员工，并决定新订单默认归属。原有主责将被移交，历史订单归属保留。'
            : '确认后，所选客户将解除主责。历史订单归属保留，新订单须重新明确主责。'
        "
      />
      <p>
        目标员工：{{ preview.target.employeeName }} · 共 {{ preview.count }} 个客户。变更原因：{{
          previewReason
        }}
      </p>
      <el-table :data="preview.items" max-height="460">
        <el-table-column prop="customerName" label="客户" min-width="180" />
        <el-table-column label="归属地区" min-width="110"
          ><template #default="{ row }">{{
            row.regionName || row.regionCode || '未分配'
          }}</template></el-table-column
        >
        <el-table-column label="原主责" min-width="150"
          ><template #default="{ row }">{{
            row.oldEmployeeName || row.oldEmployeeCode || '未分配'
          }}</template></el-table-column
        >
        <el-table-column label="新主责" min-width="150"
          ><template #default="{ row }">{{
            row.newEmployeeName || row.newEmployeeCode || '未分配'
          }}</template></el-table-column
        >
      </el-table>
      <p>提交时会重新校验用户、授权范围和客户版本；任何冲突均不执行本批次。</p>
    </template>
    <template #footer
      ><el-button :disabled="working" @click="previewVisible = false">返回调整</el-button
      ><el-button type="primary" :loading="working" :disabled="!preview" @click="applyChange"
        >确认执行本批次</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import type { SupplyMember } from '@/api/core/supply-settings'
import {
  memberCustomerApi,
  type MemberCustomer,
  type MemberCustomerPreview,
  type MemberCustomerQuery,
  type MemberCustomerFilters,
} from '@/api/core/member-customer-responsibility'
const { can } = useSupplyPermissions()
const canAssign = computed(() => can('crm:customer:assign-owner'))
const visible = ref(false),
  loading = ref(false),
  working = ref(false),
  previewVisible = ref(false)
const member = ref<SupplyMember | null>(null),
  rows = ref<MemberCustomer[]>([]),
  selected = ref<MemberCustomer[]>([])
const mode = ref<MemberCustomerQuery['mode']>('OWNED'),
  keyword = ref(''),
  reason = ref(''),
  page = ref(1),
  total = ref(0),
  loadError = ref('')
const table = ref<{ clearSelection: () => void }>()
const preview = ref<MemberCustomerPreview | null>(null),
  previewReason = ref('')
const customerType = ref(''),
  regionCode = ref(''),
  status = ref('')
const filters = ref<MemberCustomerFilters>({ customerTypes: [], regions: [], statuses: [] })
let requestSequence = 0
const statusName = (status: string) =>
  (
    ({ ACTIVE: '启用', DISABLED: '禁用', INACTIVE: '停用', PENDING: '待审核' }) as Record<
      string,
      string
    >
  )[status] || status
function clearSelection() {
  table.value?.clearSelection()
  selected.value = []
  preview.value = null
}
function onSelection(value: MemberCustomer[]) {
  selected.value = value
  preview.value = null
}
async function open(value: SupplyMember) {
  if (working.value) {
    ElMessage.warning('请等待本次客户操作完成')
    return
  }
  member.value = value
  customerType.value = ''
  regionCode.value = ''
  status.value = ''
  filters.value = { customerTypes: [], regions: [], statuses: [] }
  mode.value = 'OWNED'
  keyword.value = ''
  reason.value = ''
  page.value = 1
  rows.value = []
  total.value = 0
  clearSelection()
  previewVisible.value = false
  visible.value = true
  await load()
}
async function changeMode(value: string | number | boolean | undefined) {
  const next = value === 'CANDIDATES' ? 'CANDIDATES' : 'OWNED'
  if (next === mode.value) return
  if (selected.value.length) {
    try {
      await ElMessageBox.confirm('切换列表会清空当前勾选，不会修改客户主责。继续？', '切换客户列表')
    } catch {
      return
    }
  }
  clearSelection()
  customerType.value = ''
  regionCode.value = ''
  status.value = ''
  mode.value = next
  page.value = 1
  await load()
}
async function search() {
  page.value = 1
  await load()
}
async function load() {
  if (!member.value) return
  const sequence = ++requestSequence
  const userId = member.value.id
  loading.value = true
  loadError.value = ''
  try {
    const result = await memberCustomerApi.list(userId, {
      mode: mode.value,
      ...(customerType.value ? { customerType: customerType.value } : {}),
      ...(regionCode.value ? { regionCode: regionCode.value } : {}),
      ...(status.value ? { status: status.value } : {}),
      keyword: keyword.value,
      page: page.value,
      size: 20,
    })
    if (sequence !== requestSequence) return
    rows.value = result.items
    total.value = result.total
    filters.value = result.filters ?? { customerTypes: [], regions: [], statuses: [] }
  } catch (e) {
    if (sequence !== requestSequence) return
    rows.value = []
    total.value = 0
    loadError.value = e instanceof Error ? e.message : '负责客户加载失败'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}
async function previewChange() {
  if (
    working.value ||
    !member.value ||
    !canAssign.value ||
    !selected.value.length ||
    selected.value.length > 100
  )
    return
  if (!reason.value.trim()) {
    ElMessage.warning('请填写主责变更原因')
    return
  }
  const userId = member.value.id
  const command = {
    operation: mode.value === 'OWNED' ? ('RELEASE' as const) : ('ASSIGN' as const),
    customers: selected.value.map((row) => ({
      customerId: row.customerId,
      revision: row.revision,
    })),
    reason: reason.value.trim(),
  }
  working.value = true
  preview.value = null
  try {
    const result = await memberCustomerApi.preview(userId, command)
    if (member.value?.id !== userId) return
    preview.value = result
    previewReason.value = command.reason
    previewVisible.value = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '变更预览失败')
  } finally {
    working.value = false
  }
}
async function applyChange() {
  if (!member.value || !preview.value || working.value) return
  working.value = true
  try {
    const result = await memberCustomerApi.apply(member.value.id, preview.value.previewToken)
    previewVisible.value = false
    clearSelection()
    reason.value = ''
    page.value = 1
    ElMessage.success(`已更新 ${result.affectedCount} 个客户主责，历史订单归属保留`)
    await load()
  } catch (e) {
    preview.value = null
    ElMessage.error(e instanceof Error ? e.message : '变更失败，请重新生成预览')
  } finally {
    working.value = false
  }
}
defineExpose({ open })
</script>
<style scoped>
.mode,
.el-pagination,
.reason-form {
  margin: 20px 0;
}
p {
  color: #64748b;
  line-height: 1.6;
}
.selection-summary {
  color: #334155;
}
</style>
