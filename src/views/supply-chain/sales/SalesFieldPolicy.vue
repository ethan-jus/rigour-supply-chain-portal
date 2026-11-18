<template>
  <section v-loading="loading" class="field-policy" aria-label="签到与轨迹规则">
    <div class="policy-toolbar"><el-select v-model="selectedCode" aria-label="当前外勤规则" :disabled="saving" @change="resetForm"><el-option v-for="row in choices" :key="row.policy.policyCode" :value="row.policy.policyCode" :label="row.policy.policyName" /></el-select><el-tag v-if="selected" effect="plain">v{{ selected.versionNo }} · {{ scheduled ? '待生效' : '已发布' }}</el-tag><el-button :disabled="saving" @click="reload">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-if="notice" :title="notice" type="success" :closable="false" />
    <el-empty v-if="!selected && !loading && !error" description="暂无外勤规则" />
    <el-form v-if="form" class="policy-form" :disabled="!canPublish || saving" label-position="top" @submit.prevent="publish">
      <div class="identity-row"><el-form-item label="规则名称"><el-input v-model="form.policyName" maxlength="128" aria-label="规则名称" /></el-form-item><el-form-item label="适用范围"><el-select v-model="form.scopeType" aria-label="适用范围" @change="changeScope"><el-option label="全部销售" value="ALL" /><el-option label="指定团队" value="TEAM" /><el-option v-if="originalScope" :label="originalScopeLabel" :value="originalScope" /></el-select></el-form-item><el-form-item v-if="form.scopeType === 'TEAM'" label="销售团队"><el-select v-model="form.scopeId" filterable aria-label="销售团队" placeholder="选择销售团队"><el-option v-for="team in teams" :key="team.id" :value="team.id" :label="team.name" /></el-select></el-form-item></div>
      <div class="day-preview"><div><span>每天开始</span><strong>{{ form.businessDayCutoff.slice(0, 5) }}</strong></div><p>签到、签退共用一个作业日</p><div><span>{{ form.businessDayCutoff.slice(0, 5) === '00:00' ? '当天结束' : '次日结束' }}</span><strong>{{ endTime }}</strong></div></div>
      <div class="policy-columns">
        <div><section class="rule-section"><h2>作业日与打卡</h2><p>签到开始作业，签退结束当前时段。</p><div class="setting"><div><label>每日开始时间</label><small>结束时间自动顺延一天</small></div><el-time-picker v-model="form.businessDayCutoff" format="HH:mm" value-format="HH:mm:ss" :clearable="false" aria-label="每日开始时间" /></div><div class="setting"><div><label>允许签退后恢复作业</label><small>必须填写原因，保留每次签退记录</small></div><el-switch v-model="form.allowResume" aria-label="允许签退后恢复作业" /></div></section>
          <section class="rule-section"><div class="section-heading"><h2>工作时长核验</h2><el-switch v-model="form.workHoursEnabled" aria-label="工作时长核验" /></div><p>只累计实际作业时段，休息时间不计入。</p><div class="setting"><label>标准工作时长</label><div class="unit-input"><el-input-number v-model="form.standardWorkMinutes" :min="1" :max="1440" :precision="0" :disabled="!form.workHoursEnabled" aria-label="标准工作时长" /><span>分钟</span></div></div><div class="setting"><label>最低工作时长</label><div class="unit-input"><el-input-number v-model="form.minimumWorkMinutes" :min="0" :max="1440" :precision="0" :disabled="!form.workHoursEnabled" aria-label="最低工作时长" /><span>分钟</span></div></div><small>不足最低时长标记待核查，不阻止正常签退。</small></section>
          <section class="rule-section"><h2>跨日处理</h2><p>新作业日开始后，停止上一日采集；未签退标记为缺签退，已有记录保留。</p></section></div>
        <div><section class="rule-section"><div class="section-heading"><h2>连续轨迹记录</h2><el-switch v-model="form.locationEnabled" aria-label="连续轨迹记录" /></div><p>仅在签到或恢复作业后采集，签退即停止。</p><div class="setting"><div><label>定位采样间隔</label><small>建议 1 分钟</small></div><div class="unit-input"><el-input-number v-model="form.locationIntervalMinutes" :min="1" :max="1440" :precision="0" :disabled="!form.locationEnabled" aria-label="定位采样间隔" /><span>分钟</span></div></div><div class="setting"><div><label>可接受定位误差</label><small>超出范围的点不计入有效路线</small></div><div class="unit-input"><el-input-number v-model="form.minimumLocationAccuracyMeters" :min="1" :max="1000" :precision="0" :disabled="!form.locationEnabled" aria-label="可接受定位误差" /><span>米</span></div></div><div class="setting"><div><label>断网补传期限</label><small>按原作业时段接收</small></div><div class="unit-input"><el-input-number v-model="offlineHours" :min="1" :max="168" :precision="0" :disabled="!form.locationEnabled" aria-label="断网补传期限" /><span>小时</span></div></div><small>关闭连续轨迹不影响打卡和拜访的单次定位。</small></section>
          <section class="rule-section"><div class="section-heading"><h2>打卡补正</h2><el-switch v-model="form.allowAdjustment" aria-label="允许打卡补正" /></div><p>缺签退或打卡有误，可提交说明复核。</p><div class="setting"><div><label>允许申请期限</label><small>从该作业日结束起算</small></div><div class="unit-input"><el-input-number v-model="form.adjustmentDeadlineHours" :min="1" :max="168" :precision="0" :disabled="!form.allowAdjustment" aria-label="允许申请期限" /><span>小时</span></div></div></section></div>
      </div>
      <div class="publish-row"><div><strong>新规则从下一个作业日生效</strong><small>当前作业日及已有轨迹保留原规则。</small><small v-if="ambiguousScope">此版本包含多个适用范围，不能覆盖发布。</small></div><el-button native-type="submit" type="primary" :loading="saving" :disabled="!canPublish || !dirty || !valid || ambiguousScope">发布新版本</el-button></div>
    </el-form>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { salesFieldPolicyApi, type FieldPolicy, type FieldPolicyVersion } from '@/api/core/sales-field-policy'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const rows = ref<FieldPolicyVersion[]>([]), selectedCode = ref(''), form = ref<FieldPolicy | null>(null)
const teams = ref<{ id: string; name: string }[]>([])
const loading = ref(false), saving = ref(false), error = ref(''), notice = ref('')
const choices = computed(() => { const latest = new Map<string, FieldPolicyVersion>(); for (const row of rows.value) if ((latest.get(row.policy.policyCode)?.versionNo ?? 0) < row.versionNo) latest.set(row.policy.policyCode, row); return [...latest.values()] })
const selected = computed(() => choices.value.find(row => row.policy.policyCode === selectedCode.value))
const scheduled = computed(() => !!selected.value?.effectiveFrom && Date.parse(selected.value.effectiveFrom) > Date.now())
const originalScope = computed(() => ['EMPLOYEE', 'CITY'].includes(selected.value?.policy.scopeType ?? '') ? selected.value!.policy.scopeType : '')
const originalScopeLabel = computed(() => originalScope.value === 'EMPLOYEE' ? '指定员工（保留原范围）' : '指定城市（保留原范围）')
const ambiguousScope = computed(() => rows.value.filter(row => row.id === selected.value?.id).length > 1)
const canPublish = computed(() => auth.hasPermission('sales:policy:write') && auth.hasPermission('sales:policy:publish'))
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(selected.value?.policy))
const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
const valid = computed(() => { const p = form.value; return !!p && !!p.policyName.trim() && /^\d{2}:\d{2}(:\d{2})?$/.test(p.businessDayCutoff) && integer(p.standardWorkMinutes, 1, 1440) && integer(p.minimumWorkMinutes, 0, p.standardWorkMinutes) && integer(p.locationIntervalMinutes, 1, 1440) && integer(p.minimumLocationAccuracyMeters, 1, 1000) && integer(p.offlineUploadDeadlineMinutes, 1, 10080) && (!p.allowAdjustment || integer(p.adjustmentDeadlineHours, 1, 168)) && (p.scopeType === 'ALL' || !!p.scopeId) })
const offlineHours = computed({ get: () => (form.value?.offlineUploadDeadlineMinutes ?? 60) / 60, set: (value: number | undefined) => { if (form.value) form.value.offlineUploadDeadlineMinutes = value == null ? 0 : value * 60 } })
const endTime = computed(() => { const [h, m] = (form.value?.businessDayCutoff ?? '06:00').split(':').map(Number); const end = (h * 60 + m + 1439) % 1440; return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` })
function resetForm() { form.value = selected.value ? { ...selected.value.policy } : null; error.value = ''; notice.value = '' }
function changeScope() { if (form.value) form.value.scopeId = form.value.scopeType === originalScope.value ? selected.value!.policy.scopeId : null }
async function reload() {
  loading.value = true; error.value = ''
  try { const [policies, options] = await Promise.all([salesFieldPolicyApi.list(), salesFieldPolicyApi.teams()]); rows.value = policies; teams.value = options; if (!choices.value.some(row => row.policy.policyCode === selectedCode.value)) selectedCode.value = choices.value[0]?.policy.policyCode ?? ''; resetForm() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '规则加载失败，请重试' }
  finally { loading.value = false }
}
async function publish() {
  if (!form.value || !canPublish.value || !dirty.value || !valid.value || ambiguousScope.value || saving.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try { const result = await salesFieldPolicyApi.publish({ ...form.value }); await reload(); notice.value = `已发布 v${result.versionNo}，从下一个作业日生效。` }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '发布失败，请重试' }
  finally { saving.value = false }
}
onMounted(reload)
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.field-policy { max-width: 1120px; display: flex; flex-direction: column; gap: 18px; }
.policy-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.policy-toolbar .el-select { width: 240px; }
.policy-form { padding: 24px; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: 10px; }
.identity-row { display: flex; gap: 20px; flex-wrap: wrap; }
.identity-row .el-form-item { width: 240px; }
.day-preview { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: #f0f5fc; border-radius: 8px; margin: 4px 0 24px; }
.day-preview span { display: block; color: $color-text-secondary; font-size: 12px; }
.day-preview strong { display: block; margin-top: 4px; font-size: 25px; font-variant-numeric: tabular-nums; font-weight: 600; }
.day-preview p { font-size: 13px; color: #53667d; }
.policy-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 44px; }
.rule-section { padding: 0 0 22px; margin-bottom: 22px; border-bottom: 1px solid $color-border-base; }
h2 { margin: 0; font-size: 16px; line-height: 26px; font-weight: 600; }
p { margin: 7px 0 16px; font-size: 13px; color: $color-text-secondary; line-height: 1.7; }
small { display: block; font-size: 12px; line-height: 1.7; color: $color-text-secondary; margin-top: 4px; }
.setting, .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.setting { margin-top: 18px; font-size: 13px; }
.setting :deep(.el-date-editor) { width: 155px; flex-shrink: 0; }
.unit-input { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.unit-input .el-input-number { width: 128px; }
.unit-input span { width: 28px; font-size: 12px; color: $color-text-secondary; }
.publish-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.publish-row strong { font-size: 13px; font-weight: 500; }
@media (max-width: 900px) { .policy-columns { grid-template-columns: 1fr; gap: 0; } }
@media (max-width: 480px) { .policy-form { padding: 16px; } .day-preview { padding: 14px; } .day-preview p { width: 90px; text-align: center; } .setting { flex-wrap: wrap; } .publish-row { align-items: flex-start; flex-direction: column; } }
</style>
