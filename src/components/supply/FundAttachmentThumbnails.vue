<template>
  <div
    v-if="previewable.length"
    :class="['fund-attachment-thumbnails', `fund-attachment-thumbnails--${size}`]"
  >
    <template v-for="item in previewable" :key="item.objectKey">
      <el-image
        v-if="isImage(item)"
        class="fund-attachment-thumbnails__image"
        :src="item.url || ''"
        :preview-src-list="imageUrls"
        :initial-index="imageUrls.indexOf(item.url || '')"
        fit="cover"
        preview-teleported
      />
      <iframe
        v-else-if="size === 'large' && isPdf(item)"
        class="fund-attachment-thumbnails__frame"
        :src="item.url || ''"
        :title="displayName(item)"
      />
      <el-link
        v-else
        type="primary"
        :href="item.url || undefined"
        target="_blank"
        rel="noopener noreferrer"
        class="fund-attachment-thumbnails__file"
      >
        {{ displayName(item) }}
      </el-link>
    </template>
  </div>
  <span v-else class="fund-attachment-thumbnails__empty">{{ emptyText }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FundDocumentAttachment } from '@/api/core/order-sales'

const props = withDefaults(defineProps<{
  attachments: Array<FundDocumentAttachment | string>
  size?: 'small' | 'large'
  emptyText?: string
}>(), {
  size: 'small',
  emptyText: '-',
})

const items = computed<FundDocumentAttachment[]>(() =>
  (props.attachments || []).flatMap((item) => {
    if (typeof item === 'string') {
      const objectKey = item.trim()
      return objectKey ? [{ objectKey, fileName: null, url: null }] : []
    }
    if (!item || typeof item.objectKey !== 'string' || !item.objectKey.trim()) return []
    return [{
      objectKey: item.objectKey.trim(),
      fileName: typeof item.fileName === 'string' ? item.fileName : null,
      url: typeof item.url === 'string' ? item.url : null,
    }]
  }),
)

const previewable = computed(() => items.value.filter((item) => item.url))
const imageUrls = computed(() =>
  previewable.value.flatMap((item) => (item.url && isImage(item) ? [item.url] : [])),
)

function isImage(item: FundDocumentAttachment) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(displayName(item))
    || /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/i.test(item.objectKey || '')
}

function isPdf(item: FundDocumentAttachment) {
  return /\.pdf$/i.test(displayName(item)) || /\.pdf(?:$|\?)/i.test(item.objectKey || '')
}

function displayName(item: FundDocumentAttachment) {
  return item.fileName || attachmentName(item.objectKey)
}

function attachmentName(value: string | null | undefined) {
  if (!value?.trim()) return '未命名凭证'
  const normalized = value.split('?')[0] || value
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
}
</script>

<style scoped>
.fund-attachment-thumbnails {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.fund-attachment-thumbnails__image {
  border-radius: 4px;
  overflow: hidden;
  cursor: zoom-in;
}
.fund-attachment-thumbnails--small .fund-attachment-thumbnails__image {
  width: 44px;
  height: 44px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
}
.fund-attachment-thumbnails--large {
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.fund-attachment-thumbnails--large .fund-attachment-thumbnails__image {
  max-width: 100%;
  max-height: 560px;
  width: auto;
  height: auto;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 6px;
}
.fund-attachment-thumbnails--large .fund-attachment-thumbnails__image :deep(.el-image__inner) {
  display: block;
  max-width: 100%;
  max-height: 560px;
  width: auto;
  height: auto;
}
.fund-attachment-thumbnails__frame {
  width: 100%;
  height: 560px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}
.fund-attachment-thumbnails__empty {
  color: var(--el-text-color-placeholder);
}
</style>
