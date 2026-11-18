<template>
  <section
    v-if="platform || !hideEmpty || !readonly || loading || loadError || count > 0"
    class="transport-evidence"
    aria-label="业务凭证"
  >
    <h3 v-if="!embedded">
      <span v-if="!readonly && required" class="required">*</span
      >{{ required ? '业务凭证' : '补充业务凭证' }}
    </h3>
    <div v-if="!readonly" class="evidence-toolbar">
      <p class="hint">
        <span v-if="required" class="required">*</span>
        {{
          required ? '至少上传一份凭证；' : '可补充本次运输的凭证；'
        }}支持PNG、JPG、PDF、Word（docx）、Excel（xlsx），手工上传最多20份，每份不超过10MB。
      </p>
      <el-dropdown
        trigger="click"
        :disabled="disabled || busy"
        @command="(code: string) => chooseFor(code)"
      >
        <el-button type="primary" plain :disabled="disabled || busy"
          >上传凭证 <el-icon aria-hidden="true"><ArrowDown /></el-icon
        ></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="category in evidenceCategories"
              :key="category.code"
              :command="category.code"
              >{{ category.label }}</el-dropdown-item
            >
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="loadError" @click="load">重新加载凭证</el-button>
    <p v-if="loading" class="hint" aria-live="polite">正在读取凭证…</p>
    <div class="evidence-groups">
      <section v-for="category in shownCategories" :key="category.code" class="evidence-group">
        <h4>{{ category.label }}</h4>
        <dl v-if="category.code === 'RECEIPT' && platformFacts?.receiptInfo" class="receipt-meta">
          <div v-for="detail in receiptDetails" :key="detail.label">
            <dt>{{ detail.label }}</dt>
            <dd>{{ detail.value }}</dd>
          </div>
        </dl>
        <el-table
          v-if="visibleFiles(category.code).length"
          :data="visibleFiles(category.code)"
          row-key="id"
          border
          scrollbar-always-on
          :aria-label="`${category.label}文件列表`"
        >
          <el-table-column prop="name" label="文件名称" min-width="190" show-overflow-tooltip />
          <el-table-column label="文件来源" width="110">
            <template #default="{ row: item }">
              <span>{{ item.voucher ? '平台同步' : '手工上传' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="category.code !== 'RECEIPT'"
            prop="context"
            :label="category.code === 'EXPENSE_VOUCHER' ? '费用项目' : '收发货地点'"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column prop="status" label="文件状态" min-width="165" />
          <el-table-column label="上传／同步时间" min-width="190">
            <template #default="{ row: item }">{{
              item.draft && !item.time ? '保存后记录上传时间' : dateTime(item.time)
            }}</template>
          </el-table-column>
          <el-table-column label="操作" :width="readonly ? 150 : 230" fixed="right">
            <template #default="{ row: item }">
              <div class="file-actions">
                <el-button
                  v-if="!item.voucher || item.voucher.state === 'READY'"
                  link
                  type="primary"
                  :disabled="disabled"
                  :aria-label="`查看${item.name}`"
                  @click="preview(item as Item)"
                  >查看</el-button
                >
                <el-button
                  v-if="item.saved || item.voucher?.state === 'READY'"
                  link
                  type="primary"
                  :disabled="disabled"
                  :aria-label="`下载${item.name}`"
                  @click="download(item as Item)"
                  >下载</el-button
                >
                <template v-if="!readonly && !item.voucher">
                  <el-button
                    v-if="item.saved"
                    link
                    type="primary"
                    :disabled="disabled || busy"
                    :aria-label="`更换${item.name}`"
                    @click="chooseFor(category.code, item.saved)"
                    >更换</el-button
                  >
                  <el-button
                    link
                    type="danger"
                    :disabled="disabled || busy"
                    :aria-label="`${item.draft?.replaces ? '撤销修改' : '移除'}${item.name}`"
                    @click="remove(item as Item)"
                    >{{ item.draft?.replaces ? '撤销修改' : '移除' }}</el-button
                  >
                </template>
                <span v-if="item.voucher && item.voucher.state !== 'READY'">-</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
    <p v-if="!loading && !loadError && !shownCategories.length" class="hint">暂无凭证与运输影像</p>
    <input
      v-if="!readonly"
      ref="input"
      class="file-input"
      type="file"
      :multiple="!replacement"
      :accept="
        photoCategory ? 'image/png,image/jpeg' : 'image/png,image/jpeg,application/pdf,.docx,.xlsx'
      "
      aria-label="选择业务凭证"
      @change="choose"
    />
    <CostFilePreview
      v-model="previewVisible"
      :name="previewName"
      :type="previewType"
      :url="previewUrl"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import {
  getCostAttachments,
  getCostAttachmentUrl,
  getTransportPdfContent,
  type CostAttachment,
  type CostRecord,
} from '@/api/core/cost'
import {
  getTransportEvidenceContent,
  getTransportVoucher,
  type PlatformTransport,
} from '@/api/core/transport-records'
import { errorMessage } from '@/api/core/error'
import { randomId } from '@/utils/random-id'
import { appendCostAttachmentFiles, type CostAttachmentDraft } from './cost-attachment-draft'
import { evidenceCategories, stopPhotoCategory } from './transport-evidence'
import { currentSource, type PlatformVoucher } from './huolala-source'
import { displayRecordDateTime } from '@/utils/business-display'
import CostFilePreview from './CostFilePreview.vue'
import { downloadBlob } from '@/utils/file-download'
const props = defineProps<{
  row: CostRecord | null
  readonly: boolean
  disabled: boolean
  required: boolean
  embedded?: boolean
  hideEmpty?: boolean
  platform?: PlatformTransport | null
}>()
const changes = defineModel<CostAttachmentDraft[]>({ required: true })
const emit = defineEmits<{ busy: [value: boolean]; count: [value: number] }>()
const files = ref<CostAttachment[]>([]),
  loading = ref(false),
  selecting = ref(false),
  loadError = ref(false),
  error = ref('')
const busy = computed(() => loading.value || selecting.value || loadError.value)
const input = ref<HTMLInputElement>(),
  category = ref('EXPENSE_VOUCHER'),
  replacement = ref<CostAttachment | null>(null)
const photoCategory = computed(() => ['LOADING', 'UNLOADING'].includes(category.value))
const previewVisible = ref(false),
  previewName = ref(''),
  previewType = ref(''),
  previewUrl = ref('')
let generation = 0
const remaining = computed(() =>
  files.value.filter((file) => !changes.value.some((change) => change.replaces?.id === file.id)),
)
const count = computed(
  () => remaining.value.length + changes.value.filter((change) => !change.removing).length,
)
const platformFacts = computed(() =>
  props.platform ? currentSource(props.platform.source).facts : null,
)
type Item = {
  id: string
  name: string
  status: string
  context: string
  time?: string | null
  saved?: CostAttachment
  draft?: CostAttachmentDraft
  voucher?: PlatformVoucher
}
const platformFiles = computed(() => {
  const facts = platformFacts.value
  if (!facts) return []
  const file = (voucher: PlatformVoucher, categoryCode: string, context: string) => ({
    id: `platform:${categoryCode}:${voucher.id}`,
    name: voucher.name,
    status:
      voucher.state === 'READY'
        ? '已保存'
        : voucher.state === 'FAILED'
          ? '获取失败，将自动重试'
          : '待获取',
    context,
    time: voucher.savedAt,
    voucher,
    categoryCode,
  })
  const items = [
    ...facts.fees.flatMap((fee) =>
      (fee.vouchers || []).map((v) => file(v, 'EXPENSE_VOUCHER', fee.name)),
    ),
    ...(facts.billVouchers || []).map((v) => file(v, 'EXPENSE_VOUCHER', '账单')),
    ...(facts.receipts || []).map((v) => file(v, 'RECEIPT', '运输回单')),
    ...(facts.stopPhotos || []).flatMap((point) =>
      point.vouchers.map((v) =>
        file(v, stopPhotoCategory(point.phase), `第${point.stopIndex + 1}站 ${point.name}`),
      ),
    ),
  ]
  return [...new Map(items.map((item) => [item.id, item])).values()]
})
const shownCategories = computed(() =>
  [
    ...evidenceCategories,
    ...(platformFiles.value.some((file) => file.categoryCode === 'OTHER_PHOTO')
      ? [{ code: 'OTHER_PHOTO', label: '其他运输照片' }]
      : []),
  ].filter(
    (category) =>
      visibleFiles(category.code).length ||
      (category.code === 'RECEIPT' && platformFacts.value?.receiptInfo),
  ),
)
const receiptDetails = computed(() => {
  const info = platformFacts.value?.receiptInfo
  if (!info) return []
  const label = (value: number | null, labels: Record<number, string>) =>
    value == null ? '-' : labels[value] || `未知（${value}）`
  return [
    { label: '回单类型', value: label(info.type, { 6: '拍照回单', 3: '纸质回单' }) },
    {
      label: '回单状态',
      value: label(info.status, { 1: '待上报', 2: '司机完成', 3: '已确认', 4: '已取消' }),
    },
    { label: '送回方式', value: label(info.backType, { 1: '开车送回', 2: '快递寄回' }) },
    { label: '回单寄回快递单号', value: info.expressNo || '-' },
    { label: '回单备注', value: info.remark || '-' },
    ...(info.unableToReturn === 1
      ? [{ label: '无法送回原因', value: info.unableReason || '-' }]
      : []),
  ]
})
function dateTime(value?: string | null) {
  return displayRecordDateTime(
    value && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(' ', 'T')}+08:00`
      : value,
  )
}
function visibleFiles(code: string): Item[] {
  return [
    ...platformFiles.value.filter((file) => file.categoryCode === code),
    ...remaining.value
      .filter((file) => (file.categoryCode || 'EXPENSE_VOUCHER') === code)
      .map((file) => ({
        id: `manual:${file.id}`,
        name: file.fileName,
        status: '已保存',
        saved: file,
        context: '-',
        time: file.createdTime,
      })),
    ...changes.value
      .filter(
        (file) => (file.categoryCode || file.replaces?.categoryCode || 'EXPENSE_VOUCHER') === code,
      )
      .map((file) => ({
        id: `draft:${file.id}`,
        name: file.file.name,
        draft: file,
        time: file.attachment?.createdTime,
        context: '-',
        status: file.removing
          ? '待移除'
          : {
              pending: '待保存',
              uploading: '上传中',
              uploaded: '已保存',
              failed: '保存失败，请重试',
            }[file.status],
      })),
  ]
}
async function load() {
  const current = ++generation
  files.value = []
  loadError.value = false
  error.value = ''
  if (!props.row) return
  loading.value = true
  try {
    const result = await getCostAttachments('logistics', props.row.id)
    if (current === generation) files.value = result
  } catch (e) {
    if (current === generation) {
      error.value = errorMessage(e, '凭证读取失败')
      loadError.value = true
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
function chooseFor(code: string, replacing: CostAttachment | null = null) {
  category.value = code
  replacement.value = replacing
  // 等待 accept 和 multiple 更新后再打开系统文件选择框。
  void nextTick(() => input.value?.click())
}
async function choose(event: Event) {
  const target = event.target as HTMLInputElement,
    selected = [...(target.files || [])]
  if (!selected.length || props.disabled || busy.value) {
    target.value = ''
    return
  }
  const current = generation,
    replacing = replacement.value,
    code = category.value
  selecting.value = true
  error.value = ''
  try {
    const fresh = await appendCostAttachmentFiles(
      [],
      selected,
      replacing ? 0 : count.value,
      !photoCategory.value,
    )
    if (photoCategory.value && fresh.some((file) => !file.file.type.startsWith('image/')))
      throw new Error('装卸货照片请选择PNG或JPG图片')
    if (current === generation)
      changes.value = [
        ...changes.value,
        ...fresh.map((file) => ({ ...file, categoryCode: code, replaces: replacing || undefined })),
      ]
  } catch (e) {
    if (current === generation) error.value = errorMessage(e, '文件选择失败')
  } finally {
    selecting.value = false
    target.value = ''
    replacement.value = null
  }
}
function remove(item: Item) {
  if (props.disabled || props.readonly) return
  if (item.draft) changes.value = changes.value.filter((file) => file.id !== item.id)
  else if (item.saved)
    changes.value = [
      ...changes.value,
      {
        id: randomId(),
        file: new File([], item.saved.fileName),
        status: 'pending',
        error: '',
        removing: true,
        replaces: item.saved,
        categoryCode: item.saved.categoryCode || 'EXPENSE_VOUCHER',
      },
    ]
}
async function preview(item: Item) {
  const serial = generation
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  error.value = ''
  try {
    if (item.voucher && props.row) {
      const result = await getTransportVoucher(props.row.id, item.voucher.id)
      if (serial !== generation) return
      previewUrl.value = result.url
      previewName.value = item.name
      previewType.value = item.voucher.contentType || ''
    } else if (item.draft && !item.draft.removing) {
      previewName.value = item.draft.file.name
      previewType.value = item.draft.file.type
      previewUrl.value = URL.createObjectURL(item.draft.file)
    } else {
      const file = item.saved || item.draft?.replaces
      if (!props.row || !file) return
      const url =
        file.contentType === 'application/pdf'
          ? URL.createObjectURL(await getTransportPdfContent(props.row.id, file.id))
          : await getCostAttachmentUrl('logistics', props.row.id, file.id)
      if (serial !== generation) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
        return
      }
      previewUrl.value = url
      previewName.value = file.fileName
      previewType.value = file.contentType
    }
    previewVisible.value = true
  } catch (e) {
    error.value = errorMessage(e, '凭证打开失败，请重试')
  }
}
async function download(item: Item) {
  if (!props.row) return
  try {
    const content = item.voucher
      ? await getTransportEvidenceContent(props.row.id, item.voucher.id, true)
      : item.saved
        ? await getTransportEvidenceContent(props.row.id, item.saved.id)
        : null
    if (content) downloadBlob(content, item.name)
  } catch (e) {
    error.value = errorMessage(e, '凭证下载失败，请重试')
  }
}
watch(busy, (value) => emit('busy', value), { immediate: true })
watch(count, (value) => emit('count', value), { immediate: true })
watch(previewVisible, (value) => {
  if (!value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
})
watch(() => props.row?.id, load, { immediate: true })
onBeforeUnmount(() => {
  generation++
  emit('busy', false)
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
})
</script>
<style scoped>
.evidence-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.evidence-toolbar .hint {
  flex: 1 1 320px;
  margin: 0;
}
.evidence-groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.evidence-group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 16px;
  min-width: 0;
}
h3,
h4 {
  margin: 0 0 12px;
}
.file-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
.file-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.receipt-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: 16px;
  margin: 0 0 16px;
}
.receipt-meta dt {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.receipt-meta dd {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.required {
  color: var(--el-color-danger);
  margin-right: 6px;
}
.file-input {
  display: none;
}
</style>
