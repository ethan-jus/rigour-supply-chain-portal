<template>
  <el-dialog
    v-model="visible"
    title="批量录入报销"
    width="min(1180px, 96vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    :before-close="close"
  >
    <p>
      同一员工、同一费用归属可一次登记多项费用。不同归属请分批录入；保存为待确认记录，继续编辑补齐用途、行程或物品明细和凭据后确认。
    </p>
    <el-form class="batch-common" label-position="top" :disabled="saving || started">
      <el-form-item label="费用归属" required>
        <CostCitySelect v-model="city" action="hr:expense:write" @loaded="cities = $event" />
      </el-form-item>
      <el-form-item label="报销员工" required>
        <CostExpenseEmployeeSelect
          v-model="employee"
          :city-code="city"
          :city-name="cities.find((row) => row.code === city)?.name || ''"
          :disabled="saving || started"
          @loading="employeeLoading = $event"
        />
      </el-form-item>
      <el-form-item label="付款状态"
        ><el-select v-model="payment"
          ><el-option
            v-for="option in costOptions('COST_PAYMENT_STATUS')"
            :key="option.value"
            v-bind="option" /></el-select
      ></el-form-item>
    </el-form>
    <el-table :data="rows" border max-height="420">
      <el-table-column label="* 费用日期" width="165"
        ><template #default="{ row }"
          ><el-date-picker
            v-model="row.date"
            value-format="YYYY-MM-DD"
            :disabled="saving || row.attempted"
            style="width: 100%" /></template
      ></el-table-column>
      <el-table-column label="* 费用类型" width="170"
        ><template #default="{ row }"
          ><el-select v-model="row.type" :disabled="saving || row.attempted"
            ><el-option
              v-for="option in types"
              :key="option.value"
              v-bind="option" /></el-select></template
      ></el-table-column>
      <el-table-column label="* 费用事项" min-width="180"
        ><template #default="{ row }"
          ><el-input
            v-model="row.title"
            maxlength="200"
            :disabled="saving || row.attempted" /></template
      ></el-table-column>
      <el-table-column label="* 金额（元）" width="160"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.amount"
            :min="0"
            :precision="2"
            controls-position="right"
            :disabled="saving || row.attempted"
            style="width: 100%" /></template
      ></el-table-column>
      <el-table-column label="* 费用用途 / 出差事由" min-width="220">
        <template #default="{ row }"
          ><el-input v-model="row.purpose" maxlength="1000" :disabled="saving || row.attempted"
        /></template>
      </el-table-column>
      <el-table-column
        v-if="rows.some((row) => row.type === 'COURIER')"
        label="快递寄送明细"
        min-width="240"
      >
        <template #default="{ row }">
          <template v-if="row.type === 'COURIER'">
            <el-input
              v-model="row.courier.contents"
              aria-label="寄送内容"
              placeholder="* 寄送内容"
              maxlength="200"
              :disabled="saving || row.attempted"
            />
            <el-input
              v-model="row.courier.recipientName"
              aria-label="收件客户 / 合作方"
              placeholder="* 收件客户 / 合作方"
              maxlength="200"
              :disabled="saving || row.attempted"
            />
            <el-input
              v-model="row.courier.companyName"
              aria-label="快递公司"
              placeholder="* 快递公司"
              maxlength="100"
              :disabled="saving || row.attempted"
            />
            <el-input
              v-model="row.courier.trackingNo"
              aria-label="运单号"
              placeholder="* 运单号"
              maxlength="100"
              :disabled="saving || row.attempted"
            />
          </template>
        </template>
      </el-table-column>
      <el-table-column label="结果" min-width="160"
        ><template #default="{ row }">{{
          row.saved ? '已保存 · ' + row.saved : row.error || '待保存'
        }}</template></el-table-column
      >
      <el-table-column width="70"
        ><template #default="{ row, $index }"
          ><el-button
            link
            type="danger"
            :disabled="saving || row.attempted"
            @click="rows.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-button :disabled="saving || started || rows.length >= 50" @click="rows.push(newRow())"
      >增加一行（最多50行）</el-button
    >
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="started">未成功的费用可重试，已保存的费用不会重复录入。</p>
    <template #footer
      ><el-button :disabled="saving" @click="close(() => (visible = false))">关闭</el-button>
      <el-button v-if="rows.length && rows.every((r) => r.saved)" :disabled="saving" @click="reset"
        >录入下一批</el-button
      >
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!rows.length || rows.every((r) => r.saved)"
        @click="save"
        >{{ started ? '重试未成功记录' : '保存本批费用' }}</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { saveCost, type CostCommand, type CostEmployee } from '@/api/core/cost'
import { ApiError, errorMessage } from '@/api/core/error'
import { costOptions } from './cost-dictionaries'
import CostCitySelect from './CostCitySelect.vue'
import CostExpenseEmployeeSelect from './CostExpenseEmployeeSelect.vue'
import { expenseCostCategory } from './expense-cost-policy'
defineProps<{ employees: CostEmployee[] }>()
const visible = defineModel<boolean>({ required: true }),
  emit = defineEmits<{ saved: [] }>()
interface Row {
  id: string
  date: string
  type: string
  title: string
  purpose: string
  courier: { contents: string; recipientName: string; companyName: string; trackingNo: string }
  amount: number | undefined
  attempted: boolean
  saved: string
  error: string
  command?: CostCommand
}
const newRow = (): Row => ({
  id: crypto.randomUUID(),
  date: '',
  type: '',
  title: '',
  purpose: '',
  courier: { contents: '', recipientName: '', companyName: '', trackingNo: '' },
  amount: undefined,
  attempted: false,
  saved: '',
  error: '',
})
const rows = ref<Row[]>([newRow()]),
  employee = ref<string | null>(''),
  city = ref(''),
  cities = ref<{ code: string; name: string }[]>([])
const payment = ref('UNPAID')
const employeeLoading = ref(false)
const saving = ref(false),
  error = ref(''),
  started = computed(() => rows.value.some((r) => r.attempted))
const types = computed(() => costOptions('REIMBURSEMENT_EXPENSE_TYPE'))
const unsaved = computed(
  () =>
    visible.value &&
    rows.value.some((row) => !row.saved) &&
    (!!city.value ||
      !!employee.value ||
      payment.value !== 'UNPAID' ||
      rows.value.some(
        (row) =>
          !row.saved &&
          (row.attempted || row.date || row.type || row.title || row.purpose || row.amount != null),
      )),
)
async function canLeave(): Promise<boolean> {
  if (!visible.value) return true
  if (saving.value) {
    ElMessage.info('正在保存本批费用，请稍候')
    return false
  }
  if (!unsaved.value) return true
  try {
    await ElMessageBox.confirm(
      started.value
        ? '本批仍有未成功的费用。离开后将无法继续重试，请先核对已保存记录，避免重复登记。确定离开？'
        : '本批费用尚未保存，确定放弃录入？',
      '离开批量录入',
      { confirmButtonText: '放弃未保存记录', cancelButtonText: '继续录入', type: 'warning' },
    )
    return true
  } catch {
    return false
  }
}
async function close(done: () => void) {
  if (await canLeave()) {
    reset()
    done()
  }
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
function beforeUnload(event: BeforeUnloadEvent) {
  if (saving.value || unsaved.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function reset() {
  rows.value = [newRow()]
  employee.value = ''
  city.value = ''
  payment.value = 'UNPAID'
  error.value = ''
}
async function save() {
  if (saving.value) return
  if (employeeLoading.value) {
    error.value = '正在读取员工，请稍候再保存'
    return
  }
  error.value = ''
  const selectedCity = cities.value.find((c) => c.code === city.value)
  if (
    !employee.value ||
    !selectedCity ||
    rows.value.some(
      (r) =>
        !r.date ||
        !r.title.trim() ||
        !r.type ||
        !r.purpose.trim() ||
        r.amount == null ||
        r.amount < 0,
    )
  ) {
    error.value = '请填写员工、费用归属及每行的日期、费用类型、事项、用途和金额'
    return
  }
  if (
    rows.value.some(
      (row) => row.type === 'COURIER' && Object.values(row.courier).some((value) => !value.trim()),
    )
  ) {
    error.value = '请填写快递寄送的寄送内容、收件客户 / 合作方、快递公司和运单号'
    return
  }
  saving.value = true
  try {
    for (const row of rows.value.filter((r) => !r.saved)) {
      row.command ??= {
        requestId: row.id,
        revision: null,
        title: row.title.trim(),
        typeCode: row.type,
        cityCode: city.value,
        cityName: selectedCity.name,
        departmentId: null,
        ownerEmployeeCode: employee.value,
        costDate: row.date,
        costMonth: row.date.slice(0, 7),
        amount: row.amount!,
        paymentStatusCode: payment.value,
        expense: {
          costCategory: expenseCostCategory(row.type),
          purpose: row.purpose.trim(),
          ...(row.type === 'COURIER' ? { courier: { ...row.courier } } : {}),
        },
        logistics: null,
        rental: null,
        remark: '',
        reason: '批量代录报销',
      }
      row.attempted = true
      row.error = ''
      try {
        const result = await saveCost('expenses', null, row.command)
        row.saved = result.documentNo
      } catch (e) {
        row.error = errorMessage(e, '保存未确认，请重试核对')
        // Only a definite validation rejection permits editing a new submission.
        // Timeouts and other uncertain outcomes retain the original idempotency key.
        if (e instanceof ApiError && [400, 422].includes(e.status ?? 0)) {
          row.attempted = false
          row.command = undefined
          row.id = crypto.randomUUID()
        }
      }
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.batch-common {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 760px) {
  .batch-common {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
