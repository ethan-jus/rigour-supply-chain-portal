<template>
  <el-popover
    v-model:visible="expanded"
    trigger="click"
    placement="bottom-start"
    :width="300"
    :persistent="false"
  >
    <template #reference>
      <button
        type="button"
        class="voice-player"
        :disabled="loading"
        :aria-label="label"
        :aria-pressed="playing"
        :title="error || label"
        @click="toggle"
      >
        <Loading v-if="loading" class="voice-spinner" aria-hidden="true" />
        <VideoPause v-else-if="playing" aria-hidden="true" />
        <img v-else :src="waveform" alt="" />
        <span class="voice-total">{{ total == null ? '–:––' : audioClock(total) }}</span>
      </button>
    </template>
    <section class="playback-panel" aria-label="录音播放控制">
      <header>
        <strong :title="store">{{ store }}</strong>
        <span class="playback-time"
          >{{ audioClock(dragTime ?? elapsed) }}
          <span>/ {{ total == null ? '–:––' : audioClock(total) }}</span></span
        >
      </header>
      <input
        type="range"
        aria-label="录音进度"
        :aria-valuetext="audioClock(dragTime ?? elapsed)"
        min="0"
        :max="listedMillis || total || 1"
        step="1000"
        :value="dragTime ?? elapsed"
        :disabled="!canSeek || loading"
        @input="dragTime = ($event.target as HTMLInputElement).valueAsNumber"
        @change="seek"
        @pointercancel="dragTime = null"
        @blur="dragTime = null"
      />
      <div class="transport">
        <button type="button" class="play-action" :disabled="loading" @click="toggle">
          <VideoPause v-if="playing" /><VideoPlay v-else />{{ playing ? '暂停' : '播放' }}
        </button>
        <button type="button" :disabled="loading" @click="play(0)"><RefreshLeft />重播</button>
        <label
          >倍速<select v-model.number="rate" aria-label="播放速度">
            <option v-for="speed in [0.75, 1, 1.25, 1.5, 2]" :key="speed" :value="speed">
              {{ speed }}×
            </option>
          </select></label
        >
      </div>
    </section>
  </el-popover>
  <small v-if="error" role="status">{{ error }}</small>
  <audio
    ref="audio"
    @timeupdate="updateProgress"
    @ended="advance"
    @error="mediaError"
    @playing="playing = true"
    @pause="playing = false"
  />
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import waveform from '@/assets/icons/fieldwork/audio-lines.svg'
import { Loading, RefreshLeft, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import {
  audioClock,
  evidenceBlob,
  visitRecordings,
  type RecordingClip,
} from '@/api/core/sales-fieldwork-review'

const props = defineProps<{
  visit: string
  store: string
  active: boolean
  totalMillis: number | null
}>()
const emit = defineEmits<{ activate: [] }>()
const audio = ref<HTMLAudioElement>()
const loading = ref(false)
const playing = ref(false)
const expanded = ref(false)
const elapsed = ref(0)
const dragTime = ref<number | null>(null)
const rate = ref(1)
const canSeek = computed(
  () => listedMillis.value != null || (clips.value.length === 1 && !!total.value),
)
watch(rate, (value) => {
  if (audio.value) audio.value.playbackRate = value
})
const listedMillis = ref<number | null>(null)
const total = computed(() => props.totalMillis || listedMillis.value)
const error = ref('')
const label = computed(
  () =>
    (playing.value ? '暂停' : '播放') +
    props.store +
    '的拜访录音' +
    (total.value == null ? '，时长待确认' : '，总时长 ' + audioClock(total.value)),
)
let request: AbortController | undefined
const lifetime = new AbortController()
let metadata: Promise<RecordingClip[]> | undefined

function duration(clip: RecordingClip) {
  return (clip.verifyStatus === 'VERIFIED' && clip.verifiedDurationMs) || clip.clientDurationMs
}

function getClips() {
  metadata ??= visitRecordings(props.visit, lifetime.signal)
    .then((result) => {
      const received = result.clips
        .filter((c) => c.uploadStatus === 'RECEIVED')
        .sort((a, b) => a.clipIndex - b.clipIndex)
      const durations = received.map(duration)
      if (durations.length && durations.every((ms): ms is number => ms != null && ms > 0))
        listedMillis.value = durations.reduce((sum, ms) => sum + ms, 0)
      return received
    })
    .catch((cause) => {
      metadata = undefined
      throw cause
    })
  return metadata
}
onMounted(() => {
  if (!props.totalMillis) void getClips().catch(() => {})
})
const clips = ref<RecordingClip[]>([])
let index = 0
let url = ''
let segmentStart = 0
function updateProgress() {
  if (url && audio.value && audio.value.readyState >= 1)
    elapsed.value = Math.min(total.value ?? Infinity, segmentStart + audio.value.currentTime * 1000)
}
function release() {
  const el = audio.value
  if (el && url) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  if (url) URL.revokeObjectURL(url)
  url = ''
}
function reset() {
  request?.abort()
  release()
  clips.value = []
  index = segmentStart = elapsed.value = 0
  dragTime.value = null
  playing.value = loading.value = false
  error.value = ''
}
function mediaError() {
  if (url && audio.value?.error) error.value = '录音无法播放'
}
async function play(target?: number, resume = true) {
  request?.abort()
  const current = new AbortController()
  request = current
  loading.value = true
  error.value = ''
  try {
    const received = await getClips()
    if (current.signal.aborted) return
    clips.value = received
    let offset: number | undefined
    if (target != null) {
      let next = 0
      let start = 0
      while (next + 1 < received.length) {
        const length = duration(received[next]!)
        if (!length || target < start + length) break
        start += length
        next++
      }
      if (next !== index) release()
      index = next
      segmentStart = start
      elapsed.value = target
      offset = (target - start) / 1000
    }
    const clip = received[index]
    if (!clip) throw new Error('暂无可播放录音')
    if (!url || audio.value?.error) {
      release()
      const blob = await evidenceBlob(props.visit, 'recordings/clips', clip.clipId, current.signal)
      if (current.signal.aborted || !audio.value) return
      url = URL.createObjectURL(blob)
      audio.value.src = url
    }
    if (audio.value) {
      if (offset != null) audio.value.currentTime = offset
      audio.value.playbackRate = rate.value
      if (resume) await audio.value.play()
    }
  } catch (cause) {
    if (!current.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '录音读取失败'
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
function seek(event: Event) {
  dragTime.value = null
  void play((event.target as HTMLInputElement).valueAsNumber, playing.value)
}
function toggle() {
  if (playing.value) audio.value?.pause()
  else {
    emit('activate')
    void play()
  }
}
function advance() {
  if (!props.active) return
  if (index + 1 === clips.value.length) {
    elapsed.value = total.value ?? elapsed.value
    index = segmentStart = 0
    release()
    playing.value = false
    return
  }
  segmentStart += duration(clips.value[index]!) || (audio.value?.currentTime || 0) * 1000
  elapsed.value = segmentStart
  ++index
  release()
  void play()
}
watch(
  () => props.active,
  (active) => {
    if (!active) {
      expanded.value = false
      reset()
    }
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  lifetime.abort()
  reset()
})
</script>
<style scoped>
.playback-panel {
  color: #1b334a;
  font-size: 13px;
}
.playback-panel header,
.transport,
.transport button,
.transport label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.playback-panel header {
  justify-content: space-between;
}
.playback-panel header strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playback-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-weight: 550;
}
.playback-time span,
.transport label {
  color: #617589;
  font-weight: 400;
}
.playback-panel input {
  width: 100%;
  margin: 10px 0;
  accent-color: #235bd5;
  cursor: pointer;
}
.transport button,
.transport select {
  font: inherit;
  color: inherit;
  cursor: pointer;
  border: 0;
  border-radius: 5px;
  padding: 5px 8px;
  background: #f2f5f8;
}
.transport button svg {
  width: 14px;
  height: 14px;
}
.transport .play-action {
  color: #235bd5;
  background: #eaf1ff;
}
.transport label {
  margin-left: auto;
}
.transport select {
  padding: 4px;
}
.voice-player {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  vertical-align: middle;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 16px;
  background: #eef2f5;
  color: #1b334a;
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
}
.voice-player img,
.voice-player svg {
  width: 15px;
  height: 15px;
}
.voice-player:hover,
.voice-player[aria-pressed='true'] {
  background: #e3ebf5;
}
.voice-player:focus-visible {
  outline: 2px solid #235bd5;
  outline-offset: 2px;
}
.voice-player:disabled {
  cursor: progress;
}
.voice-spinner {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .voice-spinner {
    animation: none;
  }
}
small {
  display: block;
  color: var(--field-muted);
}
</style>
