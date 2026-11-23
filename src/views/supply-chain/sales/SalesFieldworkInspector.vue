<template>
  <div class="field-inspector" v-loading="loading">
    <div class="inspector-person"><strong>{{ person.employeeName }} / {{ date }}</strong><el-tag type="info">{{ kind==='DEVICE'?'设备证据':'地点核查' }}</el-tag></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="error && kind==='DEVICE'" @click="load">重新读取</el-button>
    <template v-if="kind==='DEVICE' && devices">
      <dl class="inspector-facts"><div><dt>设备证明</dt><dd>未获得</dd></div><div><dt>设备备案</dt><dd>尚未接通，状态待核实</dd></div><div><dt>当日安装标识</dt><dd>{{ comparison }}</dd></div><div><dt>同实例跨账号</dt><dd>无可靠实例证明，暂不可判断</dd></div></dl>
      <h3>关联事件</h3>
      <ol class="inspector-events"><li v-for="event in devices.events" :key="event.eventId"><time>{{ fieldClock(event.occurredAt||event.receivedAt) }}</time><div><strong>{{ event.eventType==='CHECK_IN'?'上班签到':event.eventType==='CHECK_OUT'?'下班签退':event.eventType }}</strong><p>{{ event.installationReference?`安装标识 · ${event.installationReference}`:'未获得安装标识' }}</p><small>首次收到此标识 {{ event.firstSeenAt?displayDateTime(event.firstSeenAt):'未获得' }}</small><small>服务端收到 {{ displayDateTime(event.receivedAt) }}</small></div></li></ol>
      <el-empty v-if="!devices.events.length" description="暂无设备事件" :image-size="48" />
      <p class="inspector-note">安装标识由客户端上报，重装可能变化；相同标识不能证明同一物理手机或本人持机。</p>
    </template>
    <template v-if="kind==='LOCATION' && canRead && canLocation && track">
      <div class="inspector-map-wrap"><div ref="mapElement" class="inspector-map" /><span v-if="mapMessage" class="inspector-map-message">{{ mapMessage }}</span></div>
      <dl class="inspector-facts"><div><dt>常用区域</dt><dd>尚无本人确认的区域</dd></div><div><dt>居住地属性</dt><dd>未确认</dd></div><div><dt>离开出发区域</dt><dd>暂无区域依据，无法判断</dd></div></dl>
      <ol class="inspector-events"><li v-for="event in locationEvents" :key="event.id"><time>{{ fieldClock(event.at) }}</time><div><strong>{{ event.title }}</strong><p>{{ event.detail }}</p></div></li></ol>
      <dl class="inspector-facts"><div><dt>签到至首访</dt><dd>{{ elapsed(firstPunch?.clientOccurredAt||firstPunch?.serverReceivedAt,firstVisit?.checkedInAt) }}</dd></div><div><dt>末访离店至签退</dt><dd>{{ elapsed(lastVisit?.checkedOutAt,lastPunch?.clientOccurredAt||lastPunch?.serverReceivedAt) }}</dd></div><div><dt>已记录里程（估算）</dt><dd>{{ fieldDistance(track.distanceAvailable?track.totalDistanceMeters:null,track.confirmedTrack) }}</dd></div></dl>
      <p class="inspector-note">时间差表示两个已记录事件的间隔。轨迹缺口 {{ track.gaps.length }} 处；不能据此认定连续停留、居家或无工作。</p>
    </template>
    <SalesFieldworkCasePanel v-if="canRead && relatedCases.length" :cases="relatedCases" @changed="changed" />
    <section v-else-if="canWrite" class="inspector-review"><h3>核查依据</h3><el-input v-model="note" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="记录需要核实的事实和问题" /><el-button type="primary" :loading="saving" :disabled="!note.trim()||loading" @click="start">请销售说明</el-button></section>
    <p v-else class="inspector-note">暂无该类核查事项</p>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { displayDateTime } from '@/utils/business-date'
import { fieldClock, fieldDistance, type FieldPersonDay, type FieldTrack } from '@/api/core/sales-fieldwork'
import { deviceEvidence, startFieldReview, type DeviceEvidence } from '@/api/core/sales-fieldwork-evidence'
import type { FieldworkCase } from '@/api/core/sales-fieldwork-review'
import { isAmapJsConfigured, loadAmapJsApi } from '@/utils/amap-js-api'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const props=defineProps<{kind:'DEVICE'|'LOCATION';person:FieldPersonDay;date:string;workDayId:string;track:FieldTrack|null;cases:FieldworkCase[]}>()
const emit=defineEmits<{changed:[item:FieldworkCase]}>(),auth=useAuthStore()
const devices=ref<DeviceEvidence|null>(null),loading=ref(false),error=ref(''),note=ref(''),saving=ref(false),mapElement=ref<HTMLElement|null>(null),mapMessage=ref('')
const canRead=computed(()=>auth.hasPermission('sales:risk:read')),canLocation=computed(()=>auth.hasPermission('sales:location:sensitive:read'))
const canWrite=computed(()=>canRead.value&&auth.hasPermission('sales:risk:write')&&(props.kind==='DEVICE'||canLocation.value))
const relatedCases=computed(()=>props.cases.filter(c=>c.kind===props.kind))
const comparison=computed(()=>({SAME:'一致（仅标识）',DIFFERENT:'有变化，原因待核实',UNKNOWN:'证据不足'}[devices.value?.installationComparison||'UNKNOWN']))
const punches=computed(()=>[...(props.track?.punches||[])].sort((a,b)=>Date.parse(a.clientOccurredAt||a.serverReceivedAt)-Date.parse(b.clientOccurredAt||b.serverReceivedAt)))
const firstPunch=computed(()=>punches.value.find(p=>p.eventType==='CHECK_IN')),lastPunch=computed(()=>punches.value.filter(p=>p.eventType==='CHECK_OUT').at(-1))
const firstVisit=computed(()=>[...(props.track?.visits||[])].sort((a,b)=>Date.parse(a.checkedInAt)-Date.parse(b.checkedInAt))[0])
const lastVisit=computed(()=>(props.track?.visits||[]).filter(v=>v.checkedOutAt).sort((a,b)=>Date.parse(a.checkedOutAt!)-Date.parse(b.checkedOutAt!)).at(-1))
const locationEvents=computed(()=>[
  ...punches.value.map((p,i)=>({id:`p-${i}`,at:p.clientOccurredAt||p.serverReceivedAt,title:p.eventType==='CHECK_IN'?'上班签到':'下班签退',detail:p.longitude==null||p.latitude==null?'位置未获得':'已记录位置，地点属性待确认'})),
  ...(firstVisit.value?[{id:'first',at:firstVisit.value.checkedInAt,title:'首次到店',detail:firstVisit.value.storeName}]:[]),
  ...(lastVisit.value?[{id:'last',at:lastVisit.value.checkedOutAt!,title:'最后一次离店',detail:lastVisit.value.storeName}]:[]),
].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)))
function elapsed(from:string|null|undefined,to:string|null|undefined){if(!from||!to)return '无法计算';const minutes=Math.floor((Date.parse(to)-Date.parse(from))/60000);return Number.isFinite(minutes)&&minutes>=0?`${minutes}分钟`:'时间待核实'}
let generation=0,aborter:AbortController|null=null,pending:{note:string;key:string}|null=null
let map:{destroy():void;add(items:unknown[]):void;setFitView():void;setZoomAndCenter(zoom:number,position:number[]):void}|null=null
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
function changed(item:FieldworkCase){emit('changed',item)}
async function load(){
  const version=++generation;aborter?.abort();aborter=new AbortController();devices.value=null;error.value='';loading.value=true
  if(!auth.hasPermission('sales:risk:read')){error.value='暂无核查查看权限';loading.value=false;return}
  try{
    if(props.kind==='DEVICE'){const result=await deviceEvidence(props.person.salesProfileId,props.workDayId,aborter.signal);if(version===generation)devices.value=result}
    else {if(!canLocation.value){error.value='暂无精确位置权限';return}await nextTick();await renderMap(version)}
  }catch(e){if(version===generation)error.value=e instanceof Error?e.message:'证据读取失败'}finally{if(version===generation)loading.value=false}
}
async function renderMap(version:number){
  if(!isAmapJsConfigured()){mapMessage.value='地图暂不可用';return}
  const sdk=await loadAmapJsApi() as unknown as {Map:new(e:HTMLElement,o:Record<string,unknown>)=>NonNullable<typeof map>;Marker:new(o:Record<string,unknown>)=>unknown}
  if(version!==generation||!mapElement.value)return
  map=new sdk.Map(mapElement.value,{zoom:14,viewMode:'2D'})
  const located=punches.value.filter(p=>p.longitude!=null&&p.latitude!=null)
  map.add(located.map(p=>new sdk.Marker({position:[p.longitude,p.latitude],title:`${fieldClock(p.clientOccurredAt||p.serverReceivedAt)} ${p.eventType==='CHECK_IN'?'签到':'签退'}`})))
  if(!located.length)mapMessage.value='暂无可靠打卡位置'
  else if(located.every(p=>p.longitude===located[0]!.longitude&&p.latitude===located[0]!.latitude))map.setZoomAndCenter(14,[located[0]!.longitude,located[0]!.latitude])
  else map.setFitView()
}
async function start(){
  if(!canWrite.value||saving.value||!note.value.trim())return
  if(!pending||pending.note!==note.value.trim())pending={note:note.value.trim(),key:crypto.randomUUID()}
  const version=generation;saving.value=true;error.value=''
  try{const item=await startFieldReview(props.person.salesProfileId,props.workDayId,props.kind,pending.note,pending.key);if(version===generation){emit('changed',item);note.value='';pending=null}}
  catch(e){if(version===generation)error.value=e instanceof Error?e.message:'核查保存失败'}finally{if(version===generation)saving.value=false}
}
function clear(){generation++;aborter?.abort();map?.destroy();map=null;devices.value=null;note.value='';pending=null}
watch(owner,clear)
onMounted(load)
onBeforeUnmount(clear)
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.field-inspector{display:flex;flex-direction:column;gap:18px}.inspector-person{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:1px solid $color-border-base}.inspector-person strong{font-size:16px}.inspector-facts{margin:0}.inspector-facts>div{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:1px solid $color-border-base;font-size:14px}.inspector-facts dt{color:$color-text-secondary}.inspector-facts dd{margin:0;text-align:right}.field-inspector h3{font-size:16px;margin:0}.inspector-events{padding:0 0 0 12px;margin:0;list-style:none}.inspector-events li{position:relative;display:flex;gap:16px;padding:0 0 20px 20px;border-left:1px solid $color-border-base}.inspector-events li:before{position:absolute;content:'';left:-4px;top:5px;width:7px;height:7px;background:$color-primary;border-radius:50%}.inspector-events time{font-variant-numeric:tabular-nums;white-space:nowrap}.inspector-events strong{font-size:14px}.inspector-events p{margin:7px 0;font-size:13px;overflow-wrap:anywhere}.inspector-events small{display:block;font-size:12px;color:$color-text-secondary;line-height:1.8}.inspector-note{margin:0;padding:12px;background:#f5f7fa;border-radius:4px;color:$color-text-secondary;font-size:13px;line-height:1.7}.inspector-review{display:flex;flex-direction:column;gap:12px}.inspector-review .el-button{align-self:flex-start}.inspector-map-wrap{height:200px;position:relative;border-radius:6px;overflow:hidden}.inspector-map{height:100%}.inspector-map-message{position:absolute;inset:0;display:grid;place-items:center;background:#f5f7fa;color:$color-text-secondary}
</style>
