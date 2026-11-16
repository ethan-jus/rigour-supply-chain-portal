<template>
  <section class="transport-evidence" aria-label="业务凭证">
    <component :is="embedded ? 'h4' : 'h3'"
      ><span v-if="!readonly && required" class="required">*</span
      >{{ required ? '业务凭证' : '补充业务凭证' }}</component
    >
    <p v-if="!readonly" class="hint">
      {{
        required ? '至少上传一份凭证；' : '可补充本次运输的凭证；'
      }}PNG、JPG、PDF、Word（docx）、Excel（xlsx），单个不超过10MB，最多20份。
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="loadError" @click="load">重新加载凭证</el-button>
    <div v-loading="loading" class="evidence-groups">
      <section v-for="category in evidenceCategories" :key="category.code" class="evidence-group">
        <div class="group-heading">
          <h4>{{ category.label }}</h4>
          <el-button
            v-if="!readonly"
            link
            type="primary"
            :disabled="disabled || busy"
            @click="chooseFor(category.code)"
            >上传{{ category.label }}</el-button
          >
        </div>
        <ul v-if="visibleFiles(category.code).length">
          <li v-for="item in visibleFiles(category.code)" :key="item.id">
            <el-button link type="primary" :disabled="disabled" @click="preview(item)">{{
              item.name
            }}</el-button>
            <span class="hint">{{ item.status }}</span>
            <template v-if="!readonly">
              <el-button
                v-if="item.saved"
                link
                type="primary"
                :disabled="disabled || busy"
                @click="chooseFor(category.code, item.saved)"
                >更换</el-button
              >
              <el-button link type="danger" :disabled="disabled || busy" @click="remove(item)">{{
                item.draft?.replaces ? '撤销修改' : '移除'
              }}</el-button>
            </template>
            <el-button
              v-if="item.saved"
              link
              type="primary"
              :disabled="disabled"
              @click="download(item.saved)"
              >下载</el-button
            >
          </li>
        </ul>
        <p v-else class="hint">暂无{{ category.label }}</p>
      </section>
    </div>
    <input
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
import {
  getCostAttachments,
  getCostAttachmentUrl,
  getTransportPdfContent,
  type CostAttachment,
  type CostRecord,
} from '@/api/core/cost'
import { getTransportAttachmentDownloadUrl } from '@/api/core/transport-records'
import { errorMessage } from '@/api/core/error'
import { randomId } from '@/utils/random-id'
import { appendCostAttachmentFiles, type CostAttachmentDraft } from './cost-attachment-draft'
import { evidenceCategories } from './transport-evidence'
import CostFilePreview from './CostFilePreview.vue'
const props = defineProps<{
  row: CostRecord | null
  readonly: boolean
  disabled: boolean
  required: boolean
  embedded?: boolean
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
type Item = {
  id: string
  name: string
  status: string
  saved?: CostAttachment
  draft?: CostAttachmentDraft
}
function visibleFiles(code: string): Item[] {
  return [
    ...remaining.value
      .filter((file) => (file.categoryCode || 'EXPENSE_VOUCHER') === code)
      .map((file) => ({ id: file.id, name: file.fileName, status: '已保存', saved: file })),
    ...changes.value
      .filter(
        (file) => (file.categoryCode || file.replaces?.categoryCode || 'EXPENSE_VOUCHER') === code,
      )
      .map((file) => ({
        id: file.id,
        name: file.file.name,
        draft: file,
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
    if (item.draft && !item.draft.removing) {
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
async function download(file: CostAttachment) {
  if (!props.row) return
  try {
    const url = await getTransportAttachmentDownloadUrl(props.row.id, file.id)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.fileName
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
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
.evidence-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.evidence-group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 16px;
  min-width: 0;
}
.group-heading,
li {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.group-heading {
  justify-content: space-between;
}
h3,
h4 {
  margin: 0 0 12px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  padding: 8px 0;
}
li :deep(.el-button:first-child) {
  max-width: 100%;
  white-space: normal;
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
@media (max-width: 760px) {
  .evidence-groups {
    grid-template-columns: 1fr;
  }
}
</style>
