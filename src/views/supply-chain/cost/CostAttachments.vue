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
      ><el-table-column label="上传人" min-width="150"
        ><template #default="{ row: file }">{{
          auditActorLabel(file.createdBy)
        }}</template></el-table-column
      ><el-table-column label="上传时间" min-width="180"
        ><template #default="{ row: file }">{{
          displayDateTime(file.createdTime)
        }}</template></el-table-column
      ></el-table
    >
    <CostFilePreview
      v-model="previewVisible"
      :name="previewName"
      :type="previewType"
      :url="previewUrl"
    />
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onDeactivated, onActivated } from 'vue'
import CostFilePreview from './CostFilePreview.vue'
import {
  getCostAttachments,
  uploadCostAttachment,
  getCostAttachmentUrl,
  type CostCategory,
  type CostRecord,
  type CostAttachment,
} from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { displayRecordActor as auditActorLabel } from '@/utils/business-display'
import { displayRecordDateTime as displayDateTime } from '@/utils/business-display'
const props = defineProps<{ category: CostCategory; row: CostRecord; editable: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const files = ref<CostAttachment[]>([]),
  loading = ref(false),
  error = ref('')
const previewVisible = ref(false),
  previewName = ref(''),
  previewType = ref(''),
  previewUrl = ref('')
let previewRequest = 0
let version = 0
let inactive = false
onDeactivated(() => {
  inactive = true
  previewRequest++
  version++
  previewVisible.value = false
  previewUrl.value = ''
  loading.value = false
})
onActivated(() => {
  if (inactive) {
    inactive = false
    void load()
  }
})
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
  const request = version,
    category = props.category,
    record = props.row
  try {
    await uploadCostAttachment(category, record, file)
    if (inactive || request !== version) return
    emit('changed')
    await load()
  } catch (e) {
    if (!inactive && request === version) error.value = errorMessage(e, '上传失败')
  } finally {
    if (!inactive && request === version) loading.value = false
    input.value = ''
  }
}
async function open(id: string) {
  const file = files.value.find((item) => item.id === id)
  if (!file) return
  const request = ++previewRequest
  error.value = ''
  try {
    const url = await getCostAttachmentUrl(props.category, props.row.id, file.id)
    if (inactive || request !== previewRequest) return
    previewName.value = file.fileName
    previewType.value = file.contentType
    previewUrl.value = url
    previewVisible.value = true
  } catch (e) {
    if (!inactive && request === previewRequest) error.value = errorMessage(e, '附件打开失败')
  }
}
onBeforeUnmount(() => {
  inactive = true
  version++
  previewRequest++
})

watch(
  () => [props.category, props.row.id],
  () => {
    previewRequest++
    previewVisible.value = false
    void load()
  },
  { immediate: true },
)
</script>
