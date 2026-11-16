<template>
  <section class="case-panel">
    <div class="case-heading"><strong>待核查事项</strong><span>{{ cases.length }}项</span></div>
    <el-empty v-if="!cases.length" description="暂无核查事项" :image-size="48" />
    <template v-else>
      <div class="case-options"><button v-for="item in cases" :key="item.id" :class="{active:chosen?.id===item.id}" @click="select(item)"><span>{{ item.title }}</span><el-tag size="small" :type="item.status==='RESOLVED'?'success':'warning'">{{ caseStatus(item.status) }}</el-tag></button></div>
      <template v-if="chosen">
        <div class="case-section"><strong>员工说明</strong><p v-if="!statements.length" class="muted">{{ chosen.status==='AWAITING_STATEMENT'?'等待员工补充说明':'暂无说明' }}</p><article v-for="event in statements" :key="event.id" class="case-statement"><time>{{ displayDateTime(event.createdAt) }}</time><p>{{ event.note }}</p></article></div>
        <div v-if="canWrite" class="case-section"><strong>风控处理</strong><el-radio-group v-model="decision"><el-radio value="CLEARED">排除疑点</el-radio><el-radio value="NEEDS_INFO">待补充</el-radio><el-radio value="CONFIRMED">确认异常</el-radio></el-radio-group><el-input v-model="note" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="填写核查依据" /><el-alert v-if="error" :title="error" type="error" :closable="false" /><div class="case-actions"><el-button type="primary" :loading="saving" :disabled="!note.trim()" @click="save">保存核查</el-button><el-button :disabled="saving||!note.trim()" @click="requestStatement">请销售说明</el-button></div></div>
        <el-collapse class="case-history"><el-collapse-item title="处理记录" name="history"><article v-for="event in reviews" :key="event.id"><span>{{ decisionLabel(event.decision) }}</span><time>{{ displayDateTime(event.createdAt) }}</time><p>{{ event.note }}</p></article><p v-if="!reviews.length" class="muted">暂无处理记录</p></el-collapse-item></el-collapse>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { displayDateTime } from '@/utils/business-date'
import { caseStatus, saveCaseReview, type FieldworkCase } from '@/api/core/sales-fieldwork-review'
const props=defineProps<{cases:FieldworkCase[]}>(),emit=defineEmits<{changed:[item:FieldworkCase]}>()
const auth=useAuthStore(),selected=ref(''),decision=ref('NEEDS_INFO'),note=ref(''),saving=ref(false),error=ref('')
const chosen=computed(()=>props.cases.find(c=>c.id===selected.value)||props.cases[0]||null)
const statements=computed(()=>chosen.value?.events.filter(e=>e.employeeStatement)||[]),reviews=computed(()=>chosen.value?.events.filter(e=>!e.employeeStatement)||[])
const canWrite=computed(()=>auth.hasPermission('sales:risk:write'))
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
let pending:{key:string;id:string;note:string;decision:string;version:number}|null=null
function select(item:FieldworkCase){if(saving.value)return;selected.value=item.id;note.value='';error.value='';pending=null}
function decisionLabel(value:string|null){return ({CLEARED:'排除疑点',NEEDS_INFO:'请求补充说明',CONFIRMED:'确认异常'} as Record<string,string>)[value||'']||'处理记录'}
async function save(){
  const item=chosen.value,identity=owner.value
  if(!item||!canWrite.value||saving.value||!note.value.trim())return
  if(!pending||pending.id!==item.id||pending.note!==note.value.trim()||pending.decision!==decision.value||pending.version!==item.version)pending={key:crypto.randomUUID(),id:item.id,note:note.value.trim(),decision:decision.value,version:item.version}
  saving.value=true;error.value=''
  try{const updated=await saveCaseReview(item,pending.decision,pending.note,pending.key);if(owner.value!==identity)return;emit('changed',updated);note.value='';pending=null}
  catch(e){if(owner.value===identity)error.value=e instanceof Error?e.message:'核查保存失败'}finally{saving.value=false}
}
function requestStatement(){decision.value='NEEDS_INFO';void save()}
watch(owner,()=>{selected.value='';note.value='';pending=null;error.value=''})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.case-panel{background:$color-bg-white;border:1px solid $color-border-base;border-radius:6px;padding:16px;min-width:0}.case-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.case-heading>span,.muted,time{color:$color-text-secondary;font-size:12px}.case-options{display:flex;flex-direction:column;gap:6px}.case-options button{border:1px solid transparent;background:#f7f9fc;border-radius:4px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer;color:$color-text-primary}.case-options button.active{border-color:#a9c4ff;background:#f0f5ff}.case-section{display:flex;flex-direction:column;gap:12px;padding:18px 0;border-top:1px solid $color-border-base;margin-top:16px}.case-section p{margin:0;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.case-section .el-radio-group{flex-wrap:wrap;gap:4px}.case-section .el-radio{margin-right:12px}.case-statement{padding:12px;background:#f5f7fa;border-radius:4px}.case-statement time{display:block;margin-bottom:6px}.case-actions{display:flex;flex-wrap:wrap;gap:8px}.case-actions .el-button+.el-button{margin-left:0}.case-history article{padding:10px 0;border-top:1px solid $color-border-base}.case-history time{margin-left:12px}.case-history p{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}
</style>
