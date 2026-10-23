<template>
  <el-alert v-if="reviews.length" type="warning" :closable="false" show-icon>
    <template #title>
      规则变更待复核 {{ reviews.length }} 项
      <el-button link type="primary" @click="visible = true">查看待复核记录</el-button>
    </template>
    已确认结果保留原值，请核对规则调整的影响后处理。
  </el-alert>
  <el-drawer v-model="visible" title="规则变更待复核" size="min(1000px, 95vw)" append-to-body>
    <el-alert
      :title="
        subject === 'ATTENDANCE'
          ? '需要调整时，先撤销考勤确认，再核定出勤与缺勤、重新确认；处理完成或核对无需调整后，填写复核说明。'
          : '未发放：撤回确认、重新核算并再次确认；已发放：通过补差处理。处理完成或核对无需调整后，填写复核说明。'
      "
      type="info"
      :closable="false"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="reviews" row-key="id" border>
      <el-table-column label="员工" min-width="110"
        ><template #default="{ row }">{{
          row.employeeName || row.employeeCode
        }}</template></el-table-column
      >
      <el-table-column prop="ruleName" label="变更规则" min-width="160" />
      <el-table-column label="变更操作" width="100"
        ><template #default="{ row }">{{
          row.action === 'DISABLE' ? '停用' : '重新启用'
        }}</template></el-table-column
      >
      <el-table-column prop="reason" label="变更原因" min-width="180" />
      <el-table-column label="操作" width="180"
        ><template #default="{ row }">
          <el-button link type="primary" @click="locate(row as PayrollRuleReview)"
            >定位记录</el-button
          >
          <el-button
            v-if="canProcess"
            link
            type="primary"
            :disabled="!!busy"
            @click="resolve(row as PayrollRuleReview)"
            >复核完成</el-button
          >
        </template></el-table-column
      >
    </el-table>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  resolvePayrollRuleReview,
  type PayrollRuleReview,
} from '@/api/core/payroll-scheme/components'
import { errorMessage } from '@/api/core/error'

defineProps<{
  reviews: PayrollRuleReview[]
  subject: PayrollRuleReview['subject']
  canProcess: boolean
}>()
const emit = defineEmits<{ locate: [review: PayrollRuleReview]; resolved: [] }>()
const visible = ref(false),
  busy = ref(''),
  error = ref('')
function locate(review: PayrollRuleReview) {
  visible.value = false
  emit('locate', review)
}
async function resolve(review: PayrollRuleReview) {
  let reason: string
  try {
    const result = await ElMessageBox.prompt(
      '请说明已完成的重算、补差处理，或核对后无需调整的依据。此操作仅完成复核标记。',
      `复核完成：${review.employeeName || review.employeeCode}`,
      {
        inputType: 'textarea',
        confirmButtonText: '确认复核完成',
        cancelButtonText: '取消',
        inputValidator: (value) =>
          (!!value?.trim() && value.trim().length <= 1000) || '请填写1至1000字复核说明',
      },
    )
    reason = result.value.trim()
  } catch {
    return
  }
  busy.value = review.id
  error.value = ''
  try {
    await resolvePayrollRuleReview(review.id, reason)
    ElMessage.success('已记录复核结果')
    emit('resolved')
  } catch (e) {
    error.value = errorMessage(e, '复核结果保存失败')
  } finally {
    busy.value = ''
  }
}
</script>
