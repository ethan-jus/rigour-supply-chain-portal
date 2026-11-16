<template>
  <div class="field-day">
    <SalesVisitEvidence v-if="selectedVisit" :visit="selectedVisit" :employee-name="visitHistory.length?'授权范围内历史拜访':person.employeeName" @back="backEvidence" @history="openHistory" @changed="updateCase" />
    <div v-show="!selectedVisit" class="field-day-content">
    <div class="day-toolbar"><el-button :icon="ArrowLeft" text @click="emit('back')">返回</el-button><strong>{{ person.employeeName }}</strong><el-tag type="info">{{ person.departmentName || person.employeeCode || '销售' }}</el-tag><el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="load" /><el-button :loading="loading" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="day-metrics"><article v-for="metric in metrics" :key="metric.label"><component :is="metric.icon" /><div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div></article></div>
    <div class="day-quality"><el-button v-if="canRisk" text type="primary" @click="caseDrawer=true">核查事项 {{ cases.length }}</el-button><el-button v-if="canRisk" text type="primary" :disabled="!inspectorDayId" @click="openInspector('DEVICE')">设备核查</el-button><el-button v-if="canRisk" text type="primary" :disabled="!track" @click="openInspector('LOCATION')">出发与收工地点</el-button><span><Warning />轨迹缺失 {{ track?.gaps.length ?? '—' }}处</span><span v-if="lastSync">最后收到 {{ lastSync }}</span></div>
    <div class="day-main">
      <section class="day-map-panel"><div class="day-section-header"><strong>{{ selectedDate }} 轨迹</strong><span>已记录路线</span></div>
        <div class="day-map-wrap"><div ref="mapContainer" class="day-map" /><div v-if="mapMessage" class="day-map-message">{{ mapMessage }}</div></div>
        <div class="day-playback"><el-button :icon="playing ? VideoPause : VideoPlay" circle :disabled="playbackPoints.length < 2" :aria-label="playing ? '暂停回放' : '回放轨迹'" @click="togglePlayback" /><span>{{ playbackTime }}</span><el-slider v-model="playbackIndex" :min="0" :max="Math.max(0,playbackPoints.length-1)" :show-tooltip="false" :disabled="playbackPoints.length < 2" @input="seek" /><small>按采样点回放</small></div>
      </section>
      <section class="day-timeline"><div class="day-section-header"><strong>时间线</strong><el-select v-model="eventKind" size="small" aria-label="时间线类型"><el-option label="全部" value="" /><el-option label="拜访" value="visit" /><el-option label="轨迹缺失" value="gap" /></el-select></div><div class="day-events"><button v-for="event in visibleEvents" :key="event.id" :class="['day-event',{ selected: selectedEvent===event.id, warning:event.kind==='gap' }]" @click="selectEvent(event)"><i /><time>{{ event.time }}</time><div><strong>{{ event.title }}</strong><span>{{ event.subtitle }}</span></div></button><el-empty v-if="!events.length" :description="loading ? '正在读取' : '暂无当日记录'" :image-size="60" /></div></section>
    </div>
    <section class="day-visits"><div class="day-section-header"><strong>当日拜访</strong><span>{{ track?.visits.length ?? '—' }}次</span></div><el-table :data="track?.visits || []" row-key="visitId" size="small" @row-click="focusVisit"><el-table-column prop="storeName" label="门店" min-width="230" show-overflow-tooltip /><el-table-column label="到离店" width="160"><template #default="{row}">{{ fieldClock(row.checkedInAt) }} — {{ fieldClock(row.checkedOutAt) }}</template></el-table-column><el-table-column label="停留" width="110"><template #default="{row}">{{ row.dwellMinutes }}分钟</template></el-table-column><el-table-column label="拜访类型" width="110"><template #default="{row}">{{ row.visitType === 'REVISIT' ? '复访' : '首访' }}</template></el-table-column><el-table-column label="采集状态" min-width="130"><template #default="{row}">{{ row.checkedOutAt ? '已完成采集' : '进行中' }}</template></el-table-column><el-table-column label="操作" width="100"><template #default="{row}"><el-button type="primary" link @click.stop="openEvidence(row as TrackVisit)">查看证据</el-button></template></el-table-column></el-table></section>
    <el-drawer v-model="caseDrawer" title="外勤核查" size="460px"><el-alert v-if="caseError" :title="caseError" type="error" :closable="false" /><SalesFieldworkCasePanel v-else :cases="cases" @changed="updateCase" /></el-drawer>
    <el-drawer v-model="inspectorOpen" :title="inspectorKind==='DEVICE'?'设备核查':'出发与收工地点'" size="min(560px, 100vw)" destroy-on-close @opened="inspectorReady=true" @close="inspectorReady=false"><el-alert v-if="caseError" :title="caseError" type="error" :closable="false" /><SalesFieldworkInspector v-if="inspectorReady && inspectorDayId && !caseError" :kind="inspectorKind" :person="person" :date="selectedDate" :work-day-id="inspectorDayId" :track="track" :cases="cases" @changed="updateCase" /></el-drawer>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineAsyncComponent, computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Calendar, Clock, Location, Guide, Warning, VideoPause, VideoPlay } from '@element-plus/icons-vue'
const SalesVisitEvidence = defineAsyncComponent(() => import('./SalesVisitEvidence.vue'))
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const SalesFieldworkInspector=defineAsyncComponent(()=>import('./SalesFieldworkInspector.vue'))
import { dayCases, type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import { useAuthStore } from '@/stores/auth'
import { isAmapJsConfigured, loadAmapJsApi } from '@/utils/amap-js-api'
import { fieldworkTrack, fieldClock, fieldDistance, type FieldPersonDay, type FieldTrack, type TrackVisit } from '@/api/core/sales-fieldwork'
const props=defineProps<{person:FieldPersonDay;date:string}>(), emit=defineEmits<{back:[];changed:[]}>()
const auth=useAuthStore(), selectedDate=ref(props.date), loading=ref(false), error=ref(''), mapMessage=ref('')
const track=ref<FieldTrack|null>(null), mapContainer=ref<HTMLElement|null>(null), selectedEvent=ref(''), eventKind=ref('')
const selectedVisit=ref<TrackVisit|null>(null)
const visitHistory=ref<TrackVisit[]>([]),inspectorOpen=ref(false),inspectorReady=ref(false),inspectorKind=ref<'DEVICE'|'LOCATION'>('DEVICE')
const caseDrawer=ref(false),cases=ref<FieldworkCase[]>([]),caseError=ref('')
const canRisk=computed(()=>auth.hasPermission('sales:risk:read'))
const inspectorDayId=computed(()=>track.value?.workDayId||(selectedDate.value===props.date?props.person.workDayId:null))
function updateCase(item:FieldworkCase){if(item.workDayId===track.value?.workDayId)cases.value=cases.value.some(c=>c.id===item.id)?cases.value.map(c=>c.id===item.id?item:c):[...cases.value,item];emit('changed')}
function openEvidence(visit:TrackVisit){stopPlayback();visitHistory.value=[];selectedVisit.value=visit}
function openHistory(visit:TrackVisit){if(selectedVisit.value)visitHistory.value.push(selectedVisit.value);selectedVisit.value=visit}
function backEvidence(){selectedVisit.value=visitHistory.value.pop()||null}
function openInspector(kind:'DEVICE'|'LOCATION'){stopPlayback();inspectorKind.value=kind;inspectorOpen.value=true}
const playing=ref(false), playbackIndex=ref(0)
let version=0,controller:AbortController|null=null,timer:ReturnType<typeof setInterval>|null=null
interface Overlay {on?(event:string,callback:()=>void):void;setPosition?(position:[number,number]):void}
interface MapInstance {add(items:Overlay|Overlay[]):void;clearMap():void;setFitView(items?:Overlay[]):void;setZoomAndCenter(zoom:number,center:[number,number]):void;destroy():void}
interface Amap {Map:new(element:HTMLElement,options:Record<string,unknown>)=>MapInstance;Polyline:new(options:Record<string,unknown>)=>Overlay;Marker:new(options:Record<string,unknown>)=>Overlay}
let map:MapInstance|null=null,playbackMarker:Overlay|null=null
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
type Event={id:string;kind:string;time:string;timestamp:string;title:string;subtitle:string;position:[number,number]|null}
const events=computed<Event[]>(()=>{
  if(!track.value)return []
  return [
    ...track.value.punches.map((p,i)=>({id:`punch-${i}`,kind:'punch',time:fieldClock(p.clientOccurredAt||p.serverReceivedAt),timestamp:p.clientOccurredAt||p.serverReceivedAt,title:p.eventType==='CHECK_IN'?'上班签到':'下班签退',subtitle:'',position:[p.longitude,p.latitude] as [number,number]})),
    ...track.value.visits.map(v=>({id:v.visitId,kind:'visit',time:fieldClock(v.checkedInAt),timestamp:v.checkedInAt,title:v.storeName,subtitle:`${v.visitType==='REVISIT'?'复访':'首访'} · ${v.dwellMinutes}分钟`,position:v.longitude!=null&&v.latitude!=null?[v.longitude,v.latitude] as [number,number]:null})),
    ...track.value.gaps.map((g,i)=>({id:`gap-${i}`,kind:'gap',time:fieldClock(g.from),timestamp:g.from,title:g.reason==='IMPLAUSIBLE_SPEED'?'定位跳跃待核查':'轨迹缺失',subtitle:`至 ${fieldClock(g.to)} · ${Math.max(0,Math.round((Date.parse(g.to)-Date.parse(g.from))/60000))}分钟`,position:null})),
  ].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))
})
const visibleEvents=computed(()=>events.value.filter(e=>!eventKind.value||e.kind===eventKind.value))
const playbackPoints=computed(()=>track.value?.legs.flatMap(leg=>leg.points)||[])
const playbackTime=computed(()=>fieldClock(playbackPoints.value[playbackIndex.value]?.clientOccurredAt))
const lastSync=computed(()=>fieldClock(track.value?.points.map(p=>p.serverReceivedAt).sort().at(-1)))
const metrics=computed(()=>{
  const punches=track.value?.punches||[], first=punches.find(p=>p.eventType==='CHECK_IN'),last=punches.filter(p=>p.eventType==='CHECK_OUT').at(-1)
  let seconds=0,started:number|null=null
  for(const p of punches){const at=Date.parse(p.serverReceivedAt);if(p.eventType==='CHECK_IN')started=at;else if(started!=null){seconds+=Math.max(0,(at-started)/1000);started=null}}
  const minutes=Math.floor(seconds/60)
  const between=track.value?.segments.filter(s=>s.distanceSource==='OBSERVED_ESTIMATE')||[]
  return [
    {label:'签到',value:fieldClock(first?.clientOccurredAt||first?.serverReceivedAt),icon:Calendar},
    {label:'签退',value:track.value?.status==='ACTIVE'?'未签退':fieldClock(last?.clientOccurredAt||last?.serverReceivedAt),icon:Calendar},
    {label:started==null?'作业时段':'已结束时段',value:track.value?`${Math.floor(minutes/60)}小时${minutes%60}分`:'—',icon:Clock},
    {label:'已记录里程（估算）',value:fieldDistance(track.value?.distanceAvailable?track.value.totalDistanceMeters:null),icon:Guide},
    {label:'客户间里程（估算）',value:fieldDistance(between.length?between.reduce((n,s)=>n+s.distanceMeters,0):null),icon:Location},
  ]
})
function stopPlayback(){playing.value=false;if(timer)clearInterval(timer);timer=null}
function seek(){const p=playbackPoints.value[playbackIndex.value];if(p)playbackMarker?.setPosition?.([p.longitude,p.latitude])}
function togglePlayback(){if(playing.value){stopPlayback();return}if(playbackIndex.value>=playbackPoints.value.length-1)playbackIndex.value=0;playing.value=true;timer=setInterval(()=>{if(playbackIndex.value>=playbackPoints.value.length-1){stopPlayback();return}playbackIndex.value++;seek()},500)}
function selectEvent(event:Event){selectedEvent.value=event.id;if(event.position)map?.setZoomAndCenter(16,event.position)}
function focusVisit(visit:TrackVisit){const event=events.value.find(e=>e.id===visit.visitId);if(event)selectEvent(event)}
async function renderMap(current:number){
  if(!mapContainer.value||!track.value)return
  if(!isAmapJsConfigured()){mapMessage.value='地图暂不可用';return}
  try {
    const sdk=await loadAmapJsApi() as unknown as Amap
    if(current!==version||!mapContainer.value)return
    map ||= new sdk.Map(mapContainer.value,{zoom:12,viewMode:'2D'})
    map.clearMap();playbackMarker=null
    const overlays:Overlay[]=[]
    for(const leg of track.value.legs||[])if(leg.points.length>1)overlays.push(new sdk.Polyline({path:leg.points.map(p=>[p.longitude,p.latitude]),strokeColor:'#3478f6',strokeWeight:5,showDir:true}))
    for(const event of events.value){if(!event.position)continue;const marker=new sdk.Marker({position:event.position,title:`${event.time} ${event.title}`});marker.on?.('click',()=>selectEvent(event));overlays.push(marker)}
    if(overlays.length){map.add(overlays);map.setFitView(overlays);mapMessage.value=''}else mapMessage.value='当天暂无可靠位置'
    const point=playbackPoints.value[0];if(point){playbackMarker=new sdk.Marker({position:[point.longitude,point.latitude],title:'回放位置',zIndex:200});map.add(playbackMarker)}
  }catch(e){if(current===version)mapMessage.value=e instanceof Error?e.message:'地图加载失败'}
}
async function loadCases(day:string,current:number){try{const items=await dayCases(props.person.salesProfileId,day,controller?.signal);if(current===version)cases.value=items}catch(e){if(current===version)caseError.value=e instanceof Error?e.message:'核查事项读取失败'}}
async function load(){
  selectedVisit.value=null;visitHistory.value=[];inspectorOpen.value=false;inspectorReady.value=false;cases.value=[];caseError.value='';caseDrawer.value=false;const current=++version,identity=owner.value;controller?.abort();controller=new AbortController();stopPlayback();playbackIndex.value=0;track.value=null;error.value='';map?.clearMap()
  if(!auth.hasPermission('sales:location:sensitive:read')){loading.value=false;error.value='暂无精确轨迹查看权限';mapMessage.value=error.value;if(canRisk.value&&inspectorDayId.value)await loadCases(inspectorDayId.value,current);return}
  loading.value=true
  try {const data=await fieldworkTrack(props.person.salesProfileId,selectedDate.value,controller.signal);if(current!==version||identity!==owner.value)return;track.value=data;await nextTick();await renderMap(current);if(canRisk.value)await loadCases(data.workDayId,current)}
  catch(e){if(current===version)error.value=e instanceof Error?e.message:'当日记录读取失败'}finally{if(current===version)loading.value=false}
}
watch(owner,()=>{version++;controller?.abort();track.value=null;stopPlayback();map?.destroy();map=null;emit('back')})
onMounted(load)
onBeforeUnmount(()=>{version++;controller?.abort();stopPlayback();map?.destroy();map=null})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.field-day-content,.field-day{display:flex;flex-direction:column;gap:12px;min-height:0;}.day-toolbar{display:flex;align-items:center;gap:12px;}.day-toolbar>strong{font-size:22px;}.day-toolbar :deep(.el-date-editor){margin-left:auto;width:170px;}
.day-metrics{display:flex;background:$color-bg-white;border:1px solid $color-border-base;border-radius:6px 6px 0 0;padding:16px 0;margin-bottom:-12px;}.day-metrics article{flex:1;display:flex;gap:10px;padding:0 20px;border-right:1px solid $color-border-base;}.day-metrics article:last-child{border:0;}.day-metrics svg{width:20px;height:20px;color:$color-text-secondary;}.day-metrics article>div{display:flex;flex-direction:column;gap:5px;}.day-metrics span{font-size:12px;color:$color-text-secondary;}.day-metrics strong{font-size:18px;white-space:nowrap;}
.day-quality{display:flex;gap:32px;padding:10px 20px;border:1px solid $color-border-base;border-radius:0 0 6px 6px;background:#f9fbff;font-size:12px;color:$color-text-secondary;}.day-quality span{display:flex;align-items:center;gap:8px;}.day-quality svg{width:16px;height:16px;}
.day-main{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:12px;}.day-map-panel,.day-timeline,.day-visits{border:1px solid $color-border-base;border-radius:6px;overflow:hidden;background:$color-bg-white;}.day-section-header{height:42px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid $color-border-base;}.day-section-header>span{font-size:12px;color:$color-text-secondary;}.day-section-header :deep(.el-select){width:95px;}.day-map-wrap{height:350px;position:relative;}.day-map{height:100%;}.day-map-message{position:absolute;inset:0;display:grid;place-items:center;background:#f4f6f8;color:$color-text-secondary;}.day-playback{display:flex;align-items:center;gap:12px;padding:8px 16px;border-top:1px solid $color-border-base;}.day-playback .el-slider{flex:1;}.day-playback small{white-space:nowrap;color:$color-text-secondary;}
.day-events{height:404px;overflow:auto;padding:0 16px;}.day-event{width:100%;display:flex;gap:10px;align-items:flex-start;padding:16px 0;background:none;border:0;border-bottom:1px solid $color-border-base;text-align:left;cursor:pointer;color:$color-text-primary;}.day-event i{width:9px;height:9px;background:#3478f6;border-radius:50%;margin-top:5px;flex-shrink:0;}.day-event.warning i{background:#eea91b;}.day-event time{font-size:12px;line-height:20px;}.day-event>div{display:flex;flex:1;flex-direction:column;gap:5px;}.day-event strong{font-size:13px;}.day-event span{font-size:12px;color:$color-text-secondary;}.day-event.selected{background:#eef4ff;}.day-visits :deep(.el-table__cell){padding:11px 0;}
@media(max-width:1100px){.day-main{grid-template-columns:1fr;}.day-metrics{flex-wrap:wrap;gap:16px;}.day-metrics article{min-width:160px;}.day-quality{flex-wrap:wrap;gap:12px;}.day-events{height:260px;}}
</style>
