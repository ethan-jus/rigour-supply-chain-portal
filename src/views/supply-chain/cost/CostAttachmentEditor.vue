<template>
  <section class="attachment-editor" :aria-label="expense ? '报销票据' : '损耗照片与凭证'">
    <h3 v-if="!expense" class="cost-section-title">损耗照片与凭证</h3>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="attachment-actions">
      <el-button
        :disabled="disabled || loading || selecting || !!loadError"
        @click="input?.click()"
      >
        {{ expense ? '添加费用票据' : '添加照片或凭证' }}
      </el-button>
      <input
        ref="input"
        class="file-input"
        type="file"
        multiple
        accept="image/png,image/jpeg,application/pdf"
        :aria-label="expense ? '选择报销票据' : '选择损耗照片或凭证'"
        :disabled="disabled || loading || selecting"
        @change="choose"
      />
      <span class="attachment-limit">PNG、JPEG、PDF；单个不超过 10 MB，最多 20 个</span>
    </div>
    <p v-if="loading" role="status">正在读取已有附件…</p>
    <p v-if="loadError" role="alert">
      {{ loadError }}
      <el-button link type="primary" :disabled="disabled" @click="load">重新加载</el-button>
    </p>
    <ul v-if="existing.length || drafts.length" class="attachment-list">
      <li v-for="file in existing" :key="file.id">
        <el-button link type="primary" :disabled="disabled" @click="openExisting(file.id)">{{
          file.fileName
        }}</el-button>
        <span class="attachment-limit">已保存 · {{ size(file.size) }}</span>
      </li>
      <li v-for="item in drafts" :key="item.id">
        <el-button link type="primary" :disabled="disabled" @click="preview(item.file)">{{
          item.file.name
        }}</el-button>
        <span>{{
          { pending: '待保存', uploading: '上传中…', uploaded: '已保存', failed: '上传失败' }[
            item.status
          ]
        }}</span>
        <span class="attachment-limit">{{ size(item.file.size) }}</span>
        <el-button
          v-if="item.status !== 'uploaded'"
          link
          type="danger"
          :disabled="disabled || selecting"
          @click="remove(item.id)"
          >移除</el-button
        >
        <span v-if="item.error" role="alert" class="attachment-error">{{ item.error }}</span>
      </li>
    </ul>
    <CostFilePreview
      v-model="previewVisible"
      :name="previewName"
      :type="previewType"
      :url="previewUrl"
    />
  </section>
</template>
<script setup lang="ts">
import CostFilePreview from './CostFilePreview.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getCostAttachments,
  getCostAttachmentUrl,
  type CostAttachment,
  type CostCategory,
  type CostRecord,
} from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { appendCostAttachmentFiles, type CostAttachmentDraft } from './cost-attachment-draft'

const props = defineProps<{ category: CostCategory; row: CostRecord | null; disabled: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const selecting = ref(false)
const drafts = defineModel<CostAttachmentDraft[]>({ required: true })
const expense = computed(() => props.category === 'expenses')
const input = ref<HTMLInputElement>()
const files = ref<CostAttachment[]>([]),
  loading = ref(false),
  loadError = ref(''),
  error = ref('')
const existing = computed(() =>
  files.value.filter((file) => !drafts.value.some((item) => item.attachment?.id === file.id)),
)
const previewVisible = ref(false),
  previewName = ref(''),
  previewUrl = ref(''),
  previewType = ref('')
let generation = 0
const size = (value: number) =>
  value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
async function load() {
  const serial = ++generation
  error.value = ''
  loadError.value = ''
  files.value = []
  if (!props.row) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await getCostAttachments(props.category, props.row.id)
    if (serial === generation) files.value = result
  } catch (e) {
    if (serial === generation) loadError.value = errorMessage(e, '已有附件读取失败，请重试')
  } finally {
    if (serial === generation) loading.value = false
  }
}
async function choose(event: Event) {
  const target = event.target as HTMLInputElement,
    selected = [...(target.files || [])]
  if (selecting.value || props.disabled || loading.value || loadError.value) {
    target.value = ''
    return
  }
  const serial = generation
  selecting.value = true
  error.value = ''
  try {
    const result = await appendCostAttachmentFiles(drafts.value, selected, existing.value.length)
    if (serial === generation) drafts.value = result
  } catch (e) {
    if (serial === generation) error.value = errorMessage(e, '文件选择失败')
  } finally {
    selecting.value = false
    target.value = ''
  }
}
function remove(id: string) {
  drafts.value = drafts.value.filter((file) => file.id !== id)
  error.value = ''
}
function preview(file: File) {
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  previewName.value = file.name
  previewType.value = file.type
  previewUrl.value = URL.createObjectURL(file)
  previewVisible.value = true
}
async function openExisting(id: string) {
  if (!props.row) return
  const serial = generation
  try {
    const file = files.value.find((item) => item.id === id)
    if (!file) return
    const url = await getCostAttachmentUrl(props.category, props.row.id, id)
    if (serial !== generation) return
    if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
    previewName.value = file.fileName
    previewType.value = file.contentType
    previewUrl.value = url
    previewVisible.value = true
  } catch (e) {
    error.value = errorMessage(e, '附件打开失败')
  }
}
watch(
  () => loading.value || selecting.value,
  (value) => emit('busy', value),
  { immediate: true },
)
watch(() => [props.category, props.row?.id], load, { immediate: true })
watch(previewVisible, (visible) => {
  if (!visible && previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
})
onBeforeUnmount(() => {
  generation++
  emit('busy', false)
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
})
</script>
<style scoped>
.attachment-editor {
  grid-column: 1 / -1;
  margin: 12px 0;
}
.attachment-actions,
.attachment-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.attachment-list {
  padding: 0;
  margin: 12px 0 0;
  list-style: none;
}
.attachment-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.attachment-list :deep(.el-button) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.file-input {
  display: none;
}
.attachment-limit {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.attachment-error {
  color: var(--el-color-danger);
  flex-basis: 100%;
}
</style>
