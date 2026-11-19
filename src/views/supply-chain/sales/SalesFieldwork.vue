<template>
  <div class="fieldwork">
    <SalesFieldworkDay v-if="selected" :person="selected" :date="date" @back="selected = null" @changed="load" />
    <div v-show="!selected" class="fieldwork-list">
      <div class="fieldwork-totals">
        <button v-for="item in metrics" :key="item.label" :disabled="!item.status" @click="selectStatus(item.status)"><span>{{ item.label }}</span><strong>{{ item.count ?? '—' }}</strong></button>
      </div>
      <OrderRegisterFilterCard class="order-register-filter--compact" :loading="loading" @search="search" @reset="reset">
        <template #primary>
          <div class="fieldwork-shortcuts"><el-button :type="date === today ? 'primary' : 'default'" @click="selectDate(today)">今日</el-button><el-button :type="date === yesterday ? 'primary' : 'default'" @click="selectDate(yesterday)">昨日</el-button></div>
          <div class="list-filter-field list-filter-field--date"><el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" aria-label="作业日期" @change="search" /></div>
          <div class="list-filter-group"><div class="list-filter-field list-filter-field--select"><el-select v-model="departmentId" clearable filterable placeholder="全部部门" aria-label="部门"><el-option v-for="item in departments" :key="item.id" :label="item.name" :value="item.id" /></el-select></div><el-checkbox v-model="includeDescendants">含子部门</el-checkbox></div>
          <div class="list-filter-field list-filter-field--select"><el-select v-model="status" clearable placeholder="全部工作状态" aria-label="工作状态"><el-option label="外勤中" value="ACTIVE" /><el-option label="未签到" value="NOT_STARTED" /><el-option label="已签退" value="FINISHED" /></el-select></div>
          <div class="list-filter-field"><el-input v-model="keyword" clearable placeholder="姓名 / 编号" aria-label="搜索销售" @keyup.enter="search" /></div>
          <div class="list-filter-field list-filter-field--select"><el-select v-model="riskKind" clearable placeholder="全部核查类型" aria-label="核查类型"><el-option label="设备核查" value="DEVICE" /><el-option label="地点核查" value="LOCATION" /><el-option label="轨迹缺口" value="TRACK_GAP" /></el-select></div>
          <el-checkbox v-model="pendingOnly" @change="search">只看待核查</el-checkbox>
        </template>
      </OrderRegisterFilterCard>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert v-if="departmentError" :title="`部门选项读取失败：${departmentError}`" type="warning" :closable="false"><el-button link type="primary" @click="loadDepartments">重试</el-button></el-alert>
      <el-card shadow="never" class="fieldwork-table">
        <el-table v-loading="loading" :data="result?.items || []" row-key="salesProfileId" height="100%" class="supply-scroll-table" empty-text="当前筛选条件下暂无记录" @row-dblclick="openDay">
          <el-table-column label="销售 / 部门" min-width="210" fixed><template #default="{row}"><div class="fieldwork-person"><strong>{{ row.employeeName }}</strong><span>{{ row.departmentName || row.employeeCode || '—' }}</span></div></template></el-table-column>
          <el-table-column label="签到 / 签退" min-width="150"><template #default="{row}">{{ fieldClock(row.checkedInAt) }} / {{ fieldClock(row.checkedOutAt) }}</template></el-table-column>
          <el-table-column label="工作状态" width="115"><template #default="{row}"><el-tag :type="row.status === 'ACTIVE' ? 'primary' : row.status === 'FINISHED' ? 'success' : 'info'" effect="light">{{ fieldStatus(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="已记录里程（估算）" min-width="190"><template #default="{row}"><div class="fieldwork-distance"><strong>{{ row.summaryPending ? '计算中' : fieldDistance(row.distanceMeters) }}</strong><span v-if="row.gapCount">{{ row.gapCount }}处轨迹缺失</span></div></template></el-table-column>
          <el-table-column label="拜访" width="90"><template #default="{row}">{{ row.visitCount }}次</template></el-table-column>
          <el-table-column label="待核查" width="130"><template #default="{row}"><el-tag v-if="row.pendingReviewCount" type="warning" effect="plain">{{ row.pendingReviewCount }}项</el-tag><span v-else>—</span></template></el-table-column>
          <el-table-column label="操作" width="110" fixed="right"><template #default="{row}"><el-button type="primary" link :disabled="!row.workDayId" @click="openDay(row as FieldPersonDay)">查看当日</el-button></template></el-table-column>
        </el-table>
        <ListTableFooter><CompactPagination v-model:current-page="page" v-model:page-size="pageSize" :total="result?.total || 0" :page-sizes="[20,50,100]" @current-change="load" @size-change="search" /></ListTableFooter>
      </el-card>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { defineAsyncComponent, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import { useAuthStore } from '@/stores/auth'
import { fieldworkPage, fieldworkDepartments, fieldClock, fieldDistance, fieldStatus, type FieldPersonDay, type FieldworkPage } from '@/api/core/sales-fieldwork'
const SalesFieldworkDay = defineAsyncComponent(() => import('./SalesFieldworkDay.vue'))
const auth = useAuthStore()
function localDate(value: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit' }).format(value) }
const today = localDate(new Date()), yesterday = localDate(new Date(Date.now()-86400000))
const date=ref(today), status=ref(''), keyword=ref(''), page=ref(1), pageSize=ref(20)
const departmentId=ref(''),includeDescendants=ref(false),pendingOnly=ref(useRoute()?.query.pendingOnly==='1'),riskKind=ref(''),departments=ref<Array<{id:string;name:string}>>([]),departmentError=ref('')
let departmentRequest=0,departmentController:AbortController|null=null
const result=ref<FieldworkPage | null>(null), selected=ref<FieldPersonDay | null>(null), loading=ref(false), error=ref('')
let request=0, controller: AbortController | null=null
const owner=computed(()=>JSON.stringify([auth.user?.tenantId,auth.user?.id,auth.user?.permissions]))
const metrics=computed(()=>[
  {label:'外勤中',count:result.value?.totals.active,status:'ACTIVE'},
  {label:'未签到',count:result.value?.totals.notStarted,status:'NOT_STARTED'},
  {label:'已签退',count:result.value?.totals.finished,status:'FINISHED'},
  {label:'定位异常',count:result.value?.totals.locationAnomaly,status:''},
  {label:'待核查',count:result.value?.totals.pendingReview,status:''},
])
async function load() {
  const version=++request, identity=owner.value; controller?.abort(); controller=new AbortController()
  if(!auth.hasPermission('sales:dashboard:read')) {result.value=null;loading.value=false;error.value='暂无外勤监督权限';return}
  loading.value=true;error.value=''
  try { const data=await fieldworkPage({date:date.value,status:status.value,keyword:keyword.value.trim(),departmentId:departmentId.value,includeDescendants:includeDescendants.value,pendingOnly:pendingOnly.value,riskKind:riskKind.value,page:page.value,pageSize:pageSize.value},controller.signal);if(version===request&&identity===owner.value)result.value=data }
  catch(e) {if(version===request&&identity===owner.value){result.value=null;error.value=e instanceof Error?e.message:'外勤记录读取失败'}}
  finally {if(version===request)loading.value=false}
}
function search() {page.value=1;void load()}
function reset() {date.value=today;status.value='';keyword.value='';departmentId.value='';includeDescendants.value=false;pendingOnly.value=false;riskKind.value='';search()}
function selectDate(value:string) {date.value=value;search()}
function selectStatus(value:string) {if(value){status.value=status.value===value?'':value;search()}}
function openDay(row:FieldPersonDay) {if(row.workDayId)selected.value=row}
async function loadDepartments(){const version=++departmentRequest;departmentController?.abort();departmentController=new AbortController();departments.value=[];departmentError.value='';if(!auth.hasPermission('sales:dashboard:read'))return;try{const items=await fieldworkDepartments(departmentController.signal);if(version===departmentRequest)departments.value=items}catch(e){if(version===departmentRequest)departmentError.value=e instanceof Error?e.message:'部门选项读取失败'}}
watch(owner,()=>{request++;controller?.abort();result.value=null;selected.value=null;departmentId.value='';void loadDepartments();void load()})
onMounted(()=>{void loadDepartments();void load()})
onBeforeUnmount(()=>{request++;controller?.abort();departmentRequest++;departmentController?.abort()})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/list-filters';
.fieldwork { display:flex; flex:1; flex-direction:column; min-height:0; gap:12px; }
.fieldwork-list { display:flex; flex:1; flex-direction:column; min-height:0; gap:12px; }
.fieldwork-totals { display:flex; align-items:center; padding:18px 4px; background:$color-bg-white; border:1px solid $color-border-base; border-radius:6px; }
.fieldwork-totals button { display:flex; align-items:center; justify-content:center; flex:1; gap:20px; background:none; border:0; border-right:1px solid $color-border-base; color:$color-text-primary; cursor:pointer; font-size:14px; }
.fieldwork-totals button:last-child { border:0; }.fieldwork-totals button:disabled { cursor:default; }
.fieldwork-totals strong { color:$color-primary; font-size:28px; font-variant-numeric:tabular-nums; }
.fieldwork-shortcuts { display:flex; gap:0; }.fieldwork-shortcuts .el-button+.el-button { margin-left:0; }
.fieldwork-table { flex:1; min-height:400px; }.fieldwork-table :deep(.el-card__body) { height:100%; box-sizing:border-box; display:flex; flex-direction:column; padding:0; }
.fieldwork-table :deep(.el-table) { flex:1; }.fieldwork-table :deep(.el-table__cell) { padding:13px 0; }
.fieldwork-person,.fieldwork-distance { display:flex; flex-direction:column; gap:4px; }.fieldwork-person strong { font-weight:600; }
.fieldwork-person span,.fieldwork-distance span { color:$color-text-secondary; font-size:12px; }.fieldwork-distance strong { font-size:16px; font-weight:600; font-variant-numeric:tabular-nums; }
@media(max-width:900px){.fieldwork-totals button{gap:8px;flex-direction:column;}.fieldwork-totals strong{font-size:23px;}}
</style>
