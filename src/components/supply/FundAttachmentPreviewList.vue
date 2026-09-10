<template>
  <div v-if="items.length" :class="['fund-attachment-list', `fund-attachment-list--${direction}`]">
    <div v-for="item in items" :key="item.objectKey" class="fund-attachment-item">
      <span class="fund-attachment-name" :title="displayName(item)">
        {{ displayName(item) }}
      </span>
      <el-button
        v-if="item.url"
        link
        type="primary"
        class="fund-attachment-action"
        @click.stop="openPreview(item)"
      >
        查看
      </el-button>
      <span v-else class="fund-attachment-unavailable">{{ unavailableText }}</span>
    </div>
  </div>
  <span v-else class="fund-attachment-unavailable">{{ emptyText }}</span>

  <el-dialog
    v-model="previewVisible"
    :title="activeTitle"
    width="min(960px, 92vw)"
    class="fund-attachment-preview-dialog"
    append-to-body
  >
    <div v-if="activeAttachment" class="fund-attachment-preview">
      <img
        v-if="shouldRenderImage(activeAttachment)"
        class="fund-attachment-preview-image"
        :src="activeAttachment.url || ''"
        :alt="activeTitle"
        @error="imageLoadFailed = true"
      />
      <iframe
        v-else-if="isPdf(activeAttachment)"
        class="fund-attachment-preview-frame"
        :src="activeAttachment.url || ''"
        :title="activeTitle"
      />
      <div v-else class="fund-attachment-preview-fallback">
        <p>当前文件类型无法内嵌预览。</p>
        <el-button type="primary" @click="openInNewWindow(activeAttachment)">新窗口打开</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FundDocumentAttachment } from '@/api/core/order-sales'

const props = withDefaults(defineProps<{
  attachments: FundDocumentAttachment[]
  direction?: 'row' | 'column'
  emptyText?: string
  unavailableText?: string
}>(), {
  direction: 'column',
  emptyText: '-',
  unavailableText: '待补偿',
})

const previewVisible = ref(false)
const activeAttachment = ref<FundDocumentAttachment | null>(null)
const imageLoadFailed = ref(false)

const items = computed(() => props.attachments || [])
const activeTitle = computed(() => activeAttachment.value ? displayName(activeAttachment.value) : '凭证预览')

function openPreview(item: FundDocumentAttachment) {
  activeAttachment.value = item
  imageLoadFailed.value = false
  previewVisible.value = true
}

function openInNewWindow(item: FundDocumentAttachment) {
  if (!item.url) return
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

function displayName(item: FundDocumentAttachment) {
  return item.fileName || attachmentName(item.objectKey)
}

function isImage(item: FundDocumentAttachment) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(displayName(item))
    || /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/i.test(item.objectKey || '')
}

function isPdf(item: FundDocumentAttachment) {
  return /\.pdf$/i.test(displayName(item)) || /\.pdf(?:$|\?)/i.test(item.objectKey || '')
}

function shouldRenderImage(item: FundDocumentAttachment) {
  if (isImage(item)) return true
  return Boolean(item.url) && !isPdf(item) && !imageLoadFailed.value
}

function attachmentName(value: string) {
  const normalized = value.split('?')[0] || value
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
}
</script>

<style scoped>
.fund-attachment-list {
  display: flex;
  gap: 6px;
}

.fund-attachment-list--row {
  flex-wrap: wrap;
}

.fund-attachment-list--column {
  flex-direction: column;
}

.fund-attachment-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.fund-attachment-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-attachment-action,
.fund-attachment-unavailable {
  flex: 0 0 auto;
}

.fund-attachment-unavailable {
  color: var(--el-text-color-secondary);
}

.fund-attachment-preview {
  min-height: 420px;
  max-height: min(720px, 76vh);
}

.fund-attachment-preview-image {
  display: block;
  width: 100%;
  max-height: min(720px, 76vh);
  object-fit: contain;
}

.fund-attachment-preview-frame {
  display: block;
  width: 100%;
  height: min(720px, 76vh);
  border: 0;
}

.fund-attachment-preview-fallback {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--el-text-color-secondary);
}
</style>
