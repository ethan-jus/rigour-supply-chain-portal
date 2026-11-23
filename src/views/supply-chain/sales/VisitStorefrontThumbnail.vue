<template>
  <div ref="cell" class="storefront">
    <button
      v-if="url"
      type="button"
      :aria-label="'查看' + storeName + '的门头照'"
      @click="preview = true"
    >
      <img :src="url" alt="门头照" />
    </button>
    <button v-else-if="failed" type="button" class="field-link" @click="load">重试</button>
    <span v-else>{{ message }}</span>
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
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ApiError } from '@/api/core/error'
import { evidenceBlob, visitPhotos } from '@/api/core/sales-fieldwork-review'

const props = defineProps<{ visitId: string; storeName: string }>()
const cell = ref<HTMLElement>()
const url = ref('')
const preview = ref(false)
const failed = ref(false)
const message = ref('加载中')
const request = new AbortController()
let observer: IntersectionObserver | undefined

async function load() {
  failed.value = false
  try {
    const { photos } = await visitPhotos(props.visitId, request.signal)
    const photo = photos.find((item) => item.evidenceStatus === 'TECHNICALLY_VERIFIED') ?? photos[0]
    if (!photo) {
      message.value = '暂无'
      return
    }
    const blob = await evidenceBlob(
      props.visitId,
      'evidence/photos',
      photo.evidenceId,
      request.signal,
    )
    if (!request.signal.aborted) url.value = URL.createObjectURL(blob)
  } catch (error) {
    if (request.signal.aborted) return
    if (error instanceof ApiError && error.status === 403) message.value = '无权限'
    else failed.value = true
  }
}
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer?.disconnect()
      void load()
    }
  })
  observer.observe(cell.value!)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  request.abort()
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<style scoped>
.storefront {
  font-size: 12px;
  color: var(--field-muted);
}
.storefront button {
  display: inline-flex;
  vertical-align: middle;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--field-accent);
}
.storefront img {
  display: block;
  width: 48px;
  max-width: 100%;
  height: 36px;
  object-fit: cover;
  border-radius: 3px;
}
</style>
