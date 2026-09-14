<template>
  <el-dialog :model-value="modelValue" title="历史商品与单位复核" width="min(1180px, 96vw)"
    :close-on-click-modal="false" :close-on-press-escape="!applying" :show-close="!applying"
    class="order-product-repair" @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <template v-if="context">
        <div class="repair-heading">
          <strong>{{ context.orderNo }} / {{ context.sourceOrderNo || '-' }}</strong>
        </div>
        <el-table :data="context.lines" row-key="original.id" max-height="240" class="repair-lines"
          @selection-change="selectLines">
          <el-table-column type="selection" width="42" :selectable="selectable" />
          <el-table-column label="行" width="50"><template #default="{ row }">{{ row.original.lineNo }}</template></el-table-column>
          <el-table-column label="原商品 / 规格" min-width="200">
            <template #default="{ row }">{{ row.original.productNameSnapshot || '-' }} / {{ row.original.specificationSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column label="原数量" width="100"><template #default="{ row }">{{ number(row.original.quantity) }}</template></el-table-column>
          <el-table-column label="记录单位" width="110"><template #default="{ row }">{{ unitLabel(row.original.unitCode) }}</template></el-table-column>
          <el-table-column label="成交单价" width="110"><template #default="{ row }">{{ money(row.original.unitPrice) }}</template></el-table-column>
          <el-table-column label="应收金额" width="110"><template #default="{ row }">{{ money(row.original.lineAmount) }}</template></el-table-column>
          <el-table-column label="当前复核" min-width="200">
            <template #default="{ row }">
              <span v-if="Number(row.original.quantity) <= 0">排除行，不可修复</span>
              <template v-else-if="row.repair">
                <div>{{ row.repair.lines[0]?.proposed?.productName }} / {{ row.repair.lines[0]?.proposed?.specification || '默认规格' }}</div>
                <div>历史单位：{{ unitLabel(row.repair.lines[0]?.requested?.historicalTransactionUnitCode, '未核实') }}</div>
                <div v-if="row.repair.lines[0]?.requested?.standardQuantity != null">
                  标准数量：{{ number(row.repair.lines[0].requested.standardQuantity) }} {{ unitLabel(row.repair.lines[0].requested.standardUnitCode) }}
                </div>
              </template>
              <span v-else>未复核</span>
            </template>
          </el-table-column>
        </el-table>

        <el-form :inert="applying || undefined" label-position="top" @submit.prevent="createPreview">
          <el-form-item label="修复原因" required>
            <el-input v-model="reason" maxlength="1000" type="textarea" :rows="2" />
          </el-form-item>
          <section v-for="line in selected" :key="line.original.id" class="repair-line-form">
            <h3>第 {{ line.original.lineNo }} 行 · {{ line.original.productNameSnapshot || '商品待确认' }}</h3>
            <div class="repair-grid">
              <el-form-item label="ERP 商品">
                <el-select v-model="draft(line).selectedProductId" filterable remote clearable :remote-method="searchProducts"
                  :loading="productLoading" placeholder="搜索商品名称" @change="chooseProduct(line)">
                  <el-option v-for="product in productOptions" :key="product.id" :value="product.id" :label="product.productName" />
                </el-select>
              </el-form-item>
              <el-form-item label="ERP 规格">
                <el-select v-model="draft(line).skuCode" :disabled="!draft(line).selectedProductId || productSelecting" clearable>
                  <el-option v-for="variant in variants[String(line.original.id)] || []" :key="variant.id" :value="variant.variantCode"
                    :label="`${variant.specificationSnapshot || '默认规格'} · ${unitLabel(variant.unitCode, '单位未维护')}`" />
                </el-select>
              </el-form-item>
              <el-form-item label="商品对应复核依据" required class="repair-full">
                <el-input v-model="draft(line).bindingEvidence" type="textarea" :rows="2" maxlength="2000" />
              </el-form-item>
              <el-collapse v-if="draft(line).sourceNamespace" class="repair-full">
                <el-collapse-item title="来源商品对应证据（选填）" :name="line.original.id">
                  <el-alert title="来源对应凭证需人工核实。" type="info" :closable="false" />
                  <div class="repair-grid">
                    <el-form-item label="来源商品编码"><el-input v-model="draft(line).sourceProductCode" maxlength="200" readonly /></el-form-item>
                    <el-form-item label="来源对应凭证依据" class="repair-full"><el-input v-model="draft(line).sourceEvidence" maxlength="2000" /></el-form-item>
                    <el-checkbox v-model="draft(line).confirmSourceIdentity" class="repair-full">已人工核对本笔交易对应的来源商品</el-checkbox>
                  </div>
                </el-collapse-item>
              </el-collapse>
              <el-form-item label="凭证确认的历史交易单位">
                <el-select v-model="draft(line).historicalTransactionUnitCode" filterable clearable>
                  <el-option v-for="unit in unitOptions" :key="unit.value" :value="unit.value" :label="unit.label" />
                </el-select>
              </el-form-item>
              <el-form-item label="历史交易单位凭证依据">
                <el-input v-model="draft(line).transactionUnitEvidence" maxlength="2000" />
              </el-form-item>
              <el-checkbox v-model="draft(line).confirmHistoricalTransactionUnit" class="repair-full">
                已核对历史交易单位凭证
              </el-checkbox>
              <el-checkbox v-model="draft(line).includeStandard" class="repair-full">记录经复核的标准计量</el-checkbox>
              <template v-if="draft(line).includeStandard">
                <el-form-item label="标准数量" required><el-input v-model="draft(line).standardQuantity" inputmode="decimal" /></el-form-item>
                <el-form-item label="标准单位" required>
                  <el-select v-model="draft(line).standardUnitCode" filterable clearable>
                    <el-option v-for="unit in unitOptions" :key="unit.value" :value="unit.value" :label="unit.label" />
                  </el-select>
                </el-form-item>
                <el-form-item label="历史换算系数" required><el-input v-model="draft(line).conversionFactor" inputmode="decimal" /></el-form-item>
                <el-form-item label="历史换算证据" required><el-input v-model="draft(line).conversionEvidence" maxlength="2000" /></el-form-item>
                <el-checkbox v-model="draft(line).confirmHistoricalConversion" class="repair-full">已核实历史换算关系与标准数量</el-checkbox>
              </template>
            </div>
          </section>
        </el-form>

        <section v-if="preview" class="repair-preview" data-testid="repair-preview">
          <div class="repair-heading">
            <strong>修复预览</strong>
            <el-tag :type="preview.status === 'READY' ? 'success' : 'danger'">{{ preview.status === 'READY' ? '待确认' : '存在阻断' }}</el-tag>
            <span>有效至 {{ new Date(preview.expiresAt).toLocaleString() }}</span>
          </div>
          <div v-for="line in preview.lines" :key="line.original.id" class="repair-preview-line">
            <strong>第 {{ line.original.lineNo }} 行</strong>
            <div v-for="blocker in line.blockers" :key="blocker" class="repair-blocker">{{ blocker }}</div>
            <div v-if="line.proposed">
              {{ line.original.productNameSnapshot || '原商品待补齐' }} / {{ line.original.specificationSnapshot || '-' }}
              → {{ line.proposed.productName }} · {{ line.proposed.specification || '默认规格' }}
            </div>
            <div v-else-if="line.candidates.length">
              候选：{{ line.candidates.map(c => `${c.productName} / ${c.specification || '默认规格'}`).join('；') }}
            </div>
            <div>原数量 {{ number(line.original.quantity) }} · 记录单位 {{ unitLabel(line.original.unitCode) }} · 历史交易单位 {{ unitLabel(line.requested.historicalTransactionUnitCode, '未核实') }}</div>
            <div v-if="line.requested.standardQuantity != null">标准计量 {{ number(line.requested.standardQuantity) }} {{ unitLabel(line.requested.standardUnitCode) }} · 换算系数 {{ number(line.requested.conversionFactor) }}</div>
            <div>成交单价 {{ money(line.original.unitPrice) }} · 折扣 {{ money(line.original.discountAmount) }} · 应收 {{ money(line.original.lineAmount) }}</div>
            <div>商品依据：{{ line.requested.bindingEvidence || '-' }}</div>
            <div v-if="line.requested.transactionUnitEvidence">单位凭证：{{ line.requested.transactionUnitEvidence }}</div>
            <div v-if="line.requested.conversionEvidence">换算凭证：{{ line.requested.conversionEvidence }}</div>
            <div v-if="line.sourceIdentityStatus === 'OPERATOR_CONFIRMED'">
              来源商品人工确认：{{ line.requested.sourceProductCode || '来源商品记录' }} · {{ line.requested.sourceEvidence }}
            </div>
          </div>
          <el-checkbox v-model="confirmed" :disabled="preview.status !== 'READY' || applying" data-testid="repair-confirm">
            已复核以上商品对应和计量证据，确认应用；保留原数量、单位、价格、金额与收退款事实
          </el-checkbox>
        </section>

        <el-collapse v-if="context.recentRepairs.length" class="repair-history">
          <el-collapse-item title="最近修复记录（最多50次）" name="history">
            <div v-for="record in context.recentRepairs" :key="record.previewId" class="repair-preview-line">
              <div>{{ new Date(record.appliedAt).toLocaleString() }} · 人工复核</div>
              <div v-for="line in record.lines" :key="line.original.id">
                第 {{ line.original.lineNo }} 行 · {{ line.proposed?.productName }} / {{ line.proposed?.specification || '默认规格' }} · {{ line.requested.bindingEvidence }}
                <div v-if="line.requested.transactionUnitEvidence">单位凭证：{{ line.requested.transactionUnitEvidence }}</div>
                <div v-if="line.requested.conversionEvidence">换算凭证：{{ line.requested.conversionEvidence }}</div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="applying" @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button v-if="!context && !loading" :icon="Refresh" @click="load">重新载入</el-button>
      <el-button :icon="View" :loading="previewing" :disabled="!selected.length || !reason.trim() || applying || loading || productSelecting" @click="createPreview">生成预览</el-button>
      <el-button type="primary" :icon="Check" :loading="applying" :disabled="!canApply" @click="apply">确认应用</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Check, Refresh, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { businessDictionaryLabel, businessDictionaryOptions } from '@/utils/business-dictionary'
import type { ErpManagedProductSummary, ErpManagedProductVariant } from '@/api/core/erp-product'
import {
  applyOrderProductRepair, getOrderProductRepair, previewOrderProductRepair,
  getRepairProduct, getRepairProducts,
  type RepairContext, type RepairLineCommand, type RepairPreview, type RepairSourceContext,
} from '@/api/core/order-product-repair'

const props = defineProps<{ modelValue: boolean; orderId: string | number | null; sourceContext?: RepairSourceContext }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; applied: [] }>()
type SourceLine = RepairContext['lines'][number]
type Draft = RepairLineCommand & { includeStandard: boolean; selectedProductId?: string }
const context = ref<RepairContext | null>(null)
const selected = ref<SourceLine[]>([])
const drafts = reactive<Record<string, Draft>>({})
const reason = ref('')
const preview = ref<RepairPreview | null>(null)
const confirmed = ref(false)
const loading = ref(false)
const previewing = ref(false)
const applying = ref(false)
const error = ref('')
const productOptions = ref<ErpManagedProductSummary[]>([])
const variants = reactive<Record<string, ErpManagedProductVariant[]>>({})
const productLoading = ref(false)
const productSelecting = ref(false)
let searchGeneration = 0
const unitOptions = computed(() => businessDictionaryOptions('COMMON', 'PRODUCT_UNIT'))
let generation = 0
let loadGeneration = 0
const canApply = computed(() => preview.value?.status === 'READY' && confirmed.value && !previewing.value && !applying.value)

watch([reason, selected, drafts], () => {
  generation++
  preview.value = null
  confirmed.value = false
}, { deep: true, flush: 'sync' })

watch(() => [props.modelValue, props.orderId, props.sourceContext], () => {
  generation++
  loadGeneration++
  preview.value = null
  confirmed.value = false
  if (props.modelValue && props.orderId != null) void load()
}, { immediate: true })

async function load() {
  if (props.orderId == null) return
  const current = ++loadGeneration
  loading.value = true
  error.value = ''
  context.value = null
  selected.value = []
  await nextTick()
  if (current !== loadGeneration) return
  reason.value = ''
  for (const key of Object.keys(drafts)) delete drafts[key]
  try {
    const result = await getOrderProductRepair(props.orderId)
    if (current !== loadGeneration) return
    for (const line of result.lines) {
      const source = props.sourceContext
      const applies = source && (!source.sourceOrderNo || source.sourceOrderNo === result.sourceOrderNo)
        && (source.lineId ? source.lineId === String(line.original.id) : result.lines.length === 1)
      drafts[String(line.original.id)] = {
        lineId: line.original.id, includeStandard: false,
        ...(applies ? {
          sourceNamespace: source.sourceNamespace, sourceCaptureRef: source.sourceCaptureRef,
          sourceProductRecordId: source.sourceProductRecordId, sourceProductCode: source.sourceProductCode,
        } : {}),
      }
    }
    context.value = result
  } catch (e) {
    if (current === loadGeneration) error.value = message(e)
  } finally {
    if (current === loadGeneration) loading.value = false
  }
}

function draft(line: SourceLine): Draft { return drafts[String(line.original.id)]! }
function selectable(line: SourceLine) { return Number(line.original.quantity) > 0 }
function selectLines(lines: SourceLine[]) {
  if (applying.value) return
  selected.value = lines
  const source = props.sourceContext
  if (!source || source.lineId || lines.length !== 1 || source.sourceOrderNo !== context.value?.sourceOrderNo) return
  const d = draft(lines[0]!)
  if (d.sourceNamespace) return
  d.sourceNamespace = source.sourceNamespace
  d.sourceCaptureRef = source.sourceCaptureRef
  d.sourceProductRecordId = source.sourceProductRecordId
  d.sourceProductCode = source.sourceProductCode
}

async function searchProducts(keyword: string) {
  const current = ++searchGeneration
  productLoading.value = true
  try {
    const result = await getRepairProducts(keyword.trim() || undefined)
    if (current === searchGeneration) productOptions.value = result.items
  } catch (e) { error.value = message(e) }
  finally { if (current === searchGeneration) productLoading.value = false }
}

async function chooseProduct(line: SourceLine) {
  const d = draft(line)
  const id = d.selectedProductId
  d.productCode = undefined
  d.skuCode = undefined
  variants[String(line.original.id)] = []
  if (!id) return
  productSelecting.value = true
  try {
    const product = await getRepairProduct(id)
    if (d.selectedProductId !== id) return
    d.productCode = product.productCode
    variants[String(line.original.id)] = product.variants
  } catch (e) { error.value = message(e) }
  finally { productSelecting.value = false }
}

function command(line: SourceLine): RepairLineCommand {
  const d = draft(line)
  const reviewSource = d.confirmSourceIdentity === true || Boolean(d.sourceEvidence?.trim())
  return {
    lineId: d.lineId, productCode: d.productCode?.trim() || undefined,
    skuCode: d.skuCode?.trim() || undefined, bindingEvidence: d.bindingEvidence?.trim() || undefined,
    ...(reviewSource ? {
      sourceNamespace: d.sourceNamespace?.trim() || undefined, sourceCaptureRef: d.sourceCaptureRef?.trim() || undefined,
      sourceProductRecordId: d.sourceProductRecordId?.trim() || undefined, sourceProductCode: d.sourceProductCode?.trim() || undefined,
      sourceEvidence: d.sourceEvidence?.trim() || undefined, confirmSourceIdentity: d.confirmSourceIdentity === true,
    } : {}),
    historicalTransactionUnitCode: d.historicalTransactionUnitCode?.trim() || undefined,
    transactionUnitEvidence: d.transactionUnitEvidence?.trim() || undefined,
    confirmHistoricalTransactionUnit: d.confirmHistoricalTransactionUnit === true,
    ...(d.includeStandard ? {
      standardQuantity: d.standardQuantity, standardUnitCode: d.standardUnitCode?.trim() || undefined,
      conversionFactor: d.conversionFactor, conversionEvidence: d.conversionEvidence?.trim() || undefined,
      confirmHistoricalConversion: d.confirmHistoricalConversion === true,
    } : {}),
  }
}

async function createPreview() {
  if (!context.value || !selected.value.length || applying.value || previewing.value || productSelecting.value) return
  const current = ++generation
  previewing.value = true
  preview.value = null
  confirmed.value = false
  error.value = ''
  try {
    const result = await previewOrderProductRepair(context.value.orderId, {
      revision: context.value.revision, reason: reason.value.trim(), lines: selected.value.map(command),
    })
    if (current === generation) preview.value = result
  } catch (e) {
    if (current === generation) error.value = message(e)
  } finally { previewing.value = false }
}

async function apply() {
  if (!canApply.value || !preview.value) return
  if (Date.parse(preview.value.expiresAt) <= Date.now()) {
    preview.value = null
    confirmed.value = false
    error.value = '预览已过期，请重新生成'
    return
  }
  applying.value = true
  error.value = ''
  try {
    await applyOrderProductRepair(preview.value.orderId, preview.value.previewId)
    ElMessage.success('修复已应用，原成交和资金事实保持不变')
    emit('applied')
    preview.value = null
    confirmed.value = false
    emit('update:modelValue', false)
  } catch (e) {
    // 保留预览ID，网络结果不明确时用同一幂等键重试；服务端重新校验权限与时效。
    error.value = message(e)
    confirmed.value = false
  } finally { applying.value = false }
}

function message(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message.trim()) {
    return e.message
  }
  return '修复请求失败，请重新载入后核对'
}
function unitLabel(code?: string | null, fallback = '-') {
  if (!code) return fallback
  const label = businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, '单位')
  return label === code && /^[A-Z0-9_]+$/.test(code) ? '待核实' : label
}
function money(value: string | number | null | undefined) {
  return value == null ? '-' : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function number(value: string | number | null | undefined) {
  return value == null ? '-' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}
</script>

<style scoped>
.repair-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
.repair-lines { margin: 16px 0; }
.repair-line-form, .repair-preview { border-top: 1px solid var(--el-border-color); padding-top: 16px; margin-top: 16px; }
.repair-line-form h3 { font-size: 15px; margin: 0 0 12px; overflow-wrap: anywhere; }
.repair-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.repair-full { grid-column: 1 / -1; }
.repair-preview-line { padding: 10px 0; border-bottom: 1px solid var(--el-border-color-lighter); line-height: 1.7; overflow-wrap: anywhere; }
.repair-blocker { color: var(--el-color-danger); }
.repair-history { margin-top: 20px; }
:deep(.el-checkbox) { white-space: normal; height: auto; min-height: 32px; }
:deep(.el-checkbox__label) { white-space: normal; overflow-wrap: anywhere; }
@media (max-width: 640px) { .repair-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
