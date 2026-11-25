<template>
  <div ref="cell" class="storefront">
    <button
      v-if="url"
      type="button"
      :aria-label="'查看' + storeName + '的门头照'"
      @click="preview = true"
    >
      <img :src="url" alt="门头照" decoding="async" />
    </button>
    <button
      v-else-if="failed"
      type="button"
      class="field-link"
      :title="failureReason"
      @click="load"
    >
      {{ failedLabel }}
    </button>
    <span v-else :title="message === '—' ? '无门头照' : undefined">{{ message }}</span>
    <el-image-viewer
      v-if="preview && url"
      :url-list="[url]"
      teleported
      hide-on-click-modal
      @close="preview = false"
    />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/core/error'
import { evidenceBlob, visitPhotos } from '@/api/core/sales-fieldwork-review'
import { loadBackgroundMedia, useWorkspaceMediaVisibility } from '@/utils/background-media'

const props = defineProps<{ visitId: string; storeName: string }>()
const cell = ref<HTMLElement>()
const url = ref('')
const preview = ref(false)
const failed = ref(false)
const failedLabel = ref('重试')
const failureReason = ref('')
const message = ref('加载中')
let request: AbortController | undefined
let observer: IntersectionObserver | undefined
let evidenceId: string | undefined
const mediaVisible = useWorkspaceMediaVisibility()

async function load() {
  if (!mediaVisible.value || request) return
  const current = new AbortController()
  request = current
  failed.value = false
  try {
    const blob = await loadBackgroundMedia(current.signal, async () => {
      if (!evidenceId) {
        const { photos } = await visitPhotos(props.visitId, current.signal)
        evidenceId = (photos.find((item) => item.evidenceStatus === 'TECHNICALLY_VERIFIED') ??
          photos[0])?.evidenceId
      }
      current.signal.throwIfAborted()
      return evidenceId
        ? evidenceBlob(props.visitId, 'evidence/photos', evidenceId, current.signal)
        : null
    })
    if (current.signal.aborted) return
    if (!blob) {
      message.value = '—'
      return
    }
    url.value = URL.createObjectURL(blob)
  } catch (error) {
    if (current.signal.aborted) return
    if (error instanceof ApiError && error.status === 403) message.value = '无权限'
    else {
      failureReason.value = error instanceof Error ? error.message : '门头照读取失败'
      if (error instanceof ApiError) failureReason.value += '（' + error.code + '）'
      failedLabel.value =
        error instanceof ApiError && error.code === 'SALES_EVIDENCE_STORAGE_FAILED'
          ? '原图读取失败'
          : '重试'
      failed.value = true
    }
  } finally {
    if (request === current) request = undefined
  }
}
function observe() {
  if (!mediaVisible.value || observer || request || !cell.value || url.value || failed.value || message.value !== '加载中') return
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      disconnect()
      void load()
    }
  })
  observer.observe(cell.value)
}
function disconnect() {
  observer?.disconnect()
  observer = undefined
}
function cancel() {
  disconnect()
  request?.abort()
  request = undefined
  preview.value = false
}
onMounted(observe)
onActivated(observe)
onDeactivated(cancel)
watch(mediaVisible, (visible) => { if (visible) observe(); else cancel() }, { flush: 'post' })
onBeforeUnmount(() => {
  cancel()
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<style scoped>
.storefront button {
  display: block;
  font: inherit;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--field-accent);
}
.storefront img {
  display: block;
  width: 64px;
  max-width: 100%;
  height: 42px;
  object-fit: cover;
  border-radius: 4px;
}
</style>
