<template>
  <el-dialog
    :model-value="modelValue"
    title="历史归属复核"
    width="min(1000px,96vw)"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading">
      <el-alert
        title="按订单当时的事实提交证据，由另一名有权限的用户审核。没有历史部门或地区证据时请保留未知；调整会影响历史归属统计。"
        type="warning"
        :closable="false"
      />
      <template v-if="context">
        <p>
          订单：{{ context.orderNo }} · 来源：{{ context.sourceSystemCode || '内部订单' }} /
          {{ context.sourceOrderNo || '—' }}
        </p>
        <p>
          当前归属：{{
            current.employee_name || current.owner_employee_name_snapshot || '待核对'
          }}（{{ current.employee_code || current.owner_employee_code || '未知员工' }}） · 部门：{{
            current.department_name || '未知'
          }}
          · 地区：{{ current.region_code || '未知' }}
        </p>
        <el-collapse v-if="can('order:attribution:propose')" v-model="expanded"
          ><el-collapse-item title="申请归属更正" name="propose">
            <el-form label-position="top" :disabled="saving" class="form">
              <el-form-item label="HR 员工编码" required
                ><el-input
                  v-model="form.employeeCode"
                  maxlength="50"
                  placeholder="填写已核对映射的 HR 员工编码"
              /></el-form-item>
              <el-form-item label="历史员工姓名" required
                ><el-input v-model="form.employeeName" maxlength="128" placeholder="订单当时的姓名"
              /></el-form-item>
              <el-form-item label="历史部门编号（无证据时留空）"
                ><el-input v-model="form.departmentId" placeholder="已核对的部门编号"
              /></el-form-item>
              <el-form-item label="历史部门名称"
                ><el-input v-model="form.departmentName" maxlength="160"
              /></el-form-item>
              <el-form-item label="历史部门层级（从根部门到本部门的编号，以逗号分隔）" class="wide"
                ><el-input
                  v-model="form.departmentPath"
                  placeholder="仅填写来源证据中已核对的历史层级，不使用当前组织树推算"
              /></el-form-item>
              <el-form-item label="历史地区编码（无证据时留空）"
                ><el-input v-model="form.regionCode" maxlength="128"
              /></el-form-item>
              <el-form-item label="历史地区层级（从根地区到本地区的编码，以逗号分隔）"
                ><el-input v-model="form.regionPath"
              /></el-form-item>
              <el-form-item label="来源证据位置" required class="wide"
                ><el-input
                  v-model="form.evidenceRef"
                  maxlength="1000"
                  placeholder="来源系统记录号、档案位置或附件引用"
              /></el-form-item>
              <el-form-item label="历史归属证据说明" required class="wide"
                ><el-input
                  v-model="form.evidenceText"
                  type="textarea"
                  :rows="3"
                  maxlength="4000"
                  placeholder="说明员工映射、当时归属及历史层级的依据；系统不会代替人工验证证据内容"
              /></el-form-item>
              <el-form-item label="更正原因" required class="wide"
                ><el-input v-model="form.reason" maxlength="1000"
              /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="saving" @click="propose">提交复核申请</el-button>
          </el-collapse-item></el-collapse
        >
        <h3>申请与处理记录</h3>
        <el-empty v-if="!context.adjustments.length" description="暂无归属复核记录" />
        <el-card v-for="item in context.adjustments" :key="item.id" class="record">
          <header>
            <strong>{{ status(item.status) }}</strong
            ><span>申请时间 {{ item.proposedAt }}</span>
          </header>
          <p>
            拟归属：{{ item.proposed.employeeName }}（{{ item.proposed.employeeCode }}） · 部门
            {{ item.proposed.departmentName || '未知' }} · 地区
            {{ item.proposed.regionCode || '未知' }}
          </p>
          <p>
            部门层级：{{ item.proposed.departmentPath.join(' → ') || '未知' }}；地区层级：{{
              item.proposed.regionPath.join(' → ') || '未知'
            }}
          </p>
          <p>原因：{{ item.reason }}</p>
          <p>证据位置：{{ item.evidenceRef }}</p>
          <p class="evidence">证据说明：{{ item.evidenceText }}</p>
          <p v-if="item.reviewedAt">
            处理时间：{{ item.reviewedAt }} · 意见：{{ item.reviewReason }}
          </p>
          <el-collapse
            ><el-collapse-item title="查看调整前归属" name="before">
              <p>
                员工：{{ beforeValue(item, 'employee_name', 'owner_employee_name_snapshot') }}（{{
                  beforeValue(item, 'employee_code', 'owner_employee_code')
                }}）
              </p>
              <p>
                部门：{{ beforeValue(item, 'department_name') }}；地区：{{
                  beforeValue(item, 'region_code')
                }}
              </p>
              <p>
                历史部门层级：{{ beforeValue(item, 'department_path') }}；历史地区层级：{{
                  beforeValue(item, 'region_path')
                }}
              </p>
            </el-collapse-item></el-collapse
          >
          <div v-if="item.status === 'PENDING' && can('order:attribution:approve')">
            <el-button type="primary" :disabled="saving" @click="decide(item, true)"
              >审核通过并生效</el-button
            ><el-button :disabled="saving" @click="decide(item, false)">驳回</el-button>
          </div>
        </el-card>
      </template>
    </div>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  attributionReviewApi,
  type AttributionReviewContext,
  type AttributionAdjustment,
} from '@/api/core/order-attribution-review'
const props = defineProps<{ modelValue: boolean; orderId: string | number | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'applied'): void }>()
const { can } = useSupplyPermissions(),
  context = ref<AttributionReviewContext | null>(null),
  loading = ref(false),
  saving = ref(false),
  expanded = ref<string[]>([])
const current = computed(() =>
  context.value?.snapshotRevision
    ? context.value.current.snapshot
    : context.value?.current.order || {},
)
const form = reactive({
  employeeCode: '',
  employeeName: '',
  departmentId: '',
  departmentName: '',
  departmentPath: '',
  regionCode: '',
  regionPath: '',
  evidenceRef: '',
  evidenceText: '',
  reason: '',
})
function beforeValue(item: AttributionAdjustment, key: string, fallback?: string) {
  const original = item.before.snapshot as Record<string, unknown> | undefined
  const order = item.before.order as Record<string, unknown> | undefined
  const value = original?.[key] ?? order?.[fallback || key]
  if (value == null) return '未知'
  if (Array.isArray(value)) return value.join(' → ') || '未知'
  if (key.endsWith('_path')) {
    try {
      const path = JSON.parse(String(value))
      if (Array.isArray(path)) return path.join(' → ') || '未知'
    } catch {
      /* 原证据不是路径数组时保留原文供核对。 */
    }
  }
  return String(value)
}
function status(s: string) {
  return (
    ({ PENDING: '待复核', APPLIED: '已生效', REJECTED: '已驳回' } as Record<string, string>)[s] || s
  )
}
function error(e: unknown) {
  ElMessage.error(e instanceof Error ? e.message : '归属复核操作失败')
}
async function load() {
  if (props.orderId == null) return
  loading.value = true
  try {
    context.value = await attributionReviewApi.context(props.orderId)
  } catch (e) {
    error(e)
  } finally {
    loading.value = false
  }
}
watch(
  () => [props.modelValue, props.orderId],
  async () => {
    if (props.modelValue) {
      context.value = null
      expanded.value = []
      Object.keys(form).forEach((k) => (form[k as keyof typeof form] = ''))
      await load()
    }
  },
  { immediate: true },
)
const path = (v: string) =>
  v
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
async function propose() {
  if (!context.value || props.orderId == null) return
  if (
    !form.employeeCode.trim() ||
    !form.employeeName.trim() ||
    !form.evidenceRef.trim() ||
    !form.evidenceText.trim() ||
    !form.reason.trim()
  ) {
    ElMessage.warning('请填写员工、证据和更正原因')
    return
  }
  if (
    (form.departmentId && !/^[1-9][0-9]*$/.test(form.departmentId)) ||
    path(form.departmentPath).some((x) => !/^[1-9][0-9]*$/.test(x))
  ) {
    ElMessage.warning('部门编号必须是正整数')
    return
  }
  saving.value = true
  try {
    await attributionReviewApi.propose(props.orderId, {
      orderRevision: context.value.orderRevision,
      snapshotRevision: context.value.snapshotRevision,
      proposed: {
        employeeCode: form.employeeCode.trim(),
        employeeName: form.employeeName.trim(),
        departmentId: form.departmentId || null,
        departmentName: form.departmentName || null,
        departmentPath: path(form.departmentPath),
        regionCode: form.regionCode || null,
        regionPath: path(form.regionPath),
      },
      evidenceRef: form.evidenceRef,
      evidenceText: form.evidenceText,
      reason: form.reason,
    })
    await load()
    expanded.value = []
    ElMessage.success('已提交，请另一名有权限的用户复核')
  } catch (e) {
    error(e)
  } finally {
    saving.value = false
  }
}
async function decide(item: AttributionAdjustment, approve: boolean) {
  if (props.orderId == null) return
  try {
    const result = await ElMessageBox.prompt(
      approve
        ? '确认已核对来源证据；通过后会更新历史订单归属，金额及库存保持原值。'
        : '填写驳回原因。',
      approve ? '审核归属更正' : '驳回申请',
      {
        inputType: 'textarea',
        inputValidator: (v: string) =>
          (!!v?.trim() && v.length <= 1000) || '请填写1至1000字复核意见',
      },
    )
    saving.value = true
    await attributionReviewApi.decide(props.orderId, item.id, approve, result.value)
    await load()
    if (approve) emit('applied')
    ElMessage.success(approve ? '归属调整已生效' : '已驳回')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error(e)
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}
.wide {
  grid-column: 1/-1;
}
.record {
  margin: 12px 0;
}
.record header {
  display: flex;
  justify-content: space-between;
}
.evidence,
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
