<template>
  <div class="erp-product-specification-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 商品中心</span>
        <h1>商品规格</h1>
        <p>维护商品多规格和子规格值，用于商品建档、SKU组合和订单选规格。</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增商品规格</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="多规格编号">
          <el-input v-model="filters.specificationCode" clearable placeholder="输入多规格编号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="多规格名称">
          <el-input v-model="filters.specificationName" clearable placeholder="输入多规格名称" style="width: 220px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.statusCode" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="item in specificationStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>商品规格列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          @row-click="openDetail"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column label="多规格名称" min-width="240" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ scope.row.specificationName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="specificationCode" label="多规格编号" width="180" show-overflow-tooltip />
          <el-table-column label="多规格值" min-width="360" show-overflow-tooltip>
            <template #default="scope">{{ specificationValuesText(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.statusCode)" effect="light">
                {{ specificationStatusLabel(scope.row.statusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
              <el-button link type="danger" @click.stop="deleteRow(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无商品规格" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="erp-specification-detail-drawer" size="min(760px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>商品规格详情</span>
            <h2>{{ detail.specificationName || '-' }}</h2>
            <p>{{ detail.specificationCode || '-' }}</p>
          </div>
          <el-button circle plain aria-label="关闭商品规格详情" @click="detailVisible = false">×</el-button>
        </header>

        <div class="detail-summary detail-summary--three">
          <div><span>子规格数量</span><strong>{{ detail.valueCount || 0 }}</strong></div>
          <div><span>状态</span><strong>{{ specificationStatusLabel(detail.statusCode) }}</strong></div>
          <div><span>更新时间</span><strong>{{ formatTime(detail.updatedTime) }}</strong></div>
          <div><span>创建人</span><strong>{{ detail.createdBy || '-' }}</strong></div>
          <div><span>创建时间</span><strong>{{ formatTime(detail.createdTime) }}</strong></div>
          <div><span>更新人</span><strong>{{ detail.updatedBy || '-' }}</strong></div>
        </div>

        <el-table class="supply-scroll-table detail-table" :data="detail.values" max-height="420" size="small">
          <el-table-column prop="valueName" label="子规格名称" min-width="180" fixed="left" show-overflow-tooltip />
          <el-table-column prop="valueCode" label="子规格编号" min-width="160" show-overflow-tooltip />
          <el-table-column prop="ordinal" label="排序值" width="120" />
          <el-table-column label="状态" width="110">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.statusCode)" effect="light">{{ specificationValueStatusLabel(scope.row.statusCode) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <template #empty><el-empty description="暂无子规格" /></template>
        </el-table>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑多规格' : '新增多规格'" width="min(1120px, 95vw)" destroy-on-close>
      <el-form :model="form" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="多规格名称" required>
              <el-input v-model="form.specificationName" clearable placeholder="如 球杆型号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="多规格编号" required>
              <el-input v-model="form.specificationCode" clearable placeholder="如 11、MODEL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.statusCode" clearable placeholder="由后端规则处理" style="width: 100%">
                <el-option v-for="item in specificationStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <section class="form-section">
          <div class="form-section__header">
            <div>
              <h3>多规格值</h3>
              <p>一个多规格下可以维护多个子规格值，删除后保存即做逻辑删除。</p>
            </div>
            <el-button @click="addValue">添加子规格</el-button>
          </div>
          <div class="spec-value-table">
            <div class="spec-value-row spec-value-row--head">
              <span>序号</span>
              <span>子规格名称 <b>*</b></span>
              <span>子规格编号</span>
              <span>排序值</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            <div v-for="(value, index) in form.values" :key="value.localKey" class="spec-value-row">
              <span>{{ index + 1 }}</span>
              <el-input v-model="value.valueName" clearable placeholder="如 10、A300" />
              <el-input v-model="value.valueCode" clearable placeholder="不填则后端生成 V001" />
              <el-input-number v-model="value.ordinal" :min="0" style="width: 100%" />
              <el-select v-model="value.statusCode" clearable placeholder="默认" style="width: 100%">
                <el-option v-for="item in specificationValueStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <el-button link type="danger" @click="removeValue(index)">删除</el-button>
            </div>
          </div>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRow">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createErpProductSpecification,
  deleteErpProductSpecification,
  getErpProductSpecification,
  getErpProductSpecifications,
  updateErpProductSpecification,
  type ErpInternalPage,
  type ErpProductSpecificationCommand,
  type ErpProductSpecificationValueView,
  type ErpProductSpecificationView,
} from '@/api/core/erp-internal'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

interface SpecificationValueForm {
  localKey: string
  id: string | null
  valueCode: string
  valueName: string
  ordinal: number | null
  statusCode: string
}

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const detail = ref<ErpProductSpecificationView | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<ErpInternalPage<ErpProductSpecificationView>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  specificationCode: '',
  specificationName: '',
  statusCode: '',
})

const form = reactive({
  specificationCode: '',
  specificationName: '',
  statusCode: '',
  values: [] as SpecificationValueForm[],
  revision: null as number | null,
})

const specificationStatusOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SPECIFICATION_STATUS'))
const specificationValueStatusOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SPECIFICATION_VALUE_STATUS'))

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'ERP', code: 'PRODUCT_SPECIFICATION_STATUS' },
    { moduleCode: 'ERP', code: 'PRODUCT_SPECIFICATION_VALUE_STATUS' },
  ])
  void loadRows()
})

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getErpProductSpecifications({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      specificationCode: empty(filters.specificationCode),
      specificationName: empty(filters.specificationName),
      statusCode: empty(filters.statusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品规格列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.specificationCode = ''
  filters.specificationName = ''
  filters.statusCode = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

async function openDetail(row: ErpProductSpecificationView) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getErpProductSpecification(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品规格详情加载失败'))
  }
}

async function openEdit(row: ErpProductSpecificationView) {
  try {
    const current = await getErpProductSpecification(row.id)
    editingId.value = current.id
    fillForm(current)
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品规格信息加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  editorVisible.value = true
}

async function saveRow() {
  const command = toCommand()
  if (!command) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateErpProductSpecification(editingId.value, command)
      ElMessage.success('商品规格已保存')
    } else {
      await createErpProductSpecification(command)
      ElMessage.success('商品规格已新增')
    }
    editorVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品规格保存失败'))
  } finally {
    saving.value = false
  }
}

async function deleteRow(row: ErpProductSpecificationView) {
  try {
    await ElMessageBox.confirm(
      `确认删除商品规格“${row.specificationName}”？删除后只做逻辑删除。`,
      '删除商品规格',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
    await deleteErpProductSpecification(row.id, row.revision)
    ElMessage.success('商品规格已删除')
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '商品规格删除失败'))
  }
}

function addValue() {
  form.values.push(emptyValueForm(form.values.length))
}

function removeValue(index: number) {
  if (form.values.length <= 1) {
    ElMessage.warning('至少保留一个子规格')
    return
  }
  form.values.splice(index, 1)
}

function fillForm(row: ErpProductSpecificationView) {
  form.specificationCode = row.specificationCode || ''
  form.specificationName = row.specificationName || ''
  form.statusCode = row.statusCode || ''
  form.values = normalizeValues(row.values)
  form.revision = row.revision ?? null
}

function resetForm() {
  form.specificationCode = ''
  form.specificationName = ''
  form.statusCode = ''
  form.values = [emptyValueForm(0)]
  form.revision = null
}

function normalizeValues(values: ErpProductSpecificationValueView[]): SpecificationValueForm[] {
  if (!values.length) return [emptyValueForm(0)]
  return values.map((value, index) => ({
    localKey: `${value.id || 'new'}-${index}`,
    id: value.id,
    valueCode: value.valueCode || '',
    valueName: value.valueName || '',
    ordinal: value.ordinal ?? index * 100,
    statusCode: value.statusCode || '',
  }))
}

function emptyValueForm(index: number): SpecificationValueForm {
  return {
    localKey: `value-${Date.now()}-${index}-${Math.random()}`,
    id: null,
    valueCode: '',
    valueName: '',
    ordinal: (index + 1) * 100,
    statusCode: '',
  }
}

function toCommand(): ErpProductSpecificationCommand | null {
  if (!form.specificationName.trim()) {
    ElMessage.warning('请输入多规格名称')
    return null
  }
  if (!form.specificationCode.trim()) {
    ElMessage.warning('请输入多规格编号')
    return null
  }
  const values = form.values
    .map((value) => ({
      id: value.id,
      valueCode: empty(value.valueCode),
      valueName: value.valueName.trim(),
      ordinal: value.ordinal ?? 0,
      statusCode: empty(value.statusCode),
    }))
    .filter((value) => value.valueName || value.valueCode)
  if (!values.length || values.some((value) => !value.valueName)) {
    ElMessage.warning('请完善子规格名称')
    return null
  }
  return {
    specificationCode: form.specificationCode.trim(),
    specificationName: form.specificationName.trim(),
    statusCode: empty(form.statusCode),
    values,
    revision: form.revision,
  }
}

function specificationValuesText(row: ErpProductSpecificationView): string {
  const values = row.values.map((item) => item.valueName).filter(Boolean)
  return values.length ? values.join('、') : '-'
}

function specificationStatusLabel(value: string | null | undefined): string {
  return businessDictionaryLabel('ERP', 'PRODUCT_SPECIFICATION_STATUS', value, '规格状态')
}

function specificationValueStatusLabel(value: string | null | undefined): string {
  return businessDictionaryLabel('ERP', 'PRODUCT_SPECIFICATION_VALUE_STATUS', value, '子规格状态')
}

function statusTag(value: string | null | undefined): 'success' | 'info' | 'warning' {
  if (value === 'ACTIVE') return 'success'
  if (value === 'INACTIVE') return 'info'
  return 'warning'
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  return value.replace('T', ' ').replace(/\.\d+Z?$/, '')
}

function empty(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.erp-product-specification-page {
  min-height: 100%;
}

.detail-summary--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.spec-value-table {
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: #fff;
}

.spec-value-row {
  display: grid;
  grid-template-columns: 72px minmax(180px, 1.2fr) minmax(150px, 0.8fr) 140px 130px 90px;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 0;
  }

  b {
    color: $color-danger;
    font-weight: 700;
  }
}

.spec-value-row--head {
  background: $color-bg-muted;
  color: $color-text-secondary;
  font-weight: 700;
}
</style>
