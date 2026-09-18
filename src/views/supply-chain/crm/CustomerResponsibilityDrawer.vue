<template>
  <el-drawer v-model="visible" title="客户归属管理" size="min(1020px, 96vw)" destroy-on-close>
    <section v-loading="loading" v-if="state">
      <h2>{{ state.customerName }}</h2>
      <el-alert
        title="客户主责决定新订单归属。修改后，已确认订单的历史归属保留。主责为空时，新订单需要补齐归属后才能提交。"
        type="info"
        :closable="false"
      />
      <el-tabs
        ><el-tab-pane label="调整归属">
          <el-descriptions :column="2" border
            ><el-descriptions-item label="当前主责">{{
              state.employeeName || state.employeeCode || '未分配'
            }}</el-descriptions-item
            ><el-descriptions-item label="当前地区">{{
              areaName(state.regionCode)
            }}</el-descriptions-item></el-descriptions
          >
          <el-form label-width="100px" class="change-form"
            ><el-form-item label="新的主责"
              ><el-select
                v-model="employee"
                clearable
                filterable
                remote
                :remote-method="searchEmployees"
                placeholder="搜索员工姓名或编码（最多显示50人）"
                style="width: 100%"
                ><el-option
                  v-for="person in employees"
                  :key="person.code"
                  :value="person.code"
                  :label="`${person.name} · ${person.code}${person.departmentName ? ' · ' + person.departmentName : ''}`" /></el-select
            ></el-form-item>
            <el-form-item label="归属地区" required
              ><el-tree-select
                v-model="region"
                :data="areaTree"
                node-key="value"
                check-strictly
                filterable
                placeholder="选择客户业务归属地区"
                style="width: 100%"
            /></el-form-item>
            <el-form-item label="变更原因" required
              ><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit
            /></el-form-item>
            <el-form-item
              ><el-button type="primary" :loading="saving" @click="save"
                >保存归属调整</el-button
              ></el-form-item
            ></el-form
          > </el-tab-pane
        ><el-tab-pane :label="`待处理来源差异（${state.pendingCount}）`">
          <el-alert
            title="采用本次来源只确认当前这条差异，后续同步仍需核对。无法核验的员工或地区需要先修正映射。"
            type="info"
            :closable="false"
          />
          <el-table :data="state.conflicts" border
            ><el-table-column prop="source" label="来源" width="120" /><el-table-column
              prop="proposedEmployee"
              label="来源主责编码"
              min-width="150"
            /><el-table-column label="来源地区" min-width="150"
              ><template #default="{ row }">{{
                areaName(row.proposedRegion)
              }}</template></el-table-column
            ><el-table-column label="操作" width="250"
              ><template #default="{ row }"
                ><el-button link :disabled="saving" @click="resolve(String(row.id), 'KEEP_LOCAL')"
                  >保留当前归属</el-button
                ><el-button
                  link
                  type="primary"
                  :disabled="saving"
                  @click="resolve(String(row.id), 'USE_SOURCE')"
                  >采用本次来源</el-button
                ></template
              ></el-table-column
            ></el-table
          >
          <p v-if="state.pendingCount > state.conflicts.length">
            本页展示最近100条，处理后继续加载。
          </p> </el-tab-pane
        ><el-tab-pane :label="`归属历史（${state.historyTotal}）`">
          <p>显示最近100条调整记录</p>
          <el-table :data="state.history" border
            ><el-table-column label="时间" width="170"
              ><template #default="{ row }">{{
                displayDateTime(row.occurredAt)
              }}</template></el-table-column
            ><el-table-column label="主责变化" min-width="180"
              ><template #default="{ row }"
                >{{ row.oldName || row.oldEmployee || '未分配' }} →
                {{ row.newName || row.newEmployee || '未分配' }}</template
              ></el-table-column
            ><el-table-column label="地区变化" min-width="180"
              ><template #default="{ row }"
                >{{ areaName(row.oldRegion) }} → {{ areaName(row.newRegion) }}</template
              ></el-table-column
            ><el-table-column
              prop="reason"
              label="原因"
              min-width="220"
              show-overflow-tooltip /><el-table-column
              prop="actor"
              label="操作人"
              min-width="170"
              show-overflow-tooltip
          /></el-table> </el-tab-pane
      ></el-tabs>
    </section>
  </el-drawer>
</template>
<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  customerResponsibility,
  responsibilityEmployees,
  transferCustomer,
  resolveResponsibility,
  type ResponsibilityOverview,
  type ResponsibilityEmployee,
} from '@/api/core/customer-responsibility'
import { getAllCrmCustomerAreas, type CrmDictionaryView } from '@/api/core/crm'
const emit = defineEmits<{ changed: [] }>()
const visible = ref(false),
  loading = ref(false),
  saving = ref(false),
  state = ref<ResponsibilityOverview | null>(null),
  employees = ref<ResponsibilityEmployee[]>([]),
  areas = ref<CrmDictionaryView[]>([]),
  employee = ref(''),
  region = ref(''),
  reason = ref('')
type AreaNode = { value: string; label: string; disabled: boolean; children: AreaNode[] }
const areaTree = computed(() => {
  const map = new Map(
    areas.value.map((a) => [
      a.code,
      { value: a.code, label: a.name, disabled: a.status !== 'ACTIVE', children: [] } as AreaNode,
    ]),
  )
  const roots: AreaNode[] = []
  for (const a of areas.value) {
    const node = map.get(a.code)!
    const parent = a.parentCode ? map.get(a.parentCode) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
function areaName(code: string | null) {
  return code ? areas.value.find((a) => a.code === code)?.name || code : '未分配'
}
function apply(value: ResponsibilityOverview) {
  state.value = value
  employee.value = value.employeeCode || ''
  region.value = value.regionCode || ''
  reason.value = ''
  if (value.employeeCode && !employees.value.some((e) => e.code === value.employeeCode))
    employees.value.unshift({
      code: value.employeeCode,
      name: value.employeeName || value.employeeCode,
      departmentName: null,
    })
}
async function searchEmployees(keyword: string) {
  employees.value = await responsibilityEmployees(keyword)
}
async function open(id: string) {
  visible.value = true
  loading.value = true
  state.value = null
  try {
    const [record, directory] = await Promise.all([
      customerResponsibility(id),
      getAllCrmCustomerAreas(),
      searchEmployees(''),
    ])
    areas.value = directory
    apply(record)
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!state.value) return
  if (!region.value || !reason.value.trim()) {
    ElMessage.warning('请选择地区并填写变更原因')
    return
  }
  saving.value = true
  try {
    apply(
      await transferCustomer(state.value.customerId, {
        employeeCode: employee.value || null,
        regionCode: region.value,
        revision: state.value.revision,
        reason: reason.value.trim(),
      }),
    )
    emit('changed')
    ElMessage.success('客户归属已更新，历史订单归属保留')
  } finally {
    saving.value = false
  }
}
async function resolve(conflictId: string, decision: 'KEEP_LOCAL' | 'USE_SOURCE') {
  if (!state.value) return
  const conflict = state.value.conflicts.find((c) => String(c.id) === conflictId)
  if (!conflict) return
  let note: string
  try {
    const result = await ElMessageBox.prompt(
      decision === 'USE_SOURCE'
        ? `确认采用来源主责 ${conflict.proposedEmployee || '未分配'}、地区 ${areaName(conflict.proposedRegion)}，请填写原因。`
        : '确认保留当前客户归属，请填写原因。',
      '处理来源差异',
      { inputValidator: (v) => (!!v?.trim() && v.length <= 500) || '请填写1至500字原因' },
    )
    note = result.value
  } catch {
    return
  }
  saving.value = true
  try {
    apply(
      await resolveResponsibility(
        state.value.customerId,
        conflict.id,
        decision,
        state.value.revision,
        note,
      ),
    )
    emit('changed')
    ElMessage.success('来源差异已处理')
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>
<style scoped>
.change-form {
  margin-top: 24px;
}
.el-tabs {
  margin-top: 18px;
}
.el-alert {
  margin-bottom: 18px;
}
p {
  color: #64748b;
}
</style>
