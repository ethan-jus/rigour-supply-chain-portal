<template>
  <div class="dictionary-page">
    <el-card>
      <template #header>
        <div class="header">
          <div><strong>数据字典类型</strong><small>平台级枚举由平台管理员维护，租户级枚举只能由本租户管理员维护。</small></div>
          <el-button type="primary" @click="openType()">新增类型</el-button>
        </div>
      </template>
      <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon class="block-error">
        <template #default><el-button link type="primary" @click="loadTypes">重新加载</el-button></template>
      </el-alert>
      <el-table v-loading="loading" :data="types" row-key="id" highlight-current-row @current-change="selectType">
        <el-table-column prop="code" label="类型编码" min-width="160" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="description" label="说明" min-width="220" />
        <el-table-column label="状态" width="90"><template #default="scope">{{ formatPortalStatus(scope.row.status) }}</template></el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="scope"><el-button link type="primary" @click.stop="openType(scope.row)">编辑</el-button></template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="items-card">
      <template #header>
        <div class="header">
          <div><strong>字典条目</strong><small v-if="selectedType">当前类型：{{ selectedType.name }}（{{ selectedType.code }}）</small><small v-else>请先在左侧选择字典类型</small></div>
          <el-button type="primary" :disabled="!selectedType" @click="openItem()">新增条目</el-button>
        </div>
      </template>
      <el-empty v-if="!selectedType" description="选择字典类型后管理条目" />
      <template v-else>
        <el-alert v-if="itemError" type="error" :title="itemError" :closable="false" show-icon class="block-error" />
        <el-table v-loading="itemLoading" :data="items" row-key="id">
          <el-table-column prop="code" label="条目编码" min-width="160" />
          <el-table-column prop="label" label="显示名称" min-width="140" />
          <el-table-column prop="value" label="值" min-width="160" />
          <el-table-column prop="sortOrder" label="排序" width="80" />
          <el-table-column label="状态" width="90"><template #default="scope">{{ formatPortalStatus(scope.row.status) }}</template></el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="scope"><el-button link type="primary" @click="openItem(scope.row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <el-dialog v-model="typeDialog" :title="editingTypeId ? '编辑字典类型' : '新增字典类型'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="类型编码" required><el-input v-model="typeForm.code" :disabled="!!editingTypeId" maxlength="128" /></el-form-item>
        <el-form-item label="名称" required><el-input v-model="typeForm.name" maxlength="128" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="typeForm.description" type="textarea" :rows="3" maxlength="512" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="typeForm.status" style="width:100%"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="typeDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveType">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="itemDialog" :title="editingItemId ? '编辑字典条目' : '新增字典条目'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="条目编码" required><el-input v-model="itemForm.code" :disabled="!!editingItemId" maxlength="128" /></el-form-item>
        <el-form-item label="显示名称" required><el-input v-model="itemForm.label" maxlength="128" /></el-form-item>
        <el-form-item label="值"><el-input v-model="itemForm.value" maxlength="512" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemForm.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="itemForm.status" style="width:100%"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="itemDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveItem">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import type { DictionaryItemRecord, DictionaryTypeRecord } from '@/types/management'
import { formatPortalStatus } from '@/utils/portal-labels'

const route = useRoute()
const scope = computed(() => (route.meta.dictionaryScope === 'platform' ? 'platform' : 'tenant'))
const types = ref<DictionaryTypeRecord[]>([])
const items = ref<DictionaryItemRecord[]>([])
const selectedType = ref<DictionaryTypeRecord | null>(null)
const loading = ref(false)
const itemLoading = ref(false)
const saving = ref(false)
const error = ref('')
const itemError = ref('')
const typeDialog = ref(false)
const itemDialog = ref(false)
const editingTypeId = ref('')
const editingItemId = ref('')
const typeForm = reactive({ code: '', name: '', description: '', status: 'ACTIVE', version: 0 })
const itemForm = reactive({ code: '', label: '', value: '', sortOrder: 0, status: 'ACTIVE', version: 0 })

const typeEndpoint = (suffix = '') => `/management/${scope.value}/dictionary-types${suffix}`
const itemEndpoint = (suffix = '') => `/management/${scope.value}/dictionary-items${suffix}`

async function loadTypes() {
  loading.value = true
  error.value = ''
  try {
    types.value = (await apiClient.get(typeEndpoint())) as DictionaryTypeRecord[]
    if (selectedType.value) {
      const current = types.value.find((item) => item.id === selectedType.value?.id)
      selectedType.value = current || null
      if (current) await loadItems()
    }
  } catch (reason) {
    error.value = errorMessage(reason, '字典类型加载失败')
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  if (!selectedType.value) return
  itemLoading.value = true
  itemError.value = ''
  try {
    items.value = (await apiClient.get(`${typeEndpoint(`/${selectedType.value.id}/items`)}`)) as DictionaryItemRecord[]
  } catch (reason) {
    itemError.value = errorMessage(reason, '字典条目加载失败')
  } finally {
    itemLoading.value = false
  }
}

async function selectType(row: DictionaryTypeRecord | null) {
  selectedType.value = row
  items.value = []
  if (row) await loadItems()
}

function openType(row?: DictionaryTypeRecord) {
  editingTypeId.value = row?.id || ''
  Object.assign(typeForm, row || { code: '', name: '', description: '', status: 'ACTIVE', version: 0 })
  typeDialog.value = true
}

async function saveType() {
  if (!typeForm.code.trim() || !typeForm.name.trim()) {
    ElMessage.warning('请完整填写类型编码和名称')
    return
  }
  saving.value = true
  try {
    if (editingTypeId.value) await apiClient.put(typeEndpoint(`/${editingTypeId.value}`), typeForm)
    else await apiClient.post(typeEndpoint(), typeForm)
    ElMessage.success('字典类型已保存')
    typeDialog.value = false
    await loadTypes()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '字典类型保存失败'))
  } finally {
    saving.value = false
  }
}

function openItem(row?: DictionaryItemRecord) {
  if (!selectedType.value) return
  editingItemId.value = row?.id || ''
  Object.assign(itemForm, row || { code: '', label: '', value: '', sortOrder: 0, status: 'ACTIVE', version: 0 })
  itemDialog.value = true
}

async function saveItem() {
  if (!selectedType.value || !itemForm.code.trim() || !itemForm.label.trim()) {
    ElMessage.warning('请完整填写条目编码和显示名称')
    return
  }
  saving.value = true
  try {
    const payload = { ...itemForm, typeId: selectedType.value.id }
    if (editingItemId.value) await apiClient.put(itemEndpoint(`/${editingItemId.value}`), payload)
    else await apiClient.post(itemEndpoint(), payload)
    ElMessage.success('字典条目已保存')
    itemDialog.value = false
    await loadItems()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '字典条目保存失败'))
  } finally {
    saving.value = false
  }
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message
  return fallback
}

onMounted(() => { void loadTypes() })
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.header > div { display: grid; gap: 4px; }
.header small { color: #8a97a8; font-size: 12px; font-weight: 400; }
.items-card { margin-top: 20px; }
.block-error { margin-bottom: 16px; }
</style>
