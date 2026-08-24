<template>
  <section class="management-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">系统管理 · 组织与人员</p>
        <h1>岗位管理</h1>
      </div>
      <div class="page-actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="canWrite" type="primary" :icon="Plus" @click="open()">新增岗位</el-button>
      </div>
    </header>

    <el-table v-loading="loading" :data="positions" row-key="id" class="management-table">
      <el-table-column type="index" label="序号" width="72" />
      <el-table-column prop="code" label="岗位编码" width="160" fixed="left" />
      <el-table-column prop="name" label="岗位名称" min-width="180" />
      <el-table-column prop="description" label="岗位说明" min-width="260">
        <template #default="scope">{{ scope.row.description || '—' }}</template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="100" />
      <el-table-column label="状态" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'">
            {{ statusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="scope">
          <el-button v-if="canWrite" link type="primary" @click="open(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑岗位' : '新增岗位'" width="560px">
      <el-form label-width="96px">
        <el-form-item v-if="editingId" label="岗位编码">
          <el-input v-model="form.code" disabled />
        </el-form-item>
        <el-form-item label="岗位名称" required>
          <el-input v-model="form.name" maxlength="128" />
        </el-form-item>
        <el-form-item label="岗位说明">
          <el-input v-model="form.description" type="textarea" maxlength="500" :rows="4" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import type { PositionRecord } from '@/types/management'

const auth = useAuthStore()
const positions = ref<PositionRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref('')
const form = reactive({
  code: '',
  name: '',
  description: '',
  sortOrder: 0,
  status: 'ACTIVE',
  version: 0,
})

const canWrite = computed(() => auth.hasPermission('iam:position:write'))

async function load() {
  loading.value = true
  try {
    positions.value = (await apiClient.get('/management/tenant/positions')) as PositionRecord[]
  } finally {
    loading.value = false
  }
}

function open(row?: PositionRecord) {
  editingId.value = row?.id || ''
  Object.assign(form, row || {
    code: '',
    name: '',
    description: '',
    sortOrder: 0,
    status: 'ACTIVE',
    version: 0,
  })
  dialogVisible.value = true
}

async function save() {
  try {
    if (!form.name.trim()) throw new Error('请填写岗位名称')
    saving.value = true
    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      sortOrder: form.sortOrder,
      status: form.status,
      version: form.version,
    }
    if (editingId.value) {
      await apiClient.put(`/management/tenant/positions/${editingId.value}`, payload)
    } else {
      await apiClient.post('/management/tenant/positions', payload)
    }
    ElMessage.success('岗位已保存')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '岗位保存失败')
  } finally {
    saving.value = false
  }
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? '启用' : status === 'DISABLED' ? '停用' : status
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.management-page {
  display: grid;
  gap: 18px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.page-kicker {
  margin: 0 0 6px;
  color: #2563eb;
  font-weight: 700;
}

.page-header h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.page-actions {
  display: flex;
  gap: 10px;
}

.management-table {
  border: 1px solid #e2e8f0;
}
</style>
