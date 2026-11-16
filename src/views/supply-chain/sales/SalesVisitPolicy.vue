<template>
  <div class="visit-policy" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert title="销售 APP 拜访规则" description="Sales 统一管理销售作业规则。APP 保留简洁启动；签到、开始/结束拜访和拍照时必须定位。拜访采集规则用于新拜访，进行中和历史拜访保留原版本。" type="info" :closable="false" show-icon />
    <el-card shadow="never">
      <template #header><div class="policy-header"><strong>版本 {{ version }} → {{ version + 1 }}</strong><el-button :disabled="saving" @click="load">重新加载</el-button></div></template>
      <el-form label-position="top" :disabled="!canPublish || saving || loading" @submit.prevent="publish">
        <el-form-item v-if="policyChoices.length > 1" label="选择规则"><el-select v-model="policyCode" @change="selectPolicy"><el-option v-for="item in policyChoices" :key="item.policyCode" :value="item.policyCode" :label="`${item.name} · ${item.scopeType === 'ALL' ? '当前企业' : item.scopeType === 'EMPLOYEE' ? '指定员工' : item.scopeType}`" /></el-select></el-form-item>
        <el-form-item label="政策名称"><el-input v-model="name" maxlength="128" /></el-form-item>
        <p class="hint">适用范围：{{ scopeType }}{{ scopeId ? ' · ' + scopeId : '（当前企业）' }}；发布沿用所选规则范围。</p>
        <h3>定位与到店</h3>
        <div class="policy-grid">
          <el-form-item label="允许距门店最远距离（米）"><el-input-number v-model="form.radiusMeters" :min="1" :max="5000" /></el-form-item>
          <el-form-item label="定位误差上限（米）"><el-input-number v-model="form.captureRules.maximumLocationAccuracyMeters" :min="1" :max="1000" placeholder="不限制" /><span class="hint">留空不限制。依据设备报告精度拦截，不能保证实际误差。</span></el-form-item>
          <el-form-item label="最低停留时间（分钟）"><el-input-number v-model="form.minimumDwellMinutes" :min="0" :max="480" /></el-form-item>
        </div>
        <el-form-item label="超出门店范围自动结束拜访"><el-switch v-model="form.captureRules.automaticCheckout" /><span class="hint">沿用上方距离半径，计入定位误差并连续确认离店后停止录音、异步上传。未填结果仍待补充。</span></el-form-item>
        <h3>现场照片</h3>
        <div class="policy-grid">
          <el-form-item label="最低照片数量"><el-input-number v-model="form.requiredPhotoCount" :min="1" :max="10" /></el-form-item>
        </div>
        <h3>拜访录音</h3>
        <el-form-item label="有效拜访必须有录音"><el-switch v-model="form.recordingEnabled" /></el-form-item>
        <el-form-item label="开始拜访自动录音，完成时自动停止"><el-switch v-model="form.captureRules.automaticRecording" :disabled="!form.recordingEnabled" /><span class="hint">累计录音不设上限，长录音自动分段；不足 30 秒的新片段不保存音频。自动模式隐藏开始、停止按钮，持续显示状态；停止后异步上传，中断时提示恢复。</span></el-form-item>
        <div class="policy-grid">
          <el-form-item label="最低累计录音时长（秒，0 表示不设门槛）"><el-input-number v-model="form.minimumRecordingSeconds" :min="0" :max="28800" /></el-form-item>
          <el-form-item label="允许的片段间隔（秒）"><el-input-number v-model="form.maximumClipGapSeconds" :min="0" :max="3600" /></el-form-item>
        </div>
        <h3>有效性核验</h3>
        <el-form-item label="AI 核验"><el-checkbox v-model="form.aiAsrEnabled">转写</el-checkbox><el-checkbox v-model="form.aiRelevanceEnabled">相关性</el-checkbox><el-checkbox v-model="form.aiDuplicateEnabled">重复录音</el-checkbox></el-form-item>
        <el-form-item label="AI 自动确认阈值"><el-input-number v-model="form.aiAutoConfirmThreshold" :min="0" :max="1" :step="0.05" /></el-form-item>
        <p class="hint">未接触、时长不足或材料缺失仍可结束真实拜访，但不会直接计为有效。上传来源标记不等于设备级防伪证明。</p>
        <el-button type="primary" native-type="submit" :loading="saving" :disabled="!loaded">发布新版本</el-button>
      </el-form>
      <p v-if="!canPublish" class="hint">当前账号可查看规则，没有发布销售规则权限。</p>
    </el-card>
    <el-card shadow="never"><template #header>最近规则版本</template><el-table :data="history"><el-table-column prop="versionNo" label="版本" width="80" /><el-table-column prop="name" label="政策名称" /><el-table-column label="状态" width="100"><template #default="{ row }">{{ row.publishStatus === 'PUBLISHED' ? '已发布' : '草稿' }}</template></el-table-column><el-table-column prop="createdAt" label="创建时间" min-width="200" /><el-table-column prop="createdBy" label="操作人 ID" min-width="250" /></el-table></el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { salesVisitPolicyApi, type VisitPolicy, type VisitPolicyVersion } from '@/api/core/sales-visit-policy'
const auth = useAuthStore()
const canPublish = computed(() => auth.hasPermission('sales:policy:publish') && auth.hasPermission('sales:policy:write'))
const loading = ref(false), saving = ref(false), loaded = ref(false), error = ref(''), version = ref(0), name = ref('销售 APP 拜访规则')
const policyCode = ref('SALES_APP_VISIT'), scopeType = ref('ALL'), scopeId = ref<string | null>(null)
const history = ref<VisitPolicyVersion[]>([])
const policyChoices = computed(() => {
  const latest = new Map<string, VisitPolicyVersion>()
  for (const row of history.value) if (!latest.has(row.policyCode) || latest.get(row.policyCode)!.versionNo < row.versionNo) latest.set(row.policyCode, row)
  return [...latest.values()]
})
const form = reactive<VisitPolicy>({ id: '', radiusMeters: 500, minimumDwellMinutes: 10, requiredPhotoCount: 1, recordingEnabled: true, minimumRecordingSeconds: 0, maximumClipGapSeconds: 30, aiAsrEnabled: true, aiRelevanceEnabled: true, aiDuplicateEnabled: true, aiAutoConfirmThreshold: 0.9, captureRules: { requireLocationOnOpen: false, maximumLocationAccuracyMeters: 100, automaticRecording: true, allowPhotoImport: false, allowRecordingImport: false, automaticCheckout: true } })
watch(() => form.recordingEnabled, (enabled) => { if (!enabled) { form.captureRules.automaticRecording = false; form.aiAsrEnabled = false; form.aiRelevanceEnabled = false; form.aiDuplicateEnabled = false } })
function selectPolicy(code: string) {
  const row = policyChoices.value.find(item => item.policyCode === code)
  if (!row) return
  version.value = row.versionNo; name.value = row.name; policyCode.value = row.policyCode
  scopeType.value = row.scopeType ?? 'ALL'; scopeId.value = row.scopeId
  Object.assign(form, structuredClone(toRaw(row.policy)))
  form.captureRules.automaticCheckout = row.policy.captureRules.automaticCheckout ?? false
  form.captureRules.allowPhotoImport = false
  form.captureRules.allowRecordingImport = false
}
async function load() {
  loading.value = true; error.value = ''; loaded.value = false
  try { const rows = await salesVisitPolicyApi.list(); history.value = rows; const selected = rows.find(row => row.policyCode === policyCode.value) ?? rows[0]; if (selected) selectPolicy(selected.policyCode); else version.value = 0; loaded.value = true }
  catch (e) { error.value = e instanceof Error ? e.message : '读取拜访政策失败' }
  finally { loading.value = false }
}
async function publish() {
  if (!loaded.value || saving.value || !canPublish.value) return
  saving.value = true; error.value = ''
  try { await salesVisitPolicyApi.publish(version.value, policyCode.value, name.value, form, scopeType.value, scopeId.value); ElMessage.success('新版本已发布，仅影响新拜访'); await load() }
  catch (e) { error.value = e instanceof Error ? e.message : '发布失败，请保留当前配置并重试' }
  finally { saving.value = false }
}
onMounted(load)
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.visit-policy { display: flex; flex-direction: column; gap: $spacing-md; }
.policy-header { display: flex; align-items: center; justify-content: space-between; }
.policy-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: $spacing-md; }
.hint { display: block; margin: 8px 0; color: $color-text-secondary; font-size: 13px; line-height: 1.6; }
h3 { margin: 24px 0 16px; font-size: 16px; }
</style>
