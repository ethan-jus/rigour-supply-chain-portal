<template>
  <el-result v-if="!canReview" icon="warning" title="暂无拜访申诉处理权限" />
  <section v-else class="appeals-page">
    <div class="appeals-toolbar list-filters"><div class="list-filter-field list-filter-field--select"><el-select v-model="status" aria-label="申诉状态" @change="reset"><el-option label="待处理" value="PENDING"/><el-option label="已处理" value="RESOLVED"/></el-select></div><el-button :loading="loading" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-table v-loading="loading" :data="rows" empty-text="暂无销售申诉" class="supply-scroll-table" stripe>
      <el-table-column prop="storeName" label="门店" min-width="180" show-overflow-tooltip/>
      <el-table-column prop="employeeCode" label="销售工号" width="120"/>
      <el-table-column label="拜访时间" width="180"><template #default="{row}">{{ time(row.visitedAt) }}</template></el-table-column>
      <el-table-column label="申诉原因" min-width="240" show-overflow-tooltip><template #default="{row}">{{ row.appeal.reason }}</template></el-table-column>
      <el-table-column label="申诉时间" width="180"><template #default="{row}">{{ time(row.appeal.submittedAt) }}</template></el-table-column>
      <el-table-column label="操作" width="110" fixed="right"><template #default="{row}"><el-button link type="primary" @click="select(row as VisitAppealRow)">{{ status==='PENDING'?'处理申诉':'查看结果' }}</el-button></template></el-table-column>
    </el-table>
    <ListTableFooter><CompactPagination v-model:current-page="page" v-model:page-size="size" :total="total" @current-change="load" @size-change="reset"/></ListTableFooter>
    <el-drawer :model-value="selected!=null" :title="selected?.storeName||'拜访申诉'" size="560px" @close="close">
      <template v-if="selected"><p class="appeal-label">自动核验依据</p><p>{{ verificationReason(selected.appeal.originalReason) || selected.appeal.originalState }}</p><p class="appeal-label">销售申诉</p><p class="appeal-text">{{ selected.appeal.reason }}</p>
        <CrmVisitEvidence v-if="selected.captureRef" :capture-id="selected.captureRef" :permissions="permissions"/>
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false"/>
        <template v-if="selected.appeal.status==='PENDING'"><p class="appeal-label">处理结论 <span class="required">*</span></p><el-radio-group v-model="decision"><el-radio value="EFFECTIVE">申诉通过，确认有效</el-radio><el-radio value="INVALID">申诉驳回</el-radio></el-radio-group><p class="appeal-label">处理依据 <span class="required">*</span></p><el-input v-model="note" type="textarea" :rows="4" :maxlength="1000" :disabled="saving" placeholder="填写核对原始材料后的处理依据"/><el-button class="appeal-submit" type="primary" :loading="saving" :disabled="detailLoading||!verification" @click="submit">提交处理结果</el-button></template>
        <template v-else><p class="appeal-label">处理结果</p><p>{{ selected.appeal.decision==='EFFECTIVE'?'核验通过':'申诉驳回' }}</p><p class="appeal-text">{{ selected.appeal.reviewNote }}</p></template>
      </template>
    </el-drawer>
  </section>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import CrmVisitEvidence from '../crm/CrmVisitEvidence.vue'
import {readAppeals,readVerification,decideAppeal,verificationReason,type VisitAppealRow,type VisitVerification} from '@/api/core/visit-verification'
const auth=useAuthStore(),canReview=computed(()=>auth.hasPermission('crm:store:visit-review')),permissions=computed(()=>auth.user?.permissions||[])
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,permissions.value]))
const status=ref('PENDING'),page=ref(1),size=ref(20),total=ref(0),rows=ref<VisitAppealRow[]>([]),loading=ref(false),error=ref('')
const selected=ref<VisitAppealRow|null>(null),verification=ref<VisitVerification|null>(null),note=ref(''),decision=ref(''),saving=ref(false),detailLoading=ref(false),detailError=ref('')
let generation=0,detailGeneration=0,abort:AbortController|null=null
const time=(v:string)=>new Date(v).toLocaleString('zh-CN',{hour12:false})
const message=(e:unknown)=>e instanceof Error?e.message:'操作未完成，请重试'
async function load(){if(!canReview.value)return;const current=++generation;abort?.abort();abort=new AbortController();loading.value=true;error.value='';try{const result=await readAppeals(status.value,page.value,size.value,abort.signal);if(current===generation){rows.value=result.items;total.value=result.total}}catch(e){if(current===generation)error.value=message(e)}finally{if(current===generation)loading.value=false}}
function reset(){page.value=1;load()}
function close(){if(saving.value)return;detailGeneration++;selected.value=null;verification.value=null;note.value='';decision.value='';detailError.value=''}
async function select(row:VisitAppealRow){if(saving.value||!canReview.value)return;close();selected.value=row;const current=++detailGeneration;detailLoading.value=true;try{const value=await readVerification(row.storeId,row.visitId);if(current===detailGeneration)verification.value=value}catch(e){if(current===detailGeneration)detailError.value=message(e)}finally{if(current===detailGeneration)detailLoading.value=false}}
async function submit(){if(saving.value||!canReview.value||!selected.value||!verification.value)return;if(!decision.value||!note.value.trim()){detailError.value='请选择处理结论并填写处理依据';return}const row=selected.value,current=detailGeneration;saving.value=true;detailError.value='';try{await decideAppeal(row.storeId,row.visitId,verification.value.revision,decision.value,note.value.trim());if(current===detailGeneration){saving.value=false;close();await load()}}catch(e){if(current===detailGeneration)detailError.value=message(e)}finally{saving.value=false}}
watch(owner,()=>{generation++;detailGeneration++;abort?.abort();rows.value=[];total.value=0;selected.value=null;verification.value=null;note.value='';decision.value='';load()})
onMounted(load);onBeforeUnmount(()=>{generation++;detailGeneration++;abort?.abort()})
</script>
<style scoped lang="scss">
@use '@/assets/styles/list-filters';
.appeals-page {display:flex;flex-direction:column;gap:16px;min-height:0;}
.appeals-toolbar {display:flex;align-items:center;gap:12px;}
.appeal-label {margin-top:24px;color:var(--el-text-color-secondary);}
.appeal-text {white-space:pre-wrap;line-height:1.6;}
.required {color:var(--el-color-danger);}
.appeal-submit {margin-top:20px;}
</style>
