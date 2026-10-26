<template>
  <section v-loading="loading" class="scope-fields">
    <p class="scope-note">填写管辖城市与任期，点击弹窗底部“确定”与员工资料一起保存。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="loadError" @click="load">重新加载</el-button>
    <el-form label-position="top" :disabled="!canWrite || loading || !!loadError">
      <section v-for="(row, index) in rows" :key="row.id || row.requestId" class="scope-row">
        <header>
          <strong>管辖城市 {{ index + 1 }}</strong
          ><el-button v-if="!row.id && canWrite" link type="danger" @click="rows.splice(index, 1)"
            >移除</el-button
          >
        </header>
        <div class="scope-grid">
          <el-form-item label="管辖城市" required
            ><el-select
              v-model="row.cityCode"
              filterable
              :disabled="!!row.id"
              placeholder="请选择城市"
              @change="row.cityName = options.find((c) => c.code === row.cityCode)?.name || ''"
              ><el-option
                v-for="city in cityOptions(row)"
                :key="city.code"
                :value="city.code"
                :label="city.name" /></el-select
          ></el-form-item>
          <el-form-item label="任期开始" required
            ><el-date-picker
              v-model="row.effectiveFrom"
              value-format="YYYY-MM-DD"
              :disabled="started(row)"
              placeholder="请选择开始日期"
          /></el-form-item>
          <el-form-item label="任期结束"
            ><el-date-picker
              v-model="row.effectiveTo"
              value-format="YYYY-MM-DD"
              clearable
              placeholder="未设结束日期"
          /></el-form-item>
          <el-form-item label="状态"
            ><el-switch
              v-model="row.enabled"
              :disabled="started(row)"
              active-text="启用"
              inactive-text="停用"
          /></el-form-item>
          <el-form-item label="备注" class="scope-remark"
            ><el-input v-model="row.remark" maxlength="500" placeholder="可填写任命或交接说明"
          /></el-form-item>
        </div>
        <p v-if="started(row)" class="scope-note">
          任期已开始，可补充结束日期或备注；交接时结束原任期，并为接任人员增加管辖城市。
        </p>
      </section>
    </el-form>
    <el-empty
      v-if="!loading && !error && !rows.length"
      description="尚未配置管辖城市"
      :image-size="64"
    />
    <el-button v-if="canWrite" :disabled="loading || !!loadError" @click="add"
      >增加管辖城市</el-button
    >
  </section>
</template>
<script setup lang="ts">
import { randomId } from '@/utils/random-id'
import { onBeforeUnmount, ref, watch } from 'vue'
import { getCostCities } from '@/api/core/cost'
import { getPayrollRules } from '@/api/core/payroll'
import type { HrEmployeeCityScopeCommand } from '@/api/core/hr/models/HrEmployeeCityScopeCommand'
import { completePages, shanghaiToday } from '../city-manager-model'
import { errorMessage } from '@/api/core/error'

const props = defineProps<{ employeeCode?: string | null; canWrite: boolean }>()
const rows = ref<HrEmployeeCityScopeCommand[]>([]),
  options = ref<{ code: string; name: string }[]>([])
const loading = ref(false),
  error = ref(''),
  loadError = ref(false)
let version = 0
const baseline = new Map<string, string>(),
  startedIds = new Set<string>()
const started = (row: HrEmployeeCityScopeCommand) => !!row.id && startedIds.has(row.id)
function cityOptions(row: HrEmployeeCityScopeCommand) {
  return row.cityCode && !options.value.some((c) => c.code === row.cityCode)
    ? [...options.value, { code: row.cityCode, name: row.cityName }]
    : options.value
}
async function load() {
  const id = ++version
  loading.value = true
  error.value = ''
  loadError.value = false
  rows.value = []
  baseline.clear()
  startedIds.clear()
  try {
    const [cities, records] = await Promise.all([
      props.canWrite ? getCostCities() : Promise.resolve([]),
      props.employeeCode
        ? completePages((begin) =>
            getPayrollRules({ begin, step: 200, kindCode: 'CITY_MANAGER', keyword: '' }),
          )
        : Promise.resolve([]),
    ])
    if (id !== version) return
    options.value = cities
    rows.value = records
      .filter(
        (r) => r.data.kindCode === 'CITY_MANAGER' && r.data.employeeCode === props.employeeCode,
      )
      .map((r) => ({
        id: r.id,
        revision: r.revision,
        requestId: r.data.requestId,
        cityCode: r.data.cityCode || '',
        cityName: r.data.cityName || '',
        effectiveFrom: r.data.effectiveFrom,
        effectiveTo: r.data.effectiveTo === '9999-12-31' ? null : r.data.effectiveTo,
        enabled: r.data.enabled,
        remark: r.data.remark || '',
      }))
    for (const row of rows.value) {
      baseline.set(row.id!, JSON.stringify(row))
      if (row.effectiveFrom <= shanghaiToday()) startedIds.add(row.id!)
    }
  } catch (e) {
    if (id === version) {
      loadError.value = true
      error.value = errorMessage(e, '管辖范围加载失败，请重试')
    }
  } finally {
    if (id === version) loading.value = false
  }
}
function add() {
  if (!props.canWrite || loading.value || loadError.value) return
  rows.value.push({
    id: null,
    revision: null,
    requestId: randomId(),
    cityCode: '',
    cityName: '',
    effectiveFrom: '',
    effectiveTo: null,
    enabled: true,
    remark: '',
  })
}
function commands(): HrEmployeeCityScopeCommand[] {
  if (!props.canWrite) return []
  if (loading.value || loadError.value)
    throw new Error(error.value || '管辖范围正在加载，请稍后保存')
  const changed = rows.value.filter(
    (row) => !row.id || JSON.stringify(row) !== baseline.get(row.id),
  )
  error.value = ''
  for (const row of changed) {
    if (!row.cityCode || !row.cityName || !row.effectiveFrom)
      error.value = '请完整填写管辖城市和任期开始日期'
    else if (row.effectiveTo && row.effectiveTo < row.effectiveFrom)
      error.value = '任期结束不能早于任期开始'
    if (error.value) throw new Error(error.value)
  }
  if (changed.length > 100) throw new Error('每次最多维护100条管辖记录')
  return changed.map((row) => ({ ...row }))
}
watch(() => props.employeeCode, load, { immediate: true })
onBeforeUnmount(() => {
  version++
})
defineExpose({ commands })
</script>
<style scoped>
.scope-fields {
  min-height: 180px;
}
.scope-note {
  margin: 0 0 16px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}
.scope-row {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 16px;
}
.scope-row header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.scope-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
}
.scope-remark {
  grid-column: span 2;
}
.scope-grid :deep(.el-select),
.scope-grid :deep(.el-date-editor) {
  width: 100%;
}
@media (max-width: 680px) {
  .scope-grid {
    grid-template-columns: 1fr;
  }
  .scope-remark {
    grid-column: auto;
  }
}
</style>
