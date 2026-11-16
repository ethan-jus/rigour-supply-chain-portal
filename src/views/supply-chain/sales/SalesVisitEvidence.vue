<template>
  <div class="visit-evidence">
    <div class="evidence-heading"><el-button text :icon="ArrowLeft" @click="emit('back')">返回</el-button><div><h2>{{ visit.storeName }}</h2><span>{{ employeeName }} · {{ fieldClock(visit.checkedInAt) }}–{{ fieldClock(visit.checkedOutAt) }}</span></div><el-tag class="capture-state" type="info">{{ visit.checkedOutAt?'采集已完成':'采集中' }}</el-tag><el-button :loading="loading" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="evidence-columns">
      <section class="evidence-main">
        <el-tabs v-model="tab"><el-tab-pane label="录音与原文" name="audio" /><el-tab-pane :label="`现场照片 ${photos.length}`" name="photos" /><el-tab-pane label="位置信息" name="position" /></el-tabs>
        <template v-if="tab==='audio'">
          <div v-if="!canAudio" class="evidence-empty">暂无录音查看权限</div>
          <template v-else>
            <div class="audio-controls"><el-select v-model="selectedClip" placeholder="选择录音片段" :disabled="!clips.length" @change="resetAudio"><el-option v-for="clip in clips" :key="clip.clipId" :label="`片段 ${clip.clipIndex} · ${audioClock(clip.clientDurationMs||0)}`" :value="clip.clipId" /></el-select><el-button v-if="!audioUrl" :icon="VideoPlay" :loading="mediaLoading" :disabled="!selectedClip" @click="playAt(0)">播放</el-button><el-tag v-if="currentAnalysis" type="info">{{ analysisLabel(currentAnalysis.status) }}</el-tag></div>
            <audio v-if="audioUrl" ref="player" :src="audioUrl" controls preload="metadata" @timeupdate="onTime" @loadedmetadata="onMetadata" />
            <div class="transcript-search"><el-input v-model="query" clearable :prefix-icon="Search" placeholder="搜索录音文字" /><el-button v-if="failed && analysis?.processingEnabled && canRetry" :loading="retrying" @click="retry">重新转写</el-button></div>
            <div class="transcript-lines"><button v-for="(line,index) in lines" :key="`${line.startMs}-${index}`" :class="{active:line.startMs<=currentMs&&line.endMs>currentMs}" @click="playAt(line.startMs)"><time>{{ audioClock(line.startMs) }}</time><strong v-if="line.speakerId!=null">{{ line.speakerId+1 }}</strong><span>{{ line.text }}</span></button><p v-if="currentAnalysis?.transcript && !currentAnalysis.segments.length" class="plain-transcript">{{ currentAnalysis.transcript }}</p><el-empty v-if="!lines.length && !currentAnalysis?.transcript" :description="transcriptEmpty" :image-size="56" /></div>
          </template>
        </template>
        <template v-else-if="tab==='photos'"><div v-if="!canPhotos" class="evidence-empty">暂无现场照片查看权限</div><article v-for="photo in photos" :key="photo.evidenceId" class="photo-evidence"><el-image v-if="photoUrls[photo.evidenceId]" :src="photoUrls[photo.evidenceId]" fit="contain" :preview-src-list="[photoUrls[photo.evidenceId]!]" preview-teleported /><button v-else class="photo-load" :disabled="loadingPhoto===photo.evidenceId" @click="loadPhoto(photo)"><Camera />{{ loadingPhoto===photo.evidenceId?'读取中':'查看门头照' }}</button><div><strong>门头照</strong><span>{{ photo.captureSource==='APP_CAMERA'?'App 现场拍摄':photo.captureSource==='FILE_IMPORT'?'历史导入':'其他采集来源' }}</span><span>{{ fieldClock(photo.capturedAt) }}</span><span>{{ photo.distanceToTargetMeters==null?'距离未获得':`距门店 ${Math.round(photo.distanceToTargetMeters)}m` }}</span></div></article><el-empty v-if="canPhotos&&!photos.length" description="暂无门头照" :image-size="56" /></template>
        <div v-else class="position-detail"><div><span>到店</span><strong>{{ fieldClock(visit.checkedInAt) }}</strong></div><div><span>离店</span><strong>{{ fieldClock(visit.checkedOutAt) }}</strong></div><div><span>停留</span><strong>{{ visit.dwellMinutes }}分钟</strong></div><div><span>门店坐标</span><strong>{{ visit.longitude==null?'未获得':`${visit.longitude}, ${visit.latitude}` }}</strong></div></div>
      </section>
      <aside class="evidence-side"><section class="business-summary"><div><strong>业务摘要</strong><el-tag size="small" type="info">AI 整理 · 待复核</el-tag></div><p>{{ currentAnalysis?.summary || (currentAnalysis?.summaryStatus==='FAILED'?'摘要生成失败，原文可正常查看':'暂无摘要') }}</p></section><SalesVisitHistory v-if="canRisk" :visit-id="visit.visitId" @open="emit('history',$event)" /><SalesFieldworkCasePanel v-if="canRisk && !caseError" :cases="cases" @changed="updateCase" /><el-alert v-if="caseError" :title="caseError" type="error" :closable="false" /></aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Camera, Search, VideoPlay } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { fieldClock, type TrackVisit } from '@/api/core/sales-fieldwork'
import { visitAnalysis,visitRecordings,visitPhotos,visitCases,evidenceBlob,retryAnalysis,audioClock,type VisitAnalysis,type RecordingClip,type PhotoEvidence,type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const SalesVisitHistory=defineAsyncComponent(()=>import('./SalesVisitHistory.vue'))
const props=defineProps<{visit:TrackVisit;employeeName:string}>(),emit=defineEmits<{back:[];history:[visit:TrackVisit];changed:[item:FieldworkCase]}>(),auth=useAuthStore()
const tab=ref('audio'),loading=ref(false),error=ref(''),caseError=ref(''),query=ref(''),analysis=ref<VisitAnalysis|null>(null),clips=ref<RecordingClip[]>([]),photos=ref<PhotoEvidence[]>([]),cases=ref<FieldworkCase[]>([])
const selectedClip=ref(''),audioUrl=ref(''),photoUrls=ref<Record<string,string>>({}),player=ref<HTMLAudioElement|null>(null),currentMs=ref(-1),mediaLoading=ref(false),loadingPhoto=ref(''),retrying=ref(false)
const canAudio=computed(()=>auth.hasPermission('sales:recording:sensitive:play')),canPhotos=computed(()=>auth.hasPermission('sales:evidence:sensitive:read')),canRisk=computed(()=>auth.hasPermission('sales:risk:read')),canRetry=computed(()=>auth.hasPermission('sales:visit:review'))
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
const currentAnalysis=computed(()=>analysis.value?.clips.find(c=>c.clipId===selectedClip.value)||null)
const lines=computed(()=>currentAnalysis.value?.segments.filter(s=>!query.value||s.text.includes(query.value))||[])
const failed=computed(()=>currentAnalysis.value?.status==='FAILED'||currentAnalysis.value?.summaryStatus==='FAILED')
const transcriptEmpty=computed(()=>loading.value?'正在读取':!analysis.value?.processingEnabled?'暂未启用转写':failed.value?'转写失败，原录音已保留':currentAnalysis.value?.status==='SUCCEEDED'?'未识别到可读文字':'尚未生成原文')
let generation=0,mediaGeneration=0,aborter:AbortController|null=null,seekTo=0
const photoRequests=new Set<string>()
function analysisLabel(status:string){return ({PENDING:'待转写',PROCESSING:'转写中',SUCCEEDED:'已转写',FAILED:'转写失败'} as Record<string,string>)[status]||status}
function resetAudio(){mediaGeneration++;player.value?.pause();if(audioUrl.value)URL.revokeObjectURL(audioUrl.value);audioUrl.value='';currentMs.value=-1;seekTo=0;mediaLoading.value=false}
function clearMedia(){resetAudio();Object.values(photoUrls.value).forEach(URL.revokeObjectURL);photoUrls.value={};photoRequests.clear();loadingPhoto.value=''}
async function load(){
  const current=++generation;aborter?.abort();aborter=new AbortController();clearMedia();error.value='';caseError.value='';analysis.value=null;clips.value=[];photos.value=[];cases.value=[];loading.value=true
  const errors:string[]=[]
  const tasks:Promise<void>[]=[]
  if(canAudio.value){
    tasks.push(visitRecordings(props.visit.visitId,aborter.signal).then(recordings=>{if(current!==generation)return;clips.value=recordings.clips;selectedClip.value=clips.value[0]?.clipId||''}).catch(e=>{errors.push(e instanceof Error?e.message:'录音读取失败')}))
    tasks.push(visitAnalysis(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)analysis.value=result}).catch(e=>{errors.push(e instanceof Error?e.message:'原文读取失败')}))
  }
  if(canPhotos.value)tasks.push(visitPhotos(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)photos.value=result.photos}).catch(e=>{errors.push(e instanceof Error?e.message:'照片读取失败')}))
  if(canRisk.value)tasks.push(visitCases(props.visit.visitId,aborter.signal).then(result=>{if(current===generation)cases.value=result}).catch(e=>{if(current===generation)caseError.value=e instanceof Error?e.message:'核查事项读取失败'}))
  await Promise.all(tasks);if(current===generation){error.value=errors.join('；');loading.value=false}
}
async function playAt(ms:number){
  if(!selectedClip.value||!canAudio.value)return
  seekTo=ms/1000
  if(audioUrl.value&&player.value){player.value.currentTime=seekTo;await player.value.play().catch(()=>{});return}
  const media=++mediaGeneration,current=generation,clip=selectedClip.value;mediaLoading.value=true
  try{const body=await evidenceBlob(props.visit.visitId,'recordings/clips',clip,aborter?.signal);if(media!==mediaGeneration||current!==generation)return;audioUrl.value=URL.createObjectURL(body);await nextTick()}
  catch(e){if(media===mediaGeneration)error.value=e instanceof Error?e.message:'录音读取失败'}finally{if(media===mediaGeneration)mediaLoading.value=false}
}
function onMetadata(){if(player.value){player.value.currentTime=Math.min(seekTo,Number.isFinite(player.value.duration)?player.value.duration:seekTo);void player.value.play().catch(()=>{})}}
function onTime(){currentMs.value=(player.value?.currentTime||0)*1000}
async function loadPhoto(photo:PhotoEvidence){
  if(photoRequests.has(photo.evidenceId)||photoUrls.value[photo.evidenceId])return
  const current=generation;loadingPhoto.value=photo.evidenceId;photoRequests.add(photo.evidenceId)
  try{const body=await evidenceBlob(props.visit.visitId,'evidence/photos',photo.evidenceId,aborter?.signal);if(current===generation)photoUrls.value[photo.evidenceId]=URL.createObjectURL(body)}catch(e){if(current===generation)error.value=e instanceof Error?e.message:'照片读取失败'}finally{if(current===generation){photoRequests.delete(photo.evidenceId);if(loadingPhoto.value===photo.evidenceId)loadingPhoto.value=''}}
}
async function retry(){if(!selectedClip.value||retrying.value)return;const current=generation;retrying.value=true;try{const result=await retryAnalysis(props.visit.visitId,selectedClip.value);if(current===generation)analysis.value=result}catch(e){if(current===generation)error.value=e instanceof Error?e.message:'重试失败'}finally{retrying.value=false}}
function updateCase(item:FieldworkCase){cases.value=cases.value.map(c=>c.id===item.id?item:c);emit('changed',item)}
watch(owner,()=>{generation++;aborter?.abort();clearMedia();analysis.value=null;cases.value=[];emit('back')})
watch(()=>props.visit.visitId,()=>{query.value='';void load()})
onMounted(load)
onBeforeUnmount(()=>{generation++;aborter?.abort();clearMedia()})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.visit-evidence{display:flex;flex-direction:column;gap:16px}.evidence-heading{display:flex;align-items:center;gap:16px}.evidence-heading h2{font-size:22px;margin:0 0 6px}.evidence-heading span{color:$color-text-secondary;font-size:13px}.capture-state{margin-left:auto}.evidence-columns{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(360px,1fr);gap:16px}.evidence-main{padding:0 16px 16px;background:$color-bg-white;border:1px solid $color-border-base;border-radius:6px;min-width:0}.evidence-main :deep(.el-tabs__header){margin-bottom:20px}.evidence-main :deep(.el-tabs__item){height:54px;font-size:15px;font-weight:500}.audio-controls{display:flex;align-items:center;gap:12px;padding:12px;background:#f5f7fb;border-radius:6px}.audio-controls .el-select{flex:1;min-width:140px}.evidence-main audio{width:100%;height:44px;margin:12px 0}.transcript-search{display:flex;gap:12px;margin:18px 0 12px}.transcript-lines{min-height:280px;max-height:560px;overflow:auto}.transcript-lines button{display:flex;align-items:flex-start;gap:16px;width:100%;text-align:left;padding:13px 12px;border:0;border-radius:4px;background:none;color:$color-text-primary;cursor:pointer;font-size:14px;line-height:1.6}.transcript-lines button.active{background:#eaf0ff}.transcript-lines time{color:$color-primary;flex-shrink:0;font-variant-numeric:tabular-nums}.transcript-lines span{text-align:left;overflow-wrap:anywhere}.plain-transcript{white-space:pre-wrap;line-height:1.8}.evidence-side{display:flex;flex-direction:column;gap:16px;min-width:0}.business-summary{padding:16px;border:1px solid $color-border-base;border-radius:6px;background:$color-bg-white}.business-summary>div{display:flex;align-items:center;justify-content:space-between;gap:12px}.business-summary p{white-space:pre-wrap;line-height:1.8;font-size:14px;overflow-wrap:anywhere;margin:14px 0 0}.photo-evidence{display:flex;gap:20px;padding:12px;border:1px solid $color-border-base;border-radius:6px;margin:12px 0}.photo-evidence .el-image,.photo-load{width:62%;height:240px;flex-shrink:0}.photo-evidence>div{display:flex;flex-direction:column;gap:14px;font-size:13px;padding-top:8px}.photo-evidence span{color:$color-text-secondary}.photo-load{border:0;background:#f3f5f8;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;color:$color-primary}.photo-load svg{width:22px;height:22px}.position-detail>div{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid $color-border-base}.position-detail span,.evidence-empty{color:$color-text-secondary}.evidence-empty{padding:70px 0;text-align:center}@media(max-width:1100px){.evidence-columns{grid-template-columns:1fr}.evidence-heading{flex-wrap:wrap}}
</style>
