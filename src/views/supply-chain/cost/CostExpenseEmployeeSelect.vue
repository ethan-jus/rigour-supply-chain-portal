<template>
  <div class="expense-employee-select">
    <el-select
      v-model="employee"
      filterable
      clearable
      :loading="loading"
      :disabled="disabled || loading || !cityCode"
      :placeholder="cityCode ? '选择报销员工' : '请先选择费用归属'"
      aria-label="关联员工"
      @change="pick"
    >
      <el-option
        v-if="employee && !rows.some((row) => row.employeeCode === employee)"
        :value="employee"
        :label="snapshot || '已选员工'"
        disabled
      />
      <el-option
        v-for="row in rows"
        :key="row.employeeCode"
        :value="row.employeeCode"
        :label="label(row)"
      />
      <template #empty
        ><p class="employee-empty">
          {{ loading ? '正在加载员工…' : error || '当前归属暂无可选员工' }}
        </p></template
      >
    </el-select>
    <el-checkbox
      v-if="cityCode && cityCode !== 'COST_HEADQUARTERS'"
      v-model="crossCity"
      :disabled="disabled || loading"
      @change="load"
      >跨城报销，选择其他城市员工</el-checkbox
    >
    <p v-if="error" role="alert" class="employee-error">
      {{ error }}
      <el-button link type="primary" :disabled="disabled || loading" @click="load"
        >重新加载</el-button
      >
    </p>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCostEmployees, type CostEmployee } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
const props = defineProps<{
  cityCode: string
  cityName: string
  costDate?: string
  snapshot?: string | null
  disabled?: boolean
}>()
const employee = defineModel<string | null>({ required: true })
const emit = defineEmits<{ picked: [employee: CostEmployee | null]; loading: [value: boolean] }>()
const rows = ref<CostEmployee[]>([]),
  loading = ref(false),
  error = ref(''),
  crossCity = ref(false)
let serial = 0,
  initialSelection = !!employee.value
const initialCity = props.cityCode,
  initialDate = props.costDate
const cityKey = (value?: string | null) => (value || '').trim().replace(/市$/, '')
const label = (row: CostEmployee) => {
  const city =
    props.cityCode !== 'COST_HEADQUARTERS' &&
    !crossCity.value &&
    cityKey(row.cityName) !== cityKey(props.cityName)
      ? `管辖${props.cityName}`
      : row.cityName || row.departmentName
  return [row.employeeName, city].filter(Boolean).join(' · ')
}
function pick(code: string | null | undefined) {
  emit('picked', rows.value.find((row) => row.employeeCode === code) || null)
}
async function load() {
  const request = ++serial
  error.value = ''
  rows.value = []
  if (!props.cityCode || !props.cityName) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    let result = await getCostEmployees(
      'expenses',
      crossCity.value
        ? undefined
        : {
            cityCode: props.cityCode,
            cityName: props.cityName,
            costDate: props.costDate || undefined,
          },
    )
    if (request !== serial) return
    // 历史跨城单据仍可编辑；不把原已选员工静默清空或冒充本城市员工。
    if (
      initialSelection &&
      props.cityCode === initialCity &&
      props.costDate === initialDate &&
      employee.value &&
      !result.some((row) => row.employeeCode === employee.value)
    ) {
      const authorized = await getCostEmployees('expenses')
      if (request !== serial) return
      if (authorized.some((row) => row.employeeCode === employee.value)) {
        crossCity.value = true
        result = authorized
      }
    }
    initialSelection = false
    rows.value = result
    if (employee.value && !result.some((row) => row.employeeCode === employee.value)) {
      employee.value = null
      emit('picked', null)
      ElMessage.info('城市或费用日期已变更，请重新选择报销员工')
    }
  } catch (reason) {
    if (request === serial) error.value = errorMessage(reason, '员工加载失败，请重试')
  } finally {
    if (request === serial) loading.value = false
  }
}
watch(
  () => [props.cityCode, props.cityName, props.costDate],
  (value, previous) => {
    // 跨城选择仅适用于当前费用归属；切换后先按新归属匹配，历史原单由 load 保留。
    if (value[0] !== previous?.[0]) crossCity.value = false
    void load()
  },
  { immediate: true },
)
watch(loading, (value) => emit('loading', value), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => {
  serial++
  emit('loading', false)
})
</script>
<style scoped>
.expense-employee-select {
  width: 100%;
}
.employee-empty {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.employee-error {
  margin: 4px 0;
  color: var(--el-color-danger);
}
</style>
