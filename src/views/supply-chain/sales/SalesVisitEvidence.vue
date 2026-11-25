<template>
  <div class="visit-evidence" :class="{ 'visit-evidence--inline': inline }">
    <div v-if="!inline" class="evidence-heading"><el-button text :icon="ArrowLeft" @click="emit('back')">返回</el-button><div><h2>{{ visit.storeName }}</h2><span>{{ employeeName }} · {{ fieldClock(visit.checkedInAt) }}–{{ fieldClock(visit.checkedOutAt) }}</span></div><el-tag class="capture-state" type="info">{{ visit.checkedOutAt?'采集已完成':'采集中' }}</el-tag><el-button :loading="loading" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="evidence-columns">
      <section class="evidence-main">
        <el-tabs v-model="tab">
          <el-tab-pane v-if="inline" label="拜访内容" name="content" />
          <el-tab-pane :label="inline ? '录音与转写' : '录音与原文'" name="audio" />
          <el-tab-pane :label="inline ? '门头照' : `现场照片 ${photos.length}`" name="photos" />
          <el-tab-pane v-if="inline" label="核验详情" name="rules" />
          <el-tab-pane v-if="!inline" label="位置信息" name="position" />
          <el-tab-pane v-if="inline && canRisk" label="同店历史" name="history" />
        </el-tabs>
        <div ref="panel" class="evidence-tab-body">
        <div v-if="inline" v-show="tab === 'content'"><slot name="content" /></div>
        <template v-if="tab==='audio'">
          <div v-if="!canAudio" class="evidence-empty">暂无录音查看权限</div>
          <template v-else>
            <div v-if="inline && loading && !clips.length" class="evidence-note" role="status">正在读取拜访录音…</div>
            <div v-else-if="inline && !clips.length" class="evidence-note">暂无可播放录音</div>
            <div v-if="!inline || clips.length" class="audio-controls"><strong v-if="inline" class="audio-duration">拜访录音 <time>{{ totalMillis == null ? '时长待确认' : audioClock(totalMillis) }}</time></strong><el-select v-if="!inline || clips.length > 1" v-model="selectedClip" aria-label="录音片段" placeholder="选择录音片段" :disabled="!clips.length" @change="resetAudio"><el-option v-for="clip in clips" :key="clip.clipId" :label="`片段 ${inline ? String(clip.clipIndex + 1).padStart(2, '0') : clip.clipIndex} · ${inline ? (clip.verifyStatus === 'VERIFIED' && clip.verifiedDurationMs != null ? '已核 ' + audioClock(clip.verifiedDurationMs) : '时长待核') : (clip.clientDurationMs == null ? '时长待确认' : audioClock(clip.clientDurationMs))}`" :value="clip.clipId" /></el-select><el-button v-if="!audioUrl" :icon="VideoPlay" :loading="mediaLoading" :disabled="!selectedClip" @click="playAt(0)">播放</el-button><el-tag v-if="currentAnalysis" type="info">{{ analysisLabel(currentAnalysis.status) }}</el-tag></div>
            <audio v-if="audioUrl" ref="player" :src="audioUrl" controls preload="metadata" @ended="playNext" @timeupdate="onTime" @loadedmetadata="onMetadata" />
            <div v-if="!inline || (currentAnalysis?.segments.length ?? 0) > 0 || failed" class="transcript-search"><el-input v-model="query" clearable :prefix-icon="Search" placeholder="搜索录音文字" /><el-button v-if="failed && analysis?.processingEnabled && canRetry" :loading="retrying" @click="retry">重新转写</el-button></div>
            <div class="transcript-lines"><button v-for="(line,index) in lines" :key="`${line.startMs}-${index}`" :class="{active:line.startMs<=currentMs&&line.endMs>currentMs}" @click="playAt(line.startMs)"><time>{{ audioClock(line.startMs) }}</time><strong v-if="line.speakerId!=null">{{ recordingSpeaker(line.speakerId,analysis?.speakers||[]) }}：</strong><span>{{ line.text }}</span></button><p v-if="currentAnalysis?.transcript && !currentAnalysis.segments.length" class="plain-transcript">{{ currentAnalysis.transcript }}</p><p v-if="!lines.length && !currentAnalysis?.transcript" class="evidence-note">{{ transcriptEmpty }}</p><p v-else-if="query && currentAnalysis?.segments.length && !lines.length" class="evidence-note">没有匹配的转写内容</p></div>
          </template>
        </template>
        <template v-else-if="tab==='photos'"><p v-if="extraLoading" role="status">正在读取门头照…</p><el-alert v-if="photoError" :title="photoError" type="error" :closable="false" /><div v-if="!canPhotos" class="evidence-empty">暂无现场照片查看权限</div><article v-for="photo in photos" :key="photo.evidenceId" class="photo-evidence"><el-image v-if="photoUrls[photo.evidenceId]" :src="photoUrls[photo.evidenceId]" :alt="visit.storeName + '门头照'" fit="contain" :preview-src-list="[photoUrls[photo.evidenceId]!]" preview-teleported /><button v-else class="photo-load" :disabled="loadingPhoto===photo.evidenceId" @click="loadPhoto(photo)"><Camera />{{ loadingPhoto===photo.evidenceId?'读取中':'查看门头照' }}</button><div><strong>门头照</strong><span>{{ photo.captureSource==='APP_CAMERA'?'App 现场拍摄':photo.captureSource==='FILE_IMPORT'?'历史导入':'其他采集来源' }}</span><span>{{ fieldClock(photo.capturedAt) }}</span><span>{{ photo.distanceToTargetMeters==null?'距离未获得':`距门店 ${Math.round(photo.distanceToTargetMeters)}m` }}</span></div></article><el-empty v-if="canPhotos&&!photos.length&&!extraLoading&&!photoError" description="暂无门头照" :image-size="56" /></template>
        <slot v-else-if="inline && tab === 'rules'" name="facts" />
        <SalesVisitHistory v-else-if="inline && tab === 'history' && canRisk" :visit-id="visit.visitId" :from-fieldwork="fromFieldwork" through-visit @open-capture="emit('capture', $event)" />
        <div v-else-if="!inline" class="position-detail"><div><span>到店</span><strong>{{ fieldClock(visit.checkedInAt) }}</strong></div><div><span>离店</span><strong>{{ fieldClock(visit.checkedOutAt) }}</strong></div><div><span>停留</span><strong>{{ visit.dwellMinutes }}分钟</strong></div><div><span>门店坐标</span><strong>{{ visit.longitude==null?'未获得':`${visit.longitude}, ${visit.latitude}` }}</strong></div></div>
      <section v-if="inline && tab === 'rules' && canRisk" aria-label="核查事项">
          <el-alert v-if="caseError" :title="caseError" type="error" :closable="false" />
          <p v-else-if="extraLoading" role="status">正在读取核查事项…</p>
          <SalesFieldworkCasePanel v-else :cases="cases" @changed="updateCase" />
        </section>
        </div>
      </section>
      <aside v-if="!inline" class="evidence-side"><SalesVisitHistory v-if="canRisk" :visit-id="visit.visitId" :from-fieldwork="fromFieldwork" @open="emit('history',$event)" /><SalesFieldworkCasePanel v-if="canRisk && !caseError" :cases="cases" @changed="updateCase" /><el-alert v-if="caseError" :title="caseError" type="error" :closable="false" /></aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useWorkspaceMediaVisibility } from '@/utils/background-media'
import { ArrowLeft, Camera, Search, VideoPlay } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { fieldClock, type TrackVisit } from '@/api/core/sales-fieldwork'
import { visitAnalysis,visitRecordings,visitPhotos,visitCases,evidenceBlob,retryAnalysis,audioClock,recordingSpeaker,type VisitAnalysis,type RecordingClip,type PhotoEvidence,type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import type { HistoryCapture } from '@/api/core/sales-fieldwork-evidence'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const SalesVisitHistory=defineAsyncComponent(()=>import('./SalesVisitHistory.vue'))
const props=defineProps<{visit:TrackVisit;employeeName:string;inline?:boolean;fromFieldwork?:boolean;totalMillis?:number|null}>(),emit=defineEmits<{back:[];history:[visit:TrackVisit];capture:[item:HistoryCapture];changed:[item:FieldworkCase]}>(),auth=useAuthStore()
const panel = ref<HTMLElement | null>(null)
let audioRequested = false
const tab=ref(props.inline ? 'content' : 'audio'),loading=ref(false),error=ref(''),caseError=ref(''),query=ref(''),analysis=ref<VisitAnalysis|null>(null),clips=ref<RecordingClip[]>([]),photos=ref<PhotoEvidence[]>([]),cases=ref<FieldworkCase[]>([])
const selectedClip=ref(''),audioUrl=ref(''),photoUrls=ref<Record<string,string>>({}),player=ref<HTMLAudioElement|null>(null),currentMs=ref(-1),mediaLoading=ref(false),loadingPhoto=ref(''),retrying=ref(false)
const canAudio=computed(()=>auth.hasPermission('sales:recording:sensitive:play')),canPhotos=computed(()=>auth.hasPermission('sales:evidence:sensitive:read')),canRisk=computed(()=>auth.hasPermission('sales:risk:read')),canRetry=computed(()=>auth.hasPermission('sales:visit:review'))
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
const currentAnalysis=computed(()=>analysis.value?.clips.find(c=>c.clipId===selectedClip.value)||null)
const lines=computed(()=>currentAnalysis.value?.segments.filter(s=>!query.value||s.text.includes(query.value))||[])
const failed=computed(()=>currentAnalysis.value?.status==='FAILED')
const transcriptEmpty=computed(()=>loading.value?'正在读取':!analysis.value?.processingEnabled?'暂未启用转写':failed.value?'转写失败，原录音已保留':currentAnalysis.value?.status==='SUCCEEDED'?'未识别到可读文字':'尚未生成原文')
let generation=0,mediaGeneration=0,aborter:AbortController|null=new AbortController(),seekTo=0
let mediaRequest = new AbortController()
let mediaActive = true
const mediaVisible = useWorkspaceMediaVisibility()
const photoRequests=new Set<string>()
function analysisLabel(status:string){return ({PENDING:'待转写',PROCESSING:'转写中',SUCCEEDED:'已转写',FAILED:'转写失败'} as Record<string,string>)[status]||status}
function resetAudio(){mediaGeneration++;player.value?.pause();if(audioUrl.value)URL.revokeObjectURL(audioUrl.value);audioUrl.value='';currentMs.value=-1;seekTo=0;mediaLoading.value=false}
function clearMedia(){mediaRequest.abort();mediaRequest=new AbortController();resetAudio();Object.values(photoUrls.value).forEach(URL.revokeObjectURL);photoUrls.value={};photoRequests.clear();loadingPhoto.value=''}
async function load(){
  const current=++generation;aborter?.abort();aborter=new AbortController();clearMedia();error.value='';caseError.value='';analysis.value=null;clips.value=[];photos.value=[];cases.value=[];loading.value=true
  const errors:string[]=[]
  const tasks:Promise<void>[]=[]
  if(canAudio.value){
    tasks.push(visitRecordings(props.visit.visitId,aborter.signal).then(recordings=>{if(current!==generation)return;clips.value=props.inline ? recordings.clips.filter(clip => clip.uploadStatus === 'RECEIVED').sort((a,b) => a.clipIndex-b.clipIndex) : recordings.clips;selectedClip.value=clips.value[0]?.clipId||''}).catch(e=>{errors.push(e instanceof Error?e.message:'录音读取失败')}))
    tasks.push(visitAnalysis(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)analysis.value=result}).catch(e=>{errors.push(e instanceof Error?e.message:'原文读取失败')}))
  }
  if(!props.inline && canPhotos.value)tasks.push(visitPhotos(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)photos.value=result.photos}).catch(e=>{errors.push(e instanceof Error?e.message:'照片读取失败')}))
  if(!props.inline && canRisk.value)tasks.push(visitCases(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)cases.value=result}).catch(e=>{if(current===generation)caseError.value=e instanceof Error?e.message:'核查事项读取失败'}))
  await Promise.all(tasks);if(current===generation){error.value=errors.join('；');loading.value=false}
}
const extraLoading = ref(false), photoError = ref('')
watch(tab, async (value, _, onCleanup) => {
  if (!props.inline) return
  const request = new AbortController()
  onCleanup(() => request.abort())
  extraLoading.value = false
  if (value !== 'photos' && value !== 'rules') return
  extraLoading.value = true
  try {
    if (value === 'photos' && canPhotos.value) {
      photoError.value = ''
      const result = await visitPhotos(props.visit.visitId, request.signal)
      if (!request.signal.aborted) {
        photos.value = result.photos
        if (photos.value[0]) void loadPhoto(photos.value[0])
      }
    }
    if (value === 'rules' && canRisk.value) {
      caseError.value = ''
      const result = await visitCases(props.visit.visitId, request.signal)
      if (!request.signal.aborted) cases.value = result
    }
  } catch (cause) {
    if (!request.signal.aborted) {
      const message = cause instanceof Error ? cause.message : '读取失败'
      if (value === 'photos') photoError.value = message
      else caseError.value = message
    }
  } finally {
    if (!request.signal.aborted) extraLoading.value = false
  }
})
function playNext() {
  if (!props.inline) return
  const index = clips.value.findIndex(clip => clip.clipId === selectedClip.value)
  const next = clips.value[index + 1]
  if (index < 0 || !next) return
  resetAudio()
  selectedClip.value = next.clipId
  void playAt(0)
}
async function playAt(ms:number){
  if(!mediaActive||!mediaVisible.value||!selectedClip.value||!canAudio.value)return
  seekTo=ms/1000
  if(audioUrl.value&&player.value){player.value.currentTime=seekTo;await player.value.play().catch(()=>{});return}
  const media=++mediaGeneration,current=generation,clip=selectedClip.value;mediaLoading.value=true
  try{const body=await evidenceBlob(props.visit.visitId,'recordings/clips',clip,mediaRequest.signal);if(media!==mediaGeneration||current!==generation)return;audioUrl.value=URL.createObjectURL(body);await nextTick()}
  catch(e){if(media===mediaGeneration)error.value=e instanceof Error?e.message:'录音读取失败'}finally{if(media===mediaGeneration)mediaLoading.value=false}
}
function onMetadata(){if(player.value){player.value.currentTime=Math.min(seekTo,Number.isFinite(player.value.duration)?player.value.duration:seekTo);void player.value.play().catch(()=>{})}}
function onTime(){currentMs.value=(player.value?.currentTime||0)*1000}
async function loadPhoto(photo:PhotoEvidence){
  if(!mediaActive||!mediaVisible.value||photoRequests.has(photo.evidenceId)||photoUrls.value[photo.evidenceId])return
  const { signal } = mediaRequest
  loadingPhoto.value=photo.evidenceId;photoRequests.add(photo.evidenceId)
  try{const body=await evidenceBlob(props.visit.visitId,'evidence/photos',photo.evidenceId,signal);if(!signal.aborted)photoUrls.value[photo.evidenceId]=URL.createObjectURL(body)}catch(e){if(!signal.aborted)error.value=e instanceof Error?e.message:'照片读取失败'}finally{if(!signal.aborted){photoRequests.delete(photo.evidenceId);if(loadingPhoto.value===photo.evidenceId)loadingPhoto.value=''}}
}
async function retry(){if(!selectedClip.value||retrying.value)return;const current=generation;retrying.value=true;try{const result=await retryAnalysis(props.visit.visitId,selectedClip.value);if(current===generation)analysis.value=result}catch(e){if(current===generation)error.value=e instanceof Error?e.message:'重试失败'}finally{retrying.value=false}}
function updateCase(item:FieldworkCase){cases.value=cases.value.map(c=>c.id===item.id?item:c);emit('changed',item)}
watch(owner,()=>{generation++;aborter?.abort();clearMedia();analysis.value=null;cases.value=[];emit('back')})
watch(()=>props.visit.visitId,()=>{query.value='';void load()})
watch(tab, (value) => {
  if (panel.value) panel.value.scrollTop = 0
  if (value !== 'audio') resetAudio()
  else if (props.inline && !audioRequested) {
    audioRequested = true
    void load()
  }
})
onMounted(() => { if (!props.inline) void load() })
onActivated(() => { mediaActive = true })
onDeactivated(() => { mediaActive = false; clearMedia() })
watch(mediaVisible, (visible) => { if (!visible) clearMedia() })
onBeforeUnmount(()=>{generation++;aborter?.abort();clearMedia()})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.visit-evidence{display:flex;flex-direction:column;gap:16px}.evidence-heading{display:flex;align-items:center;gap:16px}.evidence-heading h2{font-size:22px;margin:0 0 6px}.evidence-heading span{color:$color-text-secondary;font-size:13px}.capture-state{margin-left:auto}.evidence-columns{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(360px,1fr);gap:16px}.evidence-main{padding:0 16px 16px;background:$color-bg-white;border:1px solid $color-border-base;border-radius:6px;min-width:0}.evidence-main :deep(.el-tabs__header){margin-bottom:20px}.evidence-main :deep(.el-tabs__item){height:54px;font-size:15px;font-weight:500}.audio-controls{display:flex;align-items:center;gap:12px;padding:12px;background:#f5f7fb;border-radius:6px}.audio-controls .el-select{flex:1;min-width:140px}.evidence-main audio{width:100%;height:44px;margin:12px 0}.transcript-search{display:flex;gap:12px;margin:18px 0 12px}.transcript-lines{min-height:280px;max-height:560px;overflow:auto}.transcript-lines button{display:flex;align-items:flex-start;gap:16px;width:100%;text-align:left;padding:13px 12px;border:0;border-radius:4px;background:none;color:$color-text-primary;cursor:pointer;font-size:14px;line-height:1.6}.transcript-lines button.active{background:#eaf0ff}.transcript-lines time{color:$color-primary;flex-shrink:0;font-variant-numeric:tabular-nums}.transcript-lines strong{flex-shrink:0}.transcript-lines span{text-align:left;overflow-wrap:anywhere}.plain-transcript{white-space:pre-wrap;line-height:1.8}.evidence-side{display:flex;flex-direction:column;gap:16px;min-width:0}.photo-evidence{display:flex;gap:20px;padding:12px;border:1px solid $color-border-base;border-radius:6px;margin:12px 0}.photo-evidence .el-image,.photo-load{width:62%;height:240px;flex-shrink:0}.photo-evidence>div{display:flex;flex-direction:column;gap:14px;font-size:13px;padding-top:8px}.photo-evidence span{color:$color-text-secondary}.photo-load{border:0;background:#f3f5f8;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;color:$color-primary}.photo-load svg{width:22px;height:22px}.position-detail>div{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid $color-border-base}.position-detail span,.evidence-empty{color:$color-text-secondary}.evidence-empty{padding:70px 0;text-align:center}@media(max-width:1100px){.evidence-columns{grid-template-columns:1fr}.evidence-heading{flex-wrap:wrap}}
.visit-evidence--inline, .visit-evidence--inline .evidence-columns, .visit-evidence--inline .evidence-main {
  display: flex; flex: 1; min-height: 0; flex-direction: column;
}
.visit-evidence--inline .evidence-main > .el-tabs { flex: none; }
.visit-evidence--inline .evidence-tab-body { min-height: 0; overflow: auto; scrollbar-gutter: stable; padding-bottom: 12px; }

.visit-evidence--inline .evidence-main { padding: 0; border: none; }
.visit-evidence--inline .evidence-main :deep(.el-tabs__header) { margin-bottom: 0; }
.visit-evidence--inline .evidence-main :deep(.el-tabs__item) { height: 42px; font-size: 14px; }
.visit-evidence--inline .audio-controls { flex-wrap: wrap; background: #eff4fb; }
.audio-duration { display: flex; align-items: baseline; gap: 10px; margin-right: auto; color: #18324a; }
.audio-duration time { font-variant-numeric: tabular-nums; font-weight: 500; }
.visit-evidence--inline .transcript-lines { min-height: 32px; max-height: 260px; }
.evidence-note { margin: 12px 0; color: #586c80; font-size: 13px; }
.visit-evidence--inline .evidence-tab-body:has(.photo-evidence) { flex: 1; container-type: size; }
.visit-evidence--inline .photo-evidence { display: flex; flex-direction: column; gap: 8px; padding: 0; border: 0; }
.visit-evidence--inline .photo-evidence .el-image { display: block; width: 100%; height: auto; padding: 0; border-radius: 6px; background: #f4f6f8; }
.visit-evidence--inline .photo-evidence :deep(.el-image__inner) { display: block; width: 100%; height: auto; max-height: calc(100cqh - 54px); object-fit: contain; }
.visit-evidence--inline .photo-evidence .photo-load { width: 100%; height: auto; padding: 24px; }
.visit-evidence--inline .photo-evidence > div:not(.el-image) { order: -1; flex-direction: row; flex-wrap: wrap; gap: 4px 12px; }

</style>
