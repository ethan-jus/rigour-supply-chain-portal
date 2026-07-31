<template>
  <el-card>
    <template #header>
      <div class="header"><strong>{{ title }}</strong>
        <el-button v-if="writePermission ? authStore.hasPermission(writePermission) : true"
          type="primary" @click="openCreate">新增</el-button>
      </div>
    </template>
    <el-table v-loading="loading" :data="rows" row-key="id">
      <el-table-column v-for="column in columns" :key="column.key" :prop="column.key"
        :label="column.label" :min-width="column.width || 120" />
      <el-table-column v-if="writePermission ? authStore.hasPermission(writePermission) : true"
        label="操作" width="100" fixed="right">
        <template #default="scope"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button></template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="editingId ? `编辑${title}` : `新增${title}`" width="560px">
    <el-form label-width="110px">
      <el-form-item v-for="field in visibleFields" :key="field.key" :label="field.label" :required="field.required">
        <el-select v-if="field.type === 'select'" v-model="form[field.key]" style="width:100%">
          <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-input-number v-else-if="field.type === 'number'" v-model="numberValues[field.key]" :min="0" />
        <el-switch v-else-if="field.type === 'boolean'" v-model="booleanValues[field.key]" />
        <el-input v-else v-model="stringValues[field.key]" :type="field.type === 'textarea' ? 'textarea' : 'text'" />
      </el-form-item>
    </el-form>
    <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'

export interface CrudColumn { key: string; label: string; width?: number }
export interface CrudField {
  key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'boolean' | 'select'
  required?: boolean; createOnly?: boolean; defaultValue?: string | number | boolean | null
  options?: Array<{ label: string; value: string }>
}
type FormValue = string | number | boolean | null
type Row = Record<string, unknown>

const props = defineProps<{
  title: string; endpoint: string; columns: CrudColumn[]; fields: CrudField[]; writePermission?: string
}>()
const authStore = useAuthStore()
const rows = ref<Row[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Record<string, FormValue>>({})
const visibleFields = computed(() => props.fields.filter((field) => !field.createOnly || !editingId.value))
const stringValues = computed(() => form as Record<string, string>)
const numberValues = computed(() => form as Record<string, number>)
const booleanValues = computed(() => form as Record<string, boolean>)

async function load() {
  loading.value = true
  try { rows.value = (await apiClient.get(props.endpoint)) as Row[] }
  finally { loading.value = false }
}
function resetForm() {
  Object.keys(form).forEach((key) => delete form[key])
  props.fields.forEach((field) => { form[field.key] = field.defaultValue ?? null })
}
function openCreate() { editingId.value = null; resetForm(); dialogVisible.value = true }
function openEdit(row: Row) {
  editingId.value = String(row.id)
  resetForm()
  props.fields.forEach((field) => {
    const value = row[field.key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      form[field.key] = value
    }
  })
  form.version = typeof row.version === 'number' ? row.version : 0
  dialogVisible.value = true
}
async function save() {
  const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === '' ? null : value]))
  if (editingId.value) await apiClient.put(`${props.endpoint}/${editingId.value}`, payload)
  else await apiClient.post(props.endpoint, payload)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  await load()
}
onMounted(() => { void load() })
</script>

<style scoped>.header{display:flex;justify-content:space-between;align-items:center}</style>
