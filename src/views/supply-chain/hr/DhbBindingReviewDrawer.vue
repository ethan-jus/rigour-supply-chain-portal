<template>
  <el-drawer
    :model-value="modelValue"
    title="关联风险核对"
    size="min(520px, 100vw)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-empty v-if="!items.length" description="暂无待确认关联" />
    <template v-else>
      <el-select
        v-if="items.length > 1"
        v-model="selectedId"
        aria-label="待确认账号"
        class="risk-select"
      >
        <el-option
          v-for="item in items"
          :key="item.bindingId"
          :value="item.bindingId"
          :label="`${item.accountName || item.sourceStaffId} · ${item.employeeName}`"
        />
      </el-select>
      <template v-if="selected">
        <el-alert :title="selected.reason" type="warning" :closable="false" />
        <el-descriptions :column="1" border class="risk-comparison">
          <el-descriptions-item label="订货宝账号">{{
            selected.accountName || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="订货宝姓名">{{
            selected.sourceEmployeeName || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="订货宝手机号">{{
            selected.sourceMobile || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="系统员工"
            >{{ selected.employeeName }} · {{ selected.employeeCode }}</el-descriptions-item
          >
          <el-descriptions-item label="系统手机号">{{
            selected.mobile || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="系统部门">{{
            selected.departmentName || '—'
          }}</el-descriptions-item>
        </el-descriptions>
        <p class="risk-hint">
          保留系统员工档案。确认后移除风险提示并保存处理记录；更换关联仅影响后续同步，不自动重写历史归属。
        </p>
        <el-form v-if="changing" label-position="top">
          <el-form-item label="更换为系统员工">
            <el-select
              v-model="targetId"
              filterable
              remote
              :remote-method="searchEmployees"
              :loading="searching"
              placeholder="搜索员工姓名 / 编号 / 手机号"
              aria-label="目标员工"
              class="risk-select"
            >
              <el-option
                v-for="e in employees"
                :key="e.id"
                :value="String(e.id)"
                :label="`${e.employeeName} · ${e.employeeCode} · ${e.departmentName || '未分配部门'}`"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <div v-if="can('hr:employee:update')" class="risk-actions">
          <el-button
            type="primary"
            :loading="saving"
            :disabled="changing && !targetId"
            @click="confirm"
            >{{ changing ? '确认更换关联' : '确认关联' }}</el-button
          >
          <el-button :disabled="saving" @click="toggleChange">{{
            changing ? '取消更换' : '更换员工'
          }}</el-button>
        </div>
      </template>
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  confirmDhbBinding,
  getHrEmployees,
  type DhbBindingRisk,
  type HrEmployeeRecord,
} from '@/api/core/hr'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const props = defineProps<{
  modelValue: boolean
  risks: DhbBindingRisk[]
  employeeId: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; resolved: [] }>()
const { can } = useSupplyPermissions()
const items = computed(() =>
  props.employeeId == null
    ? props.risks
    : props.risks.filter((r) => String(r.employeeId) === String(props.employeeId)),
)
const selectedId = ref<number>(),
  changing = ref(false),
  targetId = ref(''),
  error = ref(''),
  saving = ref(false),
  searching = ref(false)
const employees = ref<HrEmployeeRecord[]>([])
const selected = computed(
  () => items.value.find((r) => r.bindingId === selectedId.value) ?? items.value[0],
)
watch(
  () => [props.modelValue, props.employeeId],
  () => {
    selectedId.value = items.value[0]?.bindingId
    changing.value = false
    targetId.value = ''
    error.value = ''
  },
)
watch(selected, () => {
  changing.value = false
  targetId.value = ''
  error.value = ''
})
function toggleChange() {
  changing.value = !changing.value
  targetId.value = ''
  error.value = ''
}
let searchVersion = 0
async function searchEmployees(keyword: string) {
  const version = ++searchVersion
  searching.value = true
  try {
    const result = await getHrEmployees({ begin: 0, step: 30, keyword })
    if (version === searchVersion) employees.value = result.items
  } catch (e) {
    if (version === searchVersion) error.value = e instanceof Error ? e.message : '员工查询失败'
  } finally {
    if (version === searchVersion) searching.value = false
  }
}
async function confirm() {
  if (!selected.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await confirmDhbBinding(
      selected.value.bindingId,
      selected.value.version,
      changing.value ? targetId.value : String(selected.value.employeeId),
    )
    ElMessage.success('关联已确认，风险提示已解除')
    emit('resolved')
    emit('update:modelValue', false)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '确认失败，请刷新后重新核对'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.risk-select {
  width: 100%;
  margin-bottom: 12px;
}
.risk-comparison {
  margin: 20px 0;
}
.risk-hint {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}
.risk-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
</style>
