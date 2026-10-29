<template>
  <div class="supply-page position-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>岗位管理</SupplyPageTitle>
      </div>
      <el-button v-if="can('hr:position:write')" type="primary" @click="openEditor()"
        >新增岗位</el-button
      >
    </div>
    <el-form inline @submit.prevent="search">
      <el-form-item label="岗位编码"
        ><el-input v-model="filters.positionCode" clearable placeholder="请输入岗位编码"
      /></el-form-item>
      <el-form-item label="岗位名称"
        ><el-input v-model="filters.positionName" clearable placeholder="请输入岗位名称"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select
          v-model="filters.statusCode"
          clearable
          placeholder="全部状态"
          style="width: 140px"
          ><el-option label="正常" value="ACTIVE" /><el-option
            label="停用"
            value="INACTIVE" /></el-select
      ></el-form-item>
      <el-form-item
        ><el-button type="primary" native-type="submit">查询</el-button
        ><el-button @click="reset">重置</el-button
        ><el-button :loading="loading" @click="load">刷新</el-button></el-form-item
      >
    </el-form>
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" />
    <el-table
      v-loading="loading"
      :data="page.items"
      row-key="id"
      class="business-table supply-scroll-table"
      border
    >
      <el-table-column type="index" label="序号" width="72" fixed="left" :index="rowIndex" />
      <el-table-column
        prop="positionCode"
        label="岗位编码"
        min-width="180"
        show-overflow-tooltip
        :formatter="displayCell"
      />
      <el-table-column
        prop="positionName"
        label="岗位名称"
        min-width="140"
        :formatter="displayCell"
      />
      <el-table-column prop="sortOrder" label="岗位顺序" width="100" :formatter="displayCell" />
      <el-table-column label="状态" width="95"
        ><template #default="{ row }"
          ><el-tag :type="row.statusCode === 'ACTIVE' ? 'success' : 'info'">{{
            row.statusCode === 'ACTIVE' ? '正常' : '停用'
          }}</el-tag></template
        ></el-table-column
      >
      <!-- @vue-generic {HrPositionRecord} -->
      <el-table-column label="操作" width="180" fixed="right"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detailRecord = row as HrPositionRecord"
            >查看</el-button
          >
          <el-button v-if="can('hr:position:write')" link type="primary" @click="openEditor(row)"
            >编辑</el-button
          >
          <el-button v-if="can('hr:position:write')" link type="danger" @click="remove(row)"
            >删除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="page.total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      @current-change="load"
      @size-change="search"
    />
    <el-dialog
      :model-value="!!detailRecord"
      title="岗位详情"
      width="min(800px,94vw)"
      class="business-detail-panel"
      @close="detailRecord = null"
    >
      <dl v-if="detailRecord" class="business-detail-fields">
        <div>
          <dt>岗位名称</dt>
          <dd>{{ detailRecord.positionName }}</dd>
        </div>
        <div>
          <dt>岗位编码</dt>
          <dd>{{ detailRecord.positionCode }}</dd>
        </div>
        <div>
          <dt>显示顺序</dt>
          <dd>{{ detailRecord.sortOrder }}</dd>
        </div>
        <div>
          <dt>岗位状态</dt>
          <dd>{{ detailRecord.statusCode === 'ACTIVE' ? '正常' : '停用' }}</dd>
        </div>
        <div>
          <dt>岗位职责</dt>
          <dd>{{ detailRecord.remark || '-' }}</dd>
        </div>
        <div>
          <dt>创建人</dt>
          <dd>{{ auditActorLabel(detailRecord.createdBy) }}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ displayDateTime(detailRecord.createdTime) }}</dd>
        </div>
        <div>
          <dt>修改人</dt>
          <dd>{{ auditActorLabel(detailRecord.updatedBy) }}</dd>
        </div>
        <div>
          <dt>修改时间</dt>
          <dd>{{ displayDateTime(detailRecord.updatedTime) }}</dd>
        </div>
      </dl>
    </el-dialog>
    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑岗位' : '新增岗位'"
      width="min(560px, calc(100vw - 32px))"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" @submit.prevent="save">
        <el-form-item label="岗位名称" prop="positionName"
          ><el-input v-model="form.positionName" placeholder="请输入岗位名称" maxlength="120"
        /></el-form-item>
        <el-form-item label="岗位编码" prop="positionCode"
          ><el-input
            v-model="form.positionCode"
            placeholder="字母、数字、下划线或短横线"
            maxlength="50"
        /></el-form-item>
        <el-form-item label="岗位顺序" prop="sortOrder"
          ><el-input-number
            v-model="form.sortOrder"
            :min="0"
            :max="2147483647"
            :precision="0"
            controls-position="right"
        /></el-form-item>
        <el-form-item label="岗位状态"
          ><el-radio-group v-model="form.statusCode"
            ><el-radio value="ACTIVE">正常</el-radio
            ><el-radio value="INACTIVE">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-form-item label="岗位职责"
          ><el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            placeholder="请输入岗位职责"
        /></el-form-item>
        <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      </el-form>
      <template #footer
        ><el-button type="primary" :loading="saving" @click="save">确定</el-button
        ><el-button :disabled="saving" @click="editorVisible = false">取消</el-button></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { displayCell } from '@/utils/business-display'
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayRecordActor as auditActorLabel } from '@/utils/business-display'
import { displayRecordDateTime as displayDateTime } from '@/utils/business-display'
import {
  createHrPosition,
  updateHrPosition,
  deleteHrPosition,
  getHrPositions,
  type HrPositionRecord,
  type HrPage,
} from '@/api/core/hr'
const { can } = useSupplyPermissions()
const detailRecord = ref<HrPositionRecord | null>(null)
const loading = ref(false),
  saving = ref(false),
  editorVisible = ref(false)
const loadError = ref(''),
  saveError = ref(''),
  editingId = ref<string | null>(null)
const currentPage = ref(1),
  pageSize = ref(20)
const page = ref<HrPage<HrPositionRecord>>({ items: [], total: 0, begin: 0, step: 20 })
const filters = reactive({ positionCode: '', positionName: '', statusCode: '' })
const form = reactive({
  positionName: '',
  positionCode: '',
  sortOrder: 0,
  statusCode: 'ACTIVE',
  remark: '',
  revision: 0,
})
const formRef = ref<FormInstance>()
const rules: FormRules = {
  positionName: [{ required: true, whitespace: true, message: '请输入岗位名称', trigger: 'blur' }],
  positionCode: [
    { required: true, message: '请输入岗位编码', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/,
      message: '编码只能使用字母、数字、下划线和短横线',
      trigger: 'blur',
    },
  ],
  sortOrder: [
    { required: true, type: 'number', min: 0, message: '请输入岗位顺序', trigger: 'change' },
  ],
}
let requestId = 0
async function load() {
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const result = await getHrPositions({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      positionCode: filters.positionCode.trim() || undefined,
      positionName: filters.positionName.trim() || undefined,
      statusCode: filters.statusCode || undefined,
    })
    if (id === requestId) page.value = result
  } catch (error) {
    if (id === requestId) {
      page.value.items = []
      loadError.value = message(error, '岗位加载失败')
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}
function search() {
  currentPage.value = 1
  void load()
}
function reset() {
  Object.assign(filters, { positionCode: '', positionName: '', statusCode: '' })
  search()
}
const rowIndex = (index: number) => (currentPage.value - 1) * pageSize.value + index + 1
function openEditor(row?: HrPositionRecord) {
  editingId.value = row ? String(row.id) : null
  Object.assign(form, {
    positionName: row?.positionName ?? '',
    positionCode: row?.positionCode ?? '',
    sortOrder: row?.sortOrder ?? 0,
    statusCode: row?.statusCode ?? 'ACTIVE',
    remark: row?.remark ?? '',
    revision: row?.revision ?? 0,
  })
  saveError.value = ''
  editorVisible.value = true
}
async function save() {
  if (saving.value || !(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  saveError.value = ''
  const command = {
    ...form,
    positionName: form.positionName.trim(),
    positionCode: form.positionCode.trim(),
  }
  try {
    if (editingId.value) await updateHrPosition(editingId.value, command)
    else await createHrPosition(command)
    editorVisible.value = false
    ElMessage.success('岗位已保存')
    await load()
  } catch (error) {
    saveError.value = message(error, '岗位保存失败')
  } finally {
    saving.value = false
  }
}
async function remove(row: HrPositionRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除“${row.positionName}”？已有员工或任职记录使用的岗位不能删除，可改为停用。`,
      '删除岗位',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deleteHrPosition(row.id, row.revision)
    if (page.value.items.length === 1 && currentPage.value > 1) currentPage.value--
    ElMessage.success('岗位已删除')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(message(error, '岗位删除失败'))
  }
}
function message(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message || fallback)
    : fallback
}
onMounted(load)
</script>
<style scoped>
.position-page {
  min-width: 0;
}
.el-pagination {
  margin-top: 18px;
  justify-content: flex-end;
}
.el-alert {
  margin-bottom: 16px;
}
</style>
