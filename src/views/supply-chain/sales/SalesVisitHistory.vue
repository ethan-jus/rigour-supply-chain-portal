<template>
  <section class="visit-history" v-loading="loading">
    <div class="history-heading"><strong>同店历史对比</strong><el-button link type="primary" :disabled="loading" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="history">
      <p v-if="!history.storeLinked" class="history-note">尚未关联正式 CRM 门店，暂不比较复访。</p>
      <template v-else>
        <div class="history-counts"><div><span>本人近 7 天</span><strong>{{ history.ownVisits7 }}次 / {{ history.ownDays7 }}天</strong></div><div><span>本人近 30 天</span><strong>{{ history.ownVisits30 }}次 / {{ history.ownDays30 }}天</strong></div><div><span>授权范围近 30 天</span><strong>{{ history.visibleVisits30 }}次 / {{ history.visibleDays30 }}天</strong></div></div>
        <p class="history-note">统计本次之前已关联同一门店的现场采集，按业务日期去重；次数不代表有效拜访或异常。</p>
        <div class="history-current"><span>本次记录</span><p>{{ history.current.resultNote || '未填写拜访结果' }}</p></div>
        <el-empty v-if="!history.items.length" description="近 30 天暂无可见历史采集" :image-size="44" />
        <article v-for="item in history.items" :key="item.visitId" class="history-item"><div><strong>{{ item.businessDate }} · {{ fieldClock(item.checkedInAt) }}</strong><el-tag size="small" type="info">{{ item.salesProfileId===history.current.salesProfileId?'本人':'授权范围内销售' }}</el-tag></div><p>{{ item.resultNote || '未填写拜访结果' }}</p><el-button link type="primary" @click="open(item)">查看历史材料</el-button></article>
        <div v-if="history.total>10" class="history-pages"><el-button :disabled="page===1||loading" @click="move(-1)">上一页</el-button><span>{{ page }} / {{ Math.ceil(history.total/10) }}</span><el-button :disabled="page*10>=history.total||loading" @click="move(1)">下一页</el-button></div>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fieldClock, type TrackVisit } from '@/api/core/sales-fieldwork'
import { visitHistory, type VisitHistory, type HistoryCapture } from '@/api/core/sales-fieldwork-evidence'
const props=defineProps<{visitId:string}>(),emit=defineEmits<{open:[visit:TrackVisit]}>(),auth=useAuthStore()
const history=ref<VisitHistory|null>(null),loading=ref(false),error=ref(''),page=ref(1)
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
let generation=0,controller:AbortController|null=null
async function load(){const current=++generation;controller?.abort();controller=new AbortController();history.value=null;error.value='';loading.value=true;if(!auth.hasPermission('sales:risk:read')){loading.value=false;error.value='暂无历史核查权限';return}try{const result=await visitHistory(props.visitId,page.value,controller.signal);if(current===generation)history.value=result}catch(e){if(current===generation)error.value=e instanceof Error?e.message:'历史记录读取失败'}finally{if(current===generation)loading.value=false}}
function move(step:number){page.value+=step;void load()}
function open(item:HistoryCapture){emit('open',{visitId:item.visitId,storeId:null,sequence:0,storeName:item.storeName||'历史门店',checkedInAt:item.checkedInAt,checkedOutAt:item.checkedOutAt,dwellMinutes:item.checkedOutAt?Math.max(0,Math.floor((Date.parse(item.checkedOutAt)-Date.parse(item.checkedInAt))/60000)):0,reviewStatus:item.captureStatus,visitType:'UNKNOWN',longitude:null,latitude:null})}
watch(()=>props.visitId,()=>{page.value=1;void load()})
watch(owner,()=>{generation++;controller?.abort();history.value=null;loading.value=false})
onMounted(load)
onBeforeUnmount(()=>{generation++;controller?.abort()})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.visit-history{padding:16px;border:1px solid $color-border-base;border-radius:6px;background:$color-bg-white}.history-heading,.history-item>div{display:flex;align-items:center;justify-content:space-between;gap:12px}.history-counts{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px}.history-counts>div{display:flex;flex-direction:column;gap:8px}.history-counts span,.history-current>span{font-size:12px;color:$color-text-secondary}.history-counts strong{font-size:16px;font-variant-numeric:tabular-nums}.history-note{font-size:12px;color:$color-text-secondary;line-height:1.7}.history-current{padding:12px;background:#f3f6fc;border-radius:4px}.history-current p,.history-item p{font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.history-item{padding:14px 0;border-bottom:1px solid $color-border-base}.history-item strong{font-size:13px}.history-pages{display:flex;align-items:center;justify-content:space-between;margin-top:16px;font-size:12px}
</style>
