<template>
  <section>
    <h3>附件</h3>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p v-if="editable && row.statusCode === 'DRAFT'">
      可选：PNG、JPEG、PDF，每个不超过 10 MB，最多 20 个。上传后保留上传人和时间。
    </p>
    <input
      v-if="editable && row.statusCode === 'DRAFT'"
      type="file"
      accept="image/png,image/jpeg,application/pdf"
      :disabled="loading"
      aria-label="上传费用附件"
      @change="upload"
    />
    <el-table v-loading="loading" :data="files" border empty-text="暂无附件"
      ><el-table-column label="文件"
        ><template #default="{ row: file }"
          ><el-button link type="primary" @click="open(file.id)">{{
            file.fileName
          }}</el-button></template
        ></el-table-column
      ><el-table-column prop="createdBy" label="上传人" min-width="150" /><el-table-column
        prop="createdTime"
        label="上传时间"
        min-width="180"
    /></el-table>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  getCostAttachments,
  uploadCostAttachment,
  getCostAttachmentUrl,
  type CostCategory,
  type CostRecord,
  type CostAttachment,
} from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
const props = defineProps<{ category: CostCategory; row: CostRecord; editable: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const files = ref<CostAttachment[]>([]),
  loading = ref(false),
  error = ref('')
let version = 0
async function load() {
  const v = ++version
  loading.value = true
  error.value = ''
  try {
    const rows = await getCostAttachments(props.category, props.row.id)
    if (v === version) files.value = rows
  } catch (e) {
    if (v === version) error.value = errorMessage(e, '附件加载失败')
  } finally {
    if (v === version) loading.value = false
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  if (
    file.size > 10 * 1024 * 1024 ||
    !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)
  ) {
    error.value = '请选择不超过10MB的 PNG、JPEG 或 PDF 文件'
    input.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    await uploadCostAttachment(props.category, props.row, file)
    emit('changed')
    await load()
  } catch (e) {
    error.value = errorMessage(e, '上传失败')
  } finally {
    loading.value = false
    input.value = ''
  }
}
async function open(id: string) {
  error.value = ''
  try {
    const url = await getCostAttachmentUrl(props.category, props.row.id, id)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  } catch (e) {
    error.value = errorMessage(e, '附件打开失败')
  }
}
watch(
  () => [props.category, props.row.id],
  () => void load(),
  { immediate: true },
)
</script>
