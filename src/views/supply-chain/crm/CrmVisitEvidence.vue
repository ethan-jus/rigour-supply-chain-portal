<template>
  <el-button v-if="canPhoto || canAudio" link type="primary" @click="openEvidence"
    >查看采集证据</el-button
  >
  <el-dialog v-model="open" title="拜访采集证据" width="640px" append-to-body @closed="clear">
    <p>照片、录音来自销售工作台原始采集记录，核验结论在 CRM 中处理。</p>
    <p v-if="loading">正在读取证据…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <section v-if="canPhoto && photos">
      <h4>
        门头照片 · 已核验 {{ photos.verifiedStorefrontPhotoCount }} / 要求
        {{ photos.requiredStorefrontPhotoCount }}
      </h4>
      <p v-if="!photos.photos.length">尚未上传门头照片</p>
      <div v-for="photo in photos.photos" :key="photo.evidenceId" class="evidence-item">
        <p>
          {{ time(photo.capturedAt) }} · 距门店 {{ photo.distanceToTargetMeters ?? '未知' }} 米 ·
          {{ photo.evidenceStatus === 'TECHNICALLY_VERIFIED' ? '技术校验通过' : '待校验' }}
        </p>
        <el-button
          v-if="!urls[photo.evidenceId]"
          :loading="loadingMedia === photo.evidenceId"
          @click="loadMedia(photo.evidenceId, 'photo')"
          >查看照片</el-button
        >
        <img v-else :src="urls[photo.evidenceId]" alt="本次拜访采集的门头照片" />
      </div>
    </section>
    <section v-if="canAudio && recordings">
      <h4>录音 · {{ recordings.clipCount }} 段</h4>
      <p v-if="!recordings.clips.length">尚未上传录音</p>
      <div v-for="clip in recordings.clips" :key="clip.clipId" class="evidence-item">
        <p>第 {{ clip.clipIndex }} 段 · {{ time(clip.createdAt) }}</p>
        <el-button
          v-if="!urls[clip.clipId]"
          :loading="loadingMedia === clip.clipId"
          @click="loadMedia(clip.clipId, 'audio')"
          >读取录音</el-button
        >
        <audio v-else :src="urls[clip.clipId]" controls preload="metadata" />
      </div>
    </section>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { apiClient } from '@/api/core/client'
const props = defineProps<{ captureId: string; permissions: string[] }>()
interface Photos {
  requiredStorefrontPhotoCount: number
  verifiedStorefrontPhotoCount: number
  photos: {
    evidenceId: string
    capturedAt: string
    distanceToTargetMeters: number | null
    evidenceStatus: string
  }[]
}
interface Recordings {
  clipCount: number
  clips: { clipId: string; clipIndex: number; createdAt: string }[]
}
const allowed = (permission: string) =>
  props.permissions.includes(permission) || props.permissions.includes('*:*:*')
const canPhoto = computed(() => allowed('sales:evidence:sensitive:read'))
const canAudio = computed(() => allowed('sales:recording:sensitive:play'))
const open = ref(false),
  loading = ref(false),
  loadingMedia = ref(''),
  error = ref('')
const photos = ref<Photos | null>(null),
  recordings = ref<Recordings | null>(null)
const urls = ref<Record<string, string>>({})
let generation = 0
const base = () => `/sales/management/visits/${encodeURIComponent(props.captureId)}`
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })
const message = (e: unknown) => (e instanceof Error ? e.message : '证据读取失败，请重试')
function clear() {
  generation++
  Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url))
  urls.value = {}
  photos.value = null
  recordings.value = null
  loadingMedia.value = ''
  loading.value = false
}
async function openEvidence() {
  clear()
  error.value = ''
  open.value = true
  loading.value = true
  const current = generation
  const jobs: Promise<void>[] = []
  if (canPhoto.value)
    jobs.push(
      apiClient.get<Photos>(`${base()}/evidence`, { stayOnUnauthorized: true }).then((v) => {
        if (current === generation) photos.value = v
      }),
    )
  if (canAudio.value)
    jobs.push(
      apiClient.get<Recordings>(`${base()}/recordings`, { stayOnUnauthorized: true }).then((v) => {
        if (current === generation) recordings.value = v
      }),
    )
  const results = await Promise.allSettled(jobs)
  if (current !== generation) return
  error.value = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => message(r.reason))
    .join('；')
  loading.value = false
}
async function loadMedia(id: string, kind: 'photo' | 'audio') {
  if ((kind === 'photo' && !canPhoto.value) || (kind === 'audio' && !canAudio.value)) return
  const current = generation
  loadingMedia.value = id
  error.value = ''
  try {
    const path = kind === 'photo' ? 'evidence/photos' : 'recordings/clips'
    const blob = await apiClient.get<Blob>(`${base()}/${path}/${encodeURIComponent(id)}`, {
      responseType: 'blob',
      stayOnUnauthorized: true,
    })
    if (current === generation) urls.value[id] = URL.createObjectURL(blob)
  } catch (e) {
    if (current === generation) error.value = message(e)
  } finally {
    if (current === generation) loadingMedia.value = ''
  }
}
onBeforeUnmount(clear)
</script>
<style scoped>
.evidence-item {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.evidence-item img {
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
}
.evidence-item audio {
  width: 100%;
}
</style>
