<template>
  <el-dialog v-model="visible" title="导入商品等级价" width="min(880px, 96vw)" destroy-on-close @closed="reset">
    <div class="import-step">
      <p class="step-title">1. 选择文件</p>
      <div class="file-row">
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls,.csv" hidden @change="onFilePicked" />
        <el-button @click="fileInputRef?.click()">选择文件</el-button>
        <span class="file-name">{{ fileName || '支持订货宝导出的 xlsx / csv 文件' }}</span>
      </div>
      <p class="step-hint">
        订货宝后台「商品价格 → 批量导入价格 → 批量导入等级价 → 导出模板」的表格可直接上传，列对应关系在下一步调整。
      </p>
    </div>

    <template v-if="sheet">
      <div class="import-step">
        <p class="step-title">2. 确认列对应关系</p>
        <el-form label-width="100px" class="mapping-form">
          <el-form-item label="商品编码列">
            <el-select v-model="mapping.productCodeColumn" placeholder="选择列" style="width: 280px">
              <el-option
                v-for="(header, index) in sheet.headers"
                :key="index"
                :label="headerLabel(header, index)"
                :value="index"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="规格列">
            <el-select
              v-model="mapping.specificationColumn"
              clearable
              placeholder="未指定（单规格商品可留空）"
              style="width: 280px"
            >
              <el-option
                v-for="(header, index) in sheet.headers"
                :key="index"
                :label="headerLabel(header, index)"
                :value="index"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-for="type in customerTypes" :key="type.code" :label="type.name">
            <el-select v-model="mapping.typeColumns[type.code]" clearable placeholder="不使用该列" style="width: 280px">
              <el-option
                v-for="(header, index) in sheet.headers"
                :key="index"
                :label="headerLabel(header, index)"
                :value="index"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div class="import-step">
        <p class="step-title">3. 预览并导入</p>
        <div class="preview-row">
          <el-button :loading="previewing" @click="runPreview">预览匹配结果</el-button>
          <span v-if="preview" class="preview-summary">
            可导入 <strong>{{ preview.items.length }}</strong> 条价格，覆盖 {{ preview.matchedRows }} 行商品；未匹配
            {{ preview.unmatchedRows.length }} 行<template v-if="preview.invalidCells">；无效价格 {{ preview.invalidCells }} 个</template>
          </span>
        </div>
        <div v-if="preview && preview.unmatchedRows.length" class="unmatched-list">
          <p v-for="row in preview.unmatchedRows.slice(0, 5)" :key="row.rowNumber" class="unmatched-item">
            第 {{ row.rowNumber }} 行 · {{ row.productCode || '空编码' }}：{{ row.reason }}
          </p>
          <p v-if="preview.unmatchedRows.length > 5" class="unmatched-item">
            …其余 {{ preview.unmatchedRows.length - 5 }} 行未展示
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="!preview || preview.items.length === 0"
        :loading="importing"
        @click="submitImport"
      >
        导入 {{ preview ? preview.items.length : 0 }} 条
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Row } from 'exceljs'
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { importErpCustomerTypePrices } from '@/api/core/erp-customer-type-price'
import { getErpManagedProducts } from '@/api/core/erp-product'
import {
  autoMapColumns,
  extractSheetRows,
  matchImportRows,
  parseCsv,
  type ImportColumnMapping,
  type ImportMatchResult,
  type ImportProduct,
  type ParsedSheet,
} from './product-price-import'

interface CustomerTypeOption {
  code: string
  name: string
}

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{ customerTypes: CustomerTypeOption[] }>()
const emit = defineEmits<{ imported: [] }>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const sheet = ref<ParsedSheet | null>(null)
const mapping = ref<ImportColumnMapping>(emptyMapping())
const preview = ref<ImportMatchResult | null>(null)
const previewing = ref(false)
const importing = ref(false)
const products = ref<ImportProduct[] | null>(null)

watch(visible, (value) => {
  if (value) void ensureProducts()
})

function emptyMapping(): ImportColumnMapping {
  return { productCodeColumn: null, specificationColumn: null, typeColumns: {} }
}

async function ensureProducts() {
  if (products.value) return
  try {
    products.value = await loadAllProducts()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品档案加载失败'))
  }
}

async function loadAllProducts(): Promise<ImportProduct[]> {
  const result: ImportProduct[] = []
  let begin = 0
  const step = 200
  for (let page = 0; page < 5; page += 1) {
    const data = await getErpManagedProducts({ begin, step, withVariants: true })
    for (const item of data.items) {
      result.push({
        productCode: item.productCode,
        sourceDocumentNo: item.sourceDocumentNo,
        productName: item.productName,
        variants: (item.variants ?? []).map((variant) => ({
          id: String(variant.id),
          specification: variant.specificationSnapshot,
        })),
      })
    }
    begin += step
    if (begin >= data.total) break
  }
  return result
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (!picked) return
  preview.value = null
  fileName.value = picked.name
  try {
    const parsed = await parseFile(picked)
    if (!parsed.headers.length || !parsed.rows.length) {
      sheet.value = null
      ElMessage.warning('没有读取到有效数据行')
      return
    }
    sheet.value = parsed
    mapping.value = autoMapColumns(parsed, props.customerTypes)
  } catch (reason) {
    sheet.value = null
    ElMessage.error(errorMessage(reason, '文件解析失败，请使用 xlsx 或 csv 格式（xls 请另存为 xlsx）'))
  }
}

async function parseFile(file: File): Promise<ParsedSheet> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return extractSheetRows(parseCsv(await file.text()))
  }
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer as unknown as never)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('文件中没有工作表')
  const matrix: string[][] = []
  worksheet.eachRow({ includeEmpty: false }, (row: Row) => {
    const cells: string[] = []
    for (let index = 1; index <= worksheet.columnCount; index += 1) {
      cells.push(row.getCell(index).text?.trim() ?? '')
    }
    matrix.push(cells)
  })
  return extractSheetRows(matrix)
}

async function runPreview() {
  if (!sheet.value) return
  if (mapping.value.productCodeColumn === null) {
    ElMessage.warning('请先选择商品编码列')
    return
  }
  previewing.value = true
  try {
    await ensureProducts()
    preview.value = matchImportRows(sheet.value, mapping.value, props.customerTypes, products.value ?? [])
    if (!preview.value.items.length) ElMessage.warning('没有匹配到可导入的价格')
  } finally {
    previewing.value = false
  }
}

async function submitImport() {
  const current = preview.value
  if (!current || !current.items.length) return
  importing.value = true
  try {
    let created = 0
    let updated = 0
    for (let index = 0; index < current.items.length; index += 1000) {
      const chunk = current.items.slice(index, index + 1000)
      const result = await importErpCustomerTypePrices(
        chunk.map((item) => ({
          productVariantId: item.productVariantId,
          customerTypeCode: item.customerTypeCode,
          salePrice: item.salePrice,
        })),
      )
      created += result.created
      updated += result.updated
    }
    ElMessage.success(`导入完成：新增 ${created} 条，更新 ${updated} 条`)
    visible.value = false
    emit('imported')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '导入失败'))
  } finally {
    importing.value = false
  }
}

function headerLabel(header: string, index: number): string {
  return header ? header : `第 ${index + 1} 列`
}

function reset() {
  fileName.value = ''
  sheet.value = null
  mapping.value = emptyMapping()
  preview.value = null
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

.import-step + .import-step {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $color-border-lighter;
}

.step-title {
  margin: 0 0 8px;
  font-weight: 600;
  color: $color-text-primary;
}

.step-hint {
  margin: 8px 0 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-name {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.mapping-form {
  :deep(.el-form-item) {
    margin-bottom: 10px;
  }
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-summary {
  color: $color-text-regular;
  font-size: $font-size-xs;
}

.unmatched-item {
  margin: 2px 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
</style>
