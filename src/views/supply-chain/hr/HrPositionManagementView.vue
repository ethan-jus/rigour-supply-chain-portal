<template>
  <div class="hr-position-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">HR · 岗位职位</span>
        <h1>岗位职位</h1>
        <p>查看员工导入和后续HR维护产生的岗位、职位和来源信息。</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增岗位/职位</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadPositions">刷新</el-button>
      </div>
    </div>

    <section class="metric-grid" aria-label="岗位职位概览">
      <div class="metric-item">
        <span>当前查询</span>
        <strong>{{ pageData.total }}</strong>
      </div>
      <div class="metric-item">
        <span>岗位分类</span>
        <strong>{{ categoryCount }}</strong>
      </div>
      <div class="metric-item">
        <span>职位</span>
        <strong>{{ titleCount }}</strong>
      </div>
      <div class="metric-item">
        <span>飞书来源</span>
        <strong>{{ feishuCount }}</strong>
      </div>
    </section>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="submitSearch">
        <el-form-item label="岗位职位编号">
          <el-input v-model="filters.positionCode" clearable placeholder="输入编号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="岗位职位名称">
          <el-input
            v-model="filters.positionName"
            clearable
            placeholder="销售/城市总/销售员"
            :prefix-icon="Search"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filters.positionType" clearable placeholder="全部类型" style="width: 150px">
            <el-option label="岗位" value="JOB_CATEGORY" />
            <el-option label="职位" value="JOB_TITLE" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.statusCode" clearable placeholder="全部状态" style="width: 130px">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filters.sourceSystem" clearable placeholder="全部来源" style="width: 140px">
            <el-option label="飞书" value="FEISHU" />
            <el-option label="订货宝" value="DINGHUOBAO" />
            <el-option label="人工维护" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>岗位职位列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <el-table
        class="business-table supply-scroll-table"
        v-loading="loading"
        :data="pageData.items"
        row-key="id"
        border
        max-height="620"
        @row-click="openDetail"
      >
        <el-table-column type="index" label="序号" width="76" fixed="left" :index="tableRowIndex" />
        <el-table-column prop="positionCode" label="编号" width="170" fixed="left" show-overflow-tooltip />
        <el-table-column prop="positionName" label="名称" min-width="180" fixed="left" show-overflow-tooltip>
          <template #default="scope">
            <span class="record-name">{{ scope.row.positionName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="positionType" label="类型" width="130">
          <template #default="scope">{{ positionTypeLabel(scope.row.positionType) }}</template>
        </el-table-column>
        <el-table-column prop="statusCode" label="状态" width="110">
          <template #default="scope">
            <el-tag :type="statusTag(scope.row.statusCode)" effect="light">
              {{ statusLabel(scope.row.statusCode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceSystem" label="来源" width="110">
          <template #default="scope">
            <el-tag :type="sourceTag(scope.row.sourceSystem)" effect="plain">
              {{ sourceLabel(scope.row.sourceSystem) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="176" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
            <el-button link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" @click.stop="deletePosition(scope.row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无岗位职位" />
        </template>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadPositions"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑岗位/职位' : '新增岗位/职位'" width="min(620px, 92vw)" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="form.positionName" clearable placeholder="如 销售、城市总、销售员" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.positionType" placeholder="选择类型" style="width: 100%">
            <el-option label="岗位" value="JOB_CATEGORY" />
            <el-option label="职位" value="JOB_TITLE" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.statusCode" placeholder="选择状态" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="form.sourceSystem" placeholder="选择来源" style="width: 100%">
            <el-option label="人工维护" value="MANUAL" />
            <el-option label="飞书" value="FEISHU" />
            <el-option label="订货宝" value="DINGHUOBAO" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePosition">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" class="hr-position-detail-drawer" size="min(680px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>岗位职位详情</span>
            <h2>{{ detail.positionName }}</h2>
            <p>{{ detail.positionCode }} · {{ positionTypeLabel(detail.positionType) }}</p>
          </div>
          <el-button :icon="Close" circle plain aria-label="关闭岗位职位详情" @click="detailVisible = false" />
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="编号">{{ detail.positionCode }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ detail.positionName }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ positionTypeLabel(detail.positionType) }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ statusLabel(detail.statusCode) }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ sourceLabel(detail.sourceSystem) }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ detail.revision ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.createdTime) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <el-skeleton v-else :rows="6" animated />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Refresh, Search } from '@element-plus/icons-vue'
import {
  createHrPosition,
  deleteHrPosition,
  getHrPosition,
  getHrPositions,
  updateHrPosition,
  type HrPage,
  type HrPositionCommand,
  type HrPositionRecord,
} from '@/api/core/hr'

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const detail = ref<HrPositionRecord | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<HrPage<HrPositionRecord>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  positionCode: '',
  positionName: '',
  positionType: '',
  statusCode: '',
  sourceSystem: '',
})

const form = reactive({
  positionName: '',
  positionType: 'JOB_CATEGORY',
  statusCode: 'ACTIVE',
  sourceSystem: 'MANUAL',
  remark: '',
  revision: null as number | null,
})

const categoryCount = computed(() => pageData.value.items.filter((item) => item.positionType === 'JOB_CATEGORY').length)
const titleCount = computed(() => pageData.value.items.filter((item) => item.positionType === 'JOB_TITLE').length)
const feishuCount = computed(() => pageData.value.items.filter((item) => item.sourceSystem === 'FEISHU').length)

onMounted(() => {
  void loadPositions()
})

async function loadPositions() {
  loading.value = true
  try {
    pageData.value = await getHrPositions({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      positionCode: empty(filters.positionCode),
      positionName: empty(filters.positionName),
      positionType: empty(filters.positionType),
      statusCode: empty(filters.statusCode),
      sourceSystem: empty(filters.sourceSystem),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '岗位职位加载失败'))
  } finally {
    loading.value = false
  }
}

function submitSearch() {
  currentPage.value = 1
  void loadPositions()
}

function resetFilters() {
  filters.positionCode = ''
  filters.positionName = ''
  filters.positionType = ''
  filters.statusCode = ''
  filters.sourceSystem = ''
  currentPage.value = 1
  void loadPositions()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadPositions()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

async function openDetail(row: HrPositionRecord) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getHrPosition(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '岗位职位详情加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  editorVisible.value = true
}

function openEdit(row: HrPositionRecord) {
  editingId.value = row.id
  form.positionName = row.positionName || ''
  form.positionType = row.positionType || 'JOB_CATEGORY'
  form.statusCode = row.statusCode || 'ACTIVE'
  form.sourceSystem = row.sourceSystem || 'MANUAL'
  form.remark = row.remark || ''
  form.revision = row.revision
  editorVisible.value = true
}

async function savePosition() {
  const command = buildCommand()
  if (!command) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateHrPosition(editingId.value, command)
      ElMessage.success('岗位/职位已保存')
    } else {
      await createHrPosition(command)
      ElMessage.success('岗位/职位已新增')
    }
    editorVisible.value = false
    await loadPositions()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '岗位/职位保存失败'))
  } finally {
    saving.value = false
  }
}

async function deletePosition(row: HrPositionRecord) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.positionName}」？已被员工引用时后端会拒绝删除。`, '删除岗位/职位', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteHrPosition(row.id, row.revision)
    ElMessage.success('岗位/职位已删除')
    await loadPositions()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '岗位/职位删除失败'))
  }
}

function buildCommand(): HrPositionCommand | null {
  if (!form.positionName.trim()) {
    ElMessage.warning('请输入岗位/职位名称')
    return null
  }
  if (!form.positionType) {
    ElMessage.warning('请选择类型')
    return null
  }
  return {
    positionName: form.positionName.trim(),
    positionType: form.positionType,
    statusCode: form.statusCode || 'ACTIVE',
    sourceSystem: form.sourceSystem || 'MANUAL',
    remark: empty(form.remark),
    revision: editingId.value ? form.revision : null,
  }
}

function resetForm() {
  form.positionName = ''
  form.positionType = 'JOB_CATEGORY'
  form.statusCode = 'ACTIVE'
  form.sourceSystem = 'MANUAL'
  form.remark = ''
  form.revision = null
}

function positionTypeLabel(value: string | null | undefined) {
  if (value === 'JOB_CATEGORY') return '岗位'
  if (value === 'JOB_TITLE') return '职位'
  return value || '-'
}

function statusLabel(value: string | null | undefined) {
  if (value === 'ACTIVE') return '启用'
  if (value === 'INACTIVE') return '停用'
  return value || '-'
}

function statusTag(value: string | null | undefined) {
  return value === 'ACTIVE' ? 'success' : 'info'
}

function sourceLabel(value: string | null | undefined) {
  if (value === 'FEISHU') return '飞书'
  if (value === 'DINGHUOBAO') return '订货宝'
  if (value === 'MANUAL') return '人工维护'
  return value || '-'
}

function sourceTag(value: string | null | undefined) {
  if (value === 'FEISHU') return 'success'
  if (value === 'DINGHUOBAO') return 'warning'
  return 'info'
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.hr-position-page {
  min-height: 0;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric-item {
  min-height: 88px;
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;

  span {
    display: block;
    margin-bottom: 8px;
    color: #64748b;
    font-size: 13px;
  }

  strong {
    color: #0f172a;
    font-size: 28px;
    font-weight: 700;
  }
}

.filter-card,
.list-card {
  border-radius: 8px;
  border-color: #e2e8f0;
}

.filter-card {
  margin-bottom: 18px;
}

.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
}

.result-title-line {
  display: flex;
  align-items: baseline;
  gap: 10px;

  h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.3;
  }
}

.result-count {
  color: #64748b;
  font-size: 13px;
}

.record-name {
  color: #0f172a;
  font-weight: 600;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.detail-shell {
  min-height: 100%;
  background: #fff;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-bottom: 1px solid #e2e8f0;

  span {
    color: #0f766e;
    font-size: 13px;
    font-weight: 700;
  }

  h2 {
    margin: 8px 0 6px;
    color: #0f172a;
    font-size: 24px;
  }

  p {
    margin: 0;
    color: #64748b;
  }
}

.detail-content {
  padding: 20px 24px;
}

@media (max-width: 960px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
