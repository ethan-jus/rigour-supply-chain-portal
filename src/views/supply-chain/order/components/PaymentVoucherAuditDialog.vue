<template>
  <el-dialog v-model="visible" title="回款凭证核查" fullscreen append-to-body destroy-on-close>
    <div class="audit-page">
      <p class="intro">按交易单号与相同原图核对付款上限和回款分配。金额相符的合并付款不作为异常；风险提示须结合原始凭证核实，不直接认定违规。</p>
      <el-alert type="info" :closable="false" title="扫描当前数据权限内所有月份。日期、客户和业务员仅筛选核查组，关联回款金额仍包含跨月记录。无单号、未识别或裁剪改图的凭证不能保证查全。" />
      <div class="actions">
        <el-button type="primary" :loading="loading" @click="scan">重新扫描全部凭证</el-button>
        <span v-if="data">已扫描 {{ data.paymentsScanned }} 条回款 · {{ data.paymentsWithEvidence }} 条有附件 · {{ displayDateTime(data.scannedAt) }}</span>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <div v-if="data" class="summary">
        <button v-for="(label, code) in auditResultLabels" :key="code" :class="['metric', { active: filters.result === code }]" @click="filters.result = String(code)">
          <span>{{ label }}</span><strong>{{ data.counts[code] || 0 }} <small>组</small></strong>
        </button>
      </div>
      <div class="filters">
        <el-select v-model="filters.result" aria-label="核查类型" style="width:180px"><el-option label="异常和待核" value="ATTENTION" /><el-option label="全部类型" value="" /><el-option v-for="(label, code) in auditResultLabels" :key="code" :label="label" :value="code" /></el-select>
        <el-input v-model="filters.keyword" clearable placeholder="交易单号 / 订单号 / 收款编号" style="width:285px" />
        <el-input v-model="filters.salesperson" clearable placeholder="业务员" style="width:150px" />
        <el-input v-model="filters.customer" clearable placeholder="客户" style="width:180px" />
        <el-date-picker v-model="filters.dates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="回款开始日期" end-placeholder="回款结束日期" style="width:270px" @change="filters.dates ||= []" />
        <el-select v-model="filters.review" aria-label="人工核查状态" style="width:160px"><el-option label="全部处理状态" value="" /><el-option label="未核查 / 需复核" value="PENDING" /><el-option label="数据变化需复核" value="STALE" /></el-select>
        <el-button @click="reset">重置筛选</el-button>
      </div>
      <el-table v-loading="loading" :data="pageRows" stripe border max-height="560" row-key="key" @row-dblclick="openGroup">
        <el-table-column label="核查类型" width="155"><template #default="{ row }"><el-tag :type="row.result === 'BALANCED' ? 'success' : row.result === 'EXCESS' || row.result === 'CONFLICT' ? 'danger' : 'warning'">{{ auditResultLabels[row.result] }}</el-tag></template></el-table-column>
        <el-table-column label="交易单号 / 核查对象" min-width="260"><template #default="{ row }"><el-button link type="primary" @click="openGroup(row as AuditGroup)">{{ row.transactionNo || (row.kind === 'IMAGE' ? '同图关联回款' : row.payments[0]?.paymentNo) }}</el-button></template></el-table-column>
        <el-table-column label="凭证付款金额" width="145"><template #default="{ row }">{{ amount(row.voucherAmount) }}</template></el-table-column>
        <el-table-column label="已明确计入" width="140"><template #default="{ row }">{{ moneyText(row.allocatedAmount) }}<small v-if="row.unresolvedPayments">另 {{ row.unresolvedPayments }} 笔待分配</small></template></el-table-column>
        <el-table-column label="超出金额" width="130"><template #default="{ row }"><strong :class="{ danger: row.excessAmount > 0 }">{{ amount(row.excessAmount) }}</strong></template></el-table-column>
        <el-table-column label="关联回款 / 订单" width="150"><template #default="{ row }">{{ row.payments.length }} / {{ new Set(row.payments.map((p: AuditPayment) => p.orderId)).size }}</template></el-table-column>
        <el-table-column label="核查原因" min-width="290"><template #default="{ row }">{{ row.reasons.join('；') }}</template></el-table-column>
        <el-table-column label="人工结论" width="170"><template #default="{ row }">{{ row.reviewStale ? '数据已变化，需复核' : auditConclusionLabels[row.reviews[0]?.conclusion] || '未核查' }}</template></el-table-column>
        <el-table-column label="操作" fixed="right" width="95"><template #default="{ row }"><el-button link type="primary" @click="openGroup(row as AuditGroup)">查看证据</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="30" :total="filtered.length" layout="total, prev, pager, next" class="pagination" />
    </div>
    <el-dialog v-model="detailVisible" title="核查证据与处理记录" width="min(1400px, 96vw)" append-to-body>
      <template v-if="selected">
        <h3>{{ selected.transactionNo || (selected.kind === 'IMAGE' ? '同图关联回款' : '缺少可核凭证') }}</h3>
        <p>{{ auditResultLabels[selected.result] }} · 凭证付款 {{ amount(selected.voucherAmount) }} · 已明确计入 {{ moneyText(selected.allocatedAmount) }} · 超出 {{ amount(selected.excessAmount) }}</p>
        <el-alert :closable="false" :type="selected.result === 'BALANCED' ? 'success' : 'warning'" :title="selected.reasons.join('；')" />
        <el-table :data="selected.payments" max-height="300" class="detail-table">
          <el-table-column prop="paymentNo" label="收款编号" min-width="200" /><el-table-column prop="orderNo" label="订单号" min-width="160" />
          <el-table-column prop="customer" label="客户" min-width="160" /><el-table-column prop="salesperson" label="业务员" width="95" />
          <el-table-column label="本笔回款" width="115"><template #default="{ row }">{{ moneyText(row.amount) }}</template></el-table-column>
          <el-table-column label="系统回款时间" width="175"><template #default="{ row }">{{ displayDateTime(row.time) }}</template></el-table-column>
          <el-table-column label="计入状态" width="120"><template #default="{ row }">{{ row.excluded ? '排除（仅追溯）' : '有效回款' }}</template></el-table-column>
          <el-table-column label="付款凭证" width="120"><template #default="{ row }"><el-button link type="primary" @click="showImages(row as AuditPayment)">查看 {{ row.attachmentKeys.length }} 张</el-button></template></el-table-column>
        </el-table>
        <div v-if="imagePayment" v-loading="imageLoading" class="images"><b>{{ imagePayment }} 的付款凭证</b><p v-if="imageError" class="danger">{{ imageError }}</p><div v-for="im in images" :key="im.voucherKey" class="image-item"><el-image v-if="im.url" :src="im.url" :preview-src-list="images.flatMap(x => x.url ? [x.url] : [])" preview-teleported fit="contain" style="width:90px;height:110px" /><div>{{ amount(im.voucherAmount) }}<br>{{ im.transactionNo || '无确认单号' }}<br><small>{{ im.evidenceNote }}</small></div></div><p v-if="!imageLoading && !images.length && !imageError">尚无逐图识别信息。请从回款列表原附件核对。</p></div>
        <el-alert v-if="selected.reviewStale" type="warning" :closable="false" title="上次处理后，关联回款或凭证已变化，请重新核查。" />
        <div v-if="canReview" class="review-form"><el-select v-model="conclusion" placeholder="选择人工核查结论" style="width:210px"><el-option v-for="(label, code) in auditConclusionLabels" :key="code" :label="label" :value="code" /></el-select><el-input v-model="note" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="填写核对依据和处理说明（必填）" /><el-button type="primary" :loading="saving" :disabled="!conclusion || !note.trim() || loading" @click="saveReview">保存核查结论</el-button><small>只保存核查记录，不修改回款金额、日期、归属或状态。</small></div>
        <h4>处理历史</h4><el-empty v-if="!selected.reviews.length" description="尚未人工核查" :image-size="45" /><div v-for="r in selected.reviews" :key="r.id" class="history"><b>{{ auditConclusionLabels[r.conclusion] }}</b> · {{ displayDateTime(r.time) }} · 处理人 {{ auditActorLabel(r.actor) }}<p>{{ r.note }}</p></div>
      </template>
    </el-dialog>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { scanPaymentVouchers, reviewPaymentVouchers, type VoucherAuditScan, type AuditGroup, type AuditPayment } from '@/api/core/payment-voucher-audit'
import { getPaymentVoucherTransactions, type PaymentVoucherTransaction } from '@/api/core/order-register'
import { auditResultLabels, auditConclusionLabels, filterAuditGroups } from '@/utils/payment-voucher-audit'
import { moneyText } from '@/utils/order-register-status'
import { displayDateTime } from '@/utils/business-date'
import { auditActorLabel } from '@/utils/audit-actor'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const props=defineProps<{ modelValue: boolean }>()
const emit=defineEmits<{ 'update:modelValue':[value:boolean] }>()
const visible=computed({get:()=>props.modelValue,set:v=>emit('update:modelValue',v)})
const { can }=useSupplyPermissions(), canReview=computed(()=>can('order:payment:check'))
const data=ref<VoucherAuditScan|null>(null), loading=ref(false), error=ref(''), page=ref(1)
const filters=reactive({result:'ATTENTION',keyword:'',salesperson:'',customer:'',dates:[] as string[],review:''})
const filtered=computed(()=>filterAuditGroups(data.value?.groups||[],filters))
const pageRows=computed(()=>filtered.value.slice((page.value-1)*30,page.value*30))
watch(filters,()=>{page.value=1})
const selected=ref<AuditGroup|null>(null), detailVisible=ref(false), conclusion=ref(''), note=ref(''), saving=ref(false)
const imagePayment=ref(''), imageLoading=ref(false), imageError=ref(''), images=ref<PaymentVoucherTransaction[]>([])
let generation=0, imageGeneration=0
const amount=(v:number|null)=>v==null?'未确认':moneyText(v)
function reset(){Object.assign(filters,{result:'ATTENTION',keyword:'',salesperson:'',customer:'',dates:[],review:''})}
watch(()=>props.modelValue,open=>{generation++; if(open) void scan();else{loading.value=false;detailVisible.value=false;imageGeneration++}})
async function scan(){const id=++generation; loading.value=true;error.value='';try{const result=await scanPaymentVouchers();if(id!==generation)return;data.value=result;if(selected.value)selected.value=result.groups.find(g=>g.key===selected.value?.key)||null}catch(e){if(id===generation)error.value=e instanceof Error?e.message:'扫描失败，请重试'}finally{if(id===generation)loading.value=false}}
function openGroup(g:AuditGroup){selected.value=g;detailVisible.value=true;conclusion.value='';note.value='';imageGeneration++;imagePayment.value='';images.value=[];imageError.value=''}
async function showImages(p:AuditPayment){const id=++imageGeneration;imagePayment.value=p.paymentNo;images.value=[];imageError.value='';imageLoading.value=true;try{const result=await getPaymentVoucherTransactions(p.id);if(id===imageGeneration)images.value=result}catch(e){if(id===imageGeneration)imageError.value=e instanceof Error?e.message:'凭证加载失败'}finally{if(id===imageGeneration)imageLoading.value=false}}
async function saveReview(){if(!selected.value)return;const group=selected.value;saving.value=true;try{const r=await reviewPaymentVouchers({groupKey:group.key,fingerprint:group.fingerprint,conclusion:conclusion.value,note:note.value});group.reviews.unshift(r);group.reviewStale=false;note.value='';conclusion.value='';ElMessage.success('核查结论已保存，回款数据未改动')}catch(e){ElMessage.error(e instanceof Error?e.message:'保存失败，请重试')}finally{saving.value=false}}
</script>
<style scoped>
.audit-page{max-width:1800px;margin:auto;padding:0 18px}.intro{color:#536477}.actions,.filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0}.actions span,small{color:#66788a;font-size:12px}.summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:12px;margin:18px 0}.metric{padding:14px;text-align:left;border:1px solid #dfe7ef;background:#f7f9fc;border-radius:8px;cursor:pointer;color:#526477}.metric.active{border-color:#2563eb;background:#eff5ff}.metric strong{display:block;font-size:26px;margin-top:5px;color:#19364f}.danger{color:#c23e35}small{display:block}.pagination{margin:18px 0}.detail-table{margin:16px 0}.review-form{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:20px 0}.review-form .el-textarea{flex:1;min-width:300px}.history{padding:12px;border-bottom:1px solid #e5eaf0}.history p{margin:6px 0}.images{padding:14px;background:#f5f8fb;margin:12px 0}.image-item{display:flex;gap:14px;margin:12px 0;overflow-wrap:anywhere}@media(max-width:1050px){.summary{grid-template-columns:repeat(3,1fr)}}
</style>
