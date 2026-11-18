<template>
  <div class="visit-policy" v-loading="loading">
    <header class="policy-heading">
      <div class="heading-line">
        <div class="title-group"><h1>拜访规则</h1><el-radio-group v-model="ruleArea" class="rule-area-tabs" aria-label="规则类别"><el-radio-button value="visit">拜访采集</el-radio-button><el-radio-button value="field">签到与轨迹</el-radio-button><el-radio-button v-if="auth.hasPermission('crm:store:manage')" value="pool">客户保护与回收</el-radio-button></el-radio-group><span v-if="loaded && ruleArea === 'visit'" class="published">{{ baseline?.publishStatus === 'PUBLISHED' ? '生效中' : '草稿' }} v{{ version }}</span></div>
        <div v-if="ruleArea === 'visit'" class="heading-actions">
          <el-button :icon="activeTab === 'settings' ? Clock : Back" :disabled="!loaded" @click="activeTab = activeTab === 'settings' ? 'history' : 'settings'">{{ activeTab === 'settings' ? '发布记录' : '返回规则' }}</el-button>
          <el-button :icon="Refresh" :disabled="saving || loading" aria-label="重新加载" title="重新加载" @click="reload" />
        </div>
      </div>
      <div v-if="loaded && ruleArea === 'visit'" class="policy-identity">
        <div class="rule-choice"><label for="visit-policy-choice">当前规则</label><el-select id="visit-policy-choice" :model-value="policyCode" :disabled="saving || loading" aria-label="当前规则" @change="changePolicy"><el-option v-for="item in policyChoices" :key="item.policyCode" :value="item.policyCode" :label="item.policyCode === policyCode ? model.name : item.name" /></el-select><el-button text :icon="Edit" :disabled="!canPublish || saving || loading" aria-label="编辑规则名称" title="编辑规则名称" @click="openRename" /></div>
        <span class="policy-scope"><el-icon><User /></el-icon>{{ scopeLabel }}<small v-if="scopeId">（{{ scopeId }}）</small></span>
        <span class="policy-updated">最近发布 {{ formatTime(baseline?.createdAt) }}</span>
      </div>
    </header>
    <div ref="scrollArea" class="policy-scroll">
      <KeepAlive><CrmPoolPolicyEditor v-if="ruleArea === 'pool'" /><SalesFieldPolicy v-else-if="ruleArea === 'field'" /></KeepAlive>
      <template v-if="ruleArea === 'visit'">
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
      <el-alert v-if="notice" :title="notice" type="info" :closable="false" show-icon />
      <el-empty v-if="!loaded && !loading" description="暂无可编辑规则，请重新加载或联系管理员配置规则。" />
      <template v-if="loaded">
        <el-form v-show="activeTab === 'settings'" ref="formRef" class="policy-editor" :model="model" :rules="rules" label-position="top" hide-required-asterisk :disabled="!canPublish || saving || loading" scroll-to-error :scroll-into-view-options="{ block: 'center' }" @submit.prevent="review">
          <div class="rule-stack">
            <section class="rule-section location-section" aria-labelledby="location-title">
              <div class="section-heading"><span class="section-icon"><el-icon><Location /></el-icon></span><h2 id="location-title">定位与到店</h2><span class="section-caption">以客户门店位置为准</span></div>
              <div class="number-grid">
                <el-form-item label="到店范围" prop="policy.radiusMeters"><div class="number-field"><el-input-number v-model="form.radiusMeters" :min="1" :max="5000" :controls="false" aria-label="到店范围" /><span>米</span></div><p class="field-note">范围内允许开始拜访</p></el-form-item>
                <el-form-item label="定位误差上限" prop="policy.captureRules.maximumLocationAccuracyMeters"><div class="number-field"><el-input-number v-model="form.captureRules.maximumLocationAccuracyMeters" :min="1" :max="1000" :controls="false" placeholder="不限制" aria-label="定位误差上限" /><span>米</span></div><p class="field-note" title="按设备报告的精度校验；不代表实际定位没有误差。">留空则不限制</p></el-form-item>
                <el-form-item label="最低停留" prop="policy.minimumDwellMinutes"><div class="number-field"><el-input-number v-model="form.minimumDwellMinutes" :min="0" :max="480" :controls="false" aria-label="最低停留" /><span>分钟</span></div><p class="field-note">0 表示不设门槛</p></el-form-item>
              </div>
              <div class="toggle-row"><div><label for="visit-auto-checkout">离店自动结束拜访</label><p>超过 {{ form.captureRules.automaticCheckoutRadiusMeters ?? form.radiusMeters ?? '—' }} 米、计入定位误差并连续确认后，自动结束。</p></div><el-switch id="visit-auto-checkout" v-model="form.captureRules.automaticCheckout" aria-label="离店自动结束拜访" /></div>
              <el-form-item v-if="form.captureRules.automaticCheckout" label="自动离店距离" prop="policy.captureRules.automaticCheckoutRadiusMeters"><div class="number-field"><el-input-number v-model="form.captureRules.automaticCheckoutRadiusMeters" :min="form.radiusMeters" :max="5000" :controls="false" aria-label="自动离店距离" /><span>米</span></div><p class="field-note">不得小于到店范围</p></el-form-item>
              <p class="section-note"><el-icon><InfoFilled /></el-icon><span>签到、开始/结束拜访、拍照时强制定位，启动 APP 时不申请。</span></p>
            </section>
            <section class="rule-section photo-section" aria-labelledby="photo-title">
              <div class="section-heading"><span class="section-icon"><el-icon><Camera /></el-icon></span><h2 id="photo-title">现场照片</h2><span class="section-caption">门头与到店凭证</span></div>
              <el-radio-group v-model="form.captureRules.allowPhotoImport" class="photo-sources" aria-label="照片来源">
                <el-radio :value="false" border><span class="source-label"><el-icon><Camera /></el-icon><strong>仅现场拍照</strong></span><span class="source-description">直接调用相机，无相册入口</span></el-radio>
                <el-radio :value="true" border><span class="source-label"><el-icon><Picture /></el-icon><strong>允许相册上传</strong></span><span class="source-description">可拍照，也可选择已有照片</span></el-radio>
              </el-radio-group>
              <div class="inline-field photo-count"><div><label for="visit-photo-count">最低门头照数量</label><p>作为有效拜访的必要材料</p></div><el-form-item prop="policy.requiredPhotoCount"><div class="number-field compact-number"><el-input-number id="visit-photo-count" v-model="form.requiredPhotoCount" :min="1" :max="10" :controls="false" aria-label="最低门头照数量" /><span>张</span></div></el-form-item></div>
              <p class="section-note"><el-icon><InfoFilled /></el-icon><span>照片与本次拜访关联；拍照时校验定位。</span></p>
            </section>
          </div>
          <div class="rule-stack">
            <section class="rule-section audio-section" aria-labelledby="audio-title">
              <div class="section-heading"><span class="section-icon"><el-icon><Microphone /></el-icon></span><h2 id="audio-title">拜访录音</h2><div class="recording-master"><label for="visit-recording">要求录音</label><el-switch id="visit-recording" v-model="form.recordingEnabled" aria-label="要求拜访录音" @change="recordingChanged" /></div></div>
              <div class="toggle-row"><div><label for="visit-auto-recording">自动开始与停止</label><p>开始拜访即录音，完成或自动离店时停止。</p></div><el-switch id="visit-auto-recording" v-model="form.captureRules.automaticRecording" :disabled="!form.recordingEnabled" aria-label="自动开始与停止录音" /></div>
              <el-form-item label="录音来源" class="audio-source"><el-radio-group v-model="form.captureRules.allowRecordingImport" class="audio-sources" aria-label="录音来源"><el-radio-button :value="false">仅 APP 现场录音</el-radio-button><el-radio-button :value="true">允许导入录音</el-radio-button></el-radio-group></el-form-item>
              <div class="number-grid two-columns">
                <el-form-item label="有效拜访最低录音时长" prop="policy.minimumRecordingSeconds"><div class="number-field"><el-input-number v-model="minimumRecordingMinutes" :min="0" :max="480" :controls="false" :disabled="!form.recordingEnabled" aria-label="有效拜访最低录音时长" /><span>分钟</span></div><p class="field-note">按服务端核验后的累计录音计算，与停留时长分别判定；0 表示不设门槛。</p></el-form-item>
                <el-form-item label="片段间隔上限" prop="policy.maximumClipGapSeconds"><div class="number-field"><el-input-number v-model="form.maximumClipGapSeconds" :min="0" :max="3600" :controls="false" aria-label="片段间隔上限" /><span>秒</span></div><p class="field-note">两段录音之间允许的间隔</p></el-form-item>
              </div>
              <p class="clip-note"><el-icon><Microphone /></el-icon><span>不足 <strong>30 秒</strong>的片段丢弃；长录音自动分段，停止后异步上传，累计录音不设上限。</span></p>
            </section>
            <section class="rule-section validation-section" aria-labelledby="validation-title">
              <div class="section-heading"><span class="section-icon"><el-icon><CircleCheck /></el-icon></span><h2 id="validation-title">有效性核验</h2><span class="section-caption">拜访结束后执行</span></div>
              <p class="section-note">到店、停留、照片及录音满足规则后自动通过。</p>
              <div class="checks" role="group" aria-label="录音转写"><el-checkbox v-model="form.aiAsrEnabled" :disabled="!form.recordingEnabled" border>录音转写</el-checkbox></div>
              <p class="section-note"><el-icon><InfoFilled /></el-icon><span>转写在后台独立处理，不影响有效性核验；上传异常自动重试。</span></p>
            </section>
          </div>
        </el-form>
        <section v-show="activeTab === 'history'" class="policy-history">
          <h2>{{ baseline?.name }}的发布记录</h2><p class="muted">仅展示当前规则的最近版本，历史规则与拜访快照保留。</p>
          <el-table :data="selectedHistory"><el-table-column label="版本" width="130"><template #default="{ row }"><strong>v{{ row.versionNo }}</strong><el-tag v-if="row.versionNo === version" size="small" type="success">当前版本</el-tag></template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }">{{ row.publishStatus === 'PUBLISHED' ? '已发布' : '草稿' }}</template></el-table-column><el-table-column label="适用范围" min-width="150"><template #default="{ row }">{{ policyScope(row.scopeType) }}</template></el-table-column><el-table-column label="发布时间" min-width="180"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column><el-table-column label="发布人" min-width="130"><template #default="{ row }"><span :title="row.createdBy">{{ actorName(row.createdBy) }}</span></template></el-table-column><el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" @click="showDetail(row.id)">查看规则</el-button></template></el-table-column></el-table>
        </section>
        <p class="effect-note"><el-icon><CircleCheck /></el-icon><span><strong>发布后仅对新拜访生效。</strong>进行中与历史拜访保留原规则，已有数据不回算。</span></p>
      </template>
      </template>
    </div>
    <footer v-if="ruleArea === 'visit'" class="policy-footer">
      <div v-if="error" class="publish-error" role="alert"><span>{{ error }}</span><el-button v-if="needsRecheck" link type="primary" :disabled="saving || loading" @click="recheck">核对最新版本</el-button></div>
      <div class="footer-line"><div class="footer-status" :class="{ 'is-dirty': dirty }" aria-live="polite"><el-icon><CircleCheck /></el-icon><span>{{ !canPublish ? '当前账号没有发布销售规则权限' : !loaded ? '规则尚未加载' : dirty ? `有 ${changes.length} 项未发布修改` : '与已发布规则一致' }}</span><small v-if="loaded">当前版本 v{{ version }}</small></div><div class="footer-actions"><el-button :disabled="!dirty || saving || loading" @click="reset">还原修改</el-button><el-button type="primary" :disabled="!canPublish || !loaded || !dirty || loading || needsRecheck" :loading="saving" @click="review">查看变更并发布</el-button></div></div>
    </footer>
    <el-drawer v-model="reviewOpen" title="发布规则新版本" :size="530" class="visit-policy-review" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
      <template #header="{ titleId }"><div class="review-heading"><h2 :id="titleId">发布规则新版本</h2><p>当前 v{{ version }}，发布后为 v{{ version + 1 }}</p></div></template>
      <div class="review-context"><strong>{{ model.name }}</strong><span>适用范围：{{ scopeLabel }}<small v-if="scopeId">（{{ scopeId }}）</small></span></div>
      <div class="diff-heading">本次修改<span>{{ changes.length }} 项</span></div>
      <ul class="change-list"><li v-for="change in changes" :key="change.key"><span>{{ change.label }}</span><div><span class="previous-value">{{ change.previous }}</span><el-icon aria-label="变更为"><ArrowRight /></el-icon><strong>{{ change.value }}</strong></div></li></ul>
      <p class="review-notice">新开始的拜访使用新版本。进行中与历史拜访保留原规则。</p>
      <template #footer><el-button :disabled="saving" @click="reviewOpen = false">返回编辑</el-button><el-button type="primary" :loading="saving" :disabled="!canPublish || !dirty || needsRecheck" @click="publish">发布新版本</el-button></template>
    </el-drawer>
    <el-dialog v-model="renameOpen" title="编辑规则名称" width="440px" class="visit-policy-dialog" :close-on-click-modal="false">
      <el-form label-position="top" @submit.prevent="applyRename"><el-form-item label="规则名称" :error="nameError"><el-input v-model="nameDraft" maxlength="128" aria-label="规则名称" @keydown.enter.prevent="applyRename" /></el-form-item></el-form>
      <template #footer><el-button @click="renameOpen = false">取消</el-button><el-button type="primary" :disabled="!canPublish || saving || loading" @click="applyRename">应用名称</el-button></template>
    </el-dialog>
    <el-dialog :model-value="!!detail" :title="`规则版本 v${detail?.versionNo ?? ''}`" width="640px" class="visit-policy-dialog" @close="detail = null">
      <template v-if="detail"><p class="muted">{{ policyScope(detail.scopeType) }} · {{ formatTime(detail.createdAt) }}</p><dl class="policy-details"><template v-for="field in policyFields(detail.name, detail.policy)" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></template></dl></template>
      <template #footer><el-button @click="detail = null">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowRight, Back, Camera, CircleCheck, Clock, Edit, InfoFilled, Location, Microphone, Picture, Refresh, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { salesVisitPolicyApi, type VisitPolicy, type VisitPolicyVersion } from '@/api/core/sales-visit-policy'
import CrmPoolPolicyEditor from '../crm/CrmPoolPolicyEditor.vue'
import SalesFieldPolicy from './SalesFieldPolicy.vue'
import { copyVisitPolicy, policyChanges, policyFields, policyScope } from './visit-policy-editor'

const ruleArea = ref('visit')
const auth = useAuthStore()
const canPublish = computed(() => auth.hasPermission('sales:policy:publish') && auth.hasPermission('sales:policy:write'))
const loading = ref(false), saving = ref(false), loaded = ref(false)
const error = ref(''), loadError = ref(''), notice = ref(''), needsRecheck = ref(false)
const policyCode = ref('VISIT-DEFAULT'), version = ref(0), scopeType = ref('ALL'), scopeId = ref<string | null>(null)
const history = ref<VisitPolicyVersion[]>([]), baseline = ref<VisitPolicyVersion | null>(null), detail = ref<VisitPolicyVersion | null>(null)
const activeTab = ref('settings'), reviewOpen = ref(false), formRef = ref<FormInstance>(), scrollArea = ref<HTMLElement>()
const renameOpen = ref(false), nameDraft = ref(''), nameError = ref('')
const form = reactive<VisitPolicy>({ id: '', radiusMeters: 500, minimumDwellMinutes: 10, requiredPhotoCount: 1, recordingEnabled: true, minimumRecordingSeconds: 600, maximumClipGapSeconds: 30, aiAsrEnabled: true, aiRelevanceEnabled: true, aiDuplicateEnabled: true, aiAutoConfirmThreshold: null, captureRules: { requireLocationOnOpen: false, maximumLocationAccuracyMeters: 100, automaticRecording: true, allowPhotoImport: false, allowRecordingImport: false, automaticCheckout: true, automaticCheckoutRadiusMeters: 500 } })
const minimumRecordingMinutes = computed({
  get: () => Number.isFinite(form.minimumRecordingSeconds) ? form.minimumRecordingSeconds / 60 : undefined,
  set: (minutes: number | undefined) => { form.minimumRecordingSeconds = minutes == null ? Number.NaN : Math.round(minutes * 60) },
})
const model = reactive({ name: '', policy: form })
const scopeLabel = computed(() => policyScope(scopeType.value))
const policyChoices = computed(() => {
  const latest = new Map<string, VisitPolicyVersion>()
  for (const row of history.value) if (!latest.has(row.policyCode) || latest.get(row.policyCode)!.versionNo < row.versionNo) latest.set(row.policyCode, row)
  return [...latest.values()]
})
const selectedHistory = computed(() => history.value.filter(row => row.policyCode === policyCode.value).sort((a, b) => b.versionNo - a.versionNo))
const changes = computed(() => baseline.value ? policyChanges(baseline.value.name, baseline.value.policy, model.name, form) : [])
const dirty = computed(() => changes.value.length > 0)
const numberRule = (min: number, max: number, required = true, integer = true) => ({ type: integer ? 'integer' as const : 'number' as const, required, min, max, message: `${required ? '请填写' : '请填写有效数值或留空：'}${min}–${max}${integer ? ' 的整数' : ' 之间的数值'}`, trigger: ['blur', 'change'] })
const rules: FormRules = {
  'policy.radiusMeters': [numberRule(1, 5000)],
  'policy.captureRules.automaticCheckoutRadiusMeters': [{ validator: (_rule, value, callback) => { if (!form.captureRules.automaticCheckout) return callback(); const n = Number(value); callback(value == null || !Number.isInteger(n) || n < form.radiusMeters || n > 5000 ? new Error('自动离店距离不得小于到店范围，且不能超过5000米') : undefined) }, trigger: 'change' }],
  'policy.captureRules.maximumLocationAccuracyMeters': [numberRule(1, 1000, false, false)],
  'policy.minimumDwellMinutes': [numberRule(0, 480)],
  'policy.requiredPhotoCount': [numberRule(1, 10)],
  'policy.minimumRecordingSeconds': [{ ...numberRule(0, 28800), message: '请填写 0–480 分钟的录音时长' }],
  'policy.maximumClipGapSeconds': [numberRule(0, 3600)],
}
function formatTime(value?: string) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—' }
function actorName(id: string) { return id === auth.user?.id ? auth.user.displayName || auth.user.username : `用户 ${id.slice(0, 8)}` }
function showDetail(id: string) { detail.value = selectedHistory.value.find(row => row.id === id) ?? null }
function openRename() { nameDraft.value = model.name; nameError.value = ''; renameOpen.value = true }
function applyRename() {
  if (!canPublish.value || saving.value || loading.value) return
  if (!nameDraft.value.trim()) { nameError.value = '请填写规则名称'; return }
  model.name = nameDraft.value.trim(); renameOpen.value = false
}
function recordingChanged() { if (!form.recordingEnabled) { form.captureRules.automaticRecording = false; form.aiAsrEnabled = false; form.aiRelevanceEnabled = false; form.aiDuplicateEnabled = false } }
function selectPolicy(row: VisitPolicyVersion, preserveInput = false) {
  baseline.value = { ...row, policy: copyVisitPolicy(row.policy) }
  version.value = row.versionNo; policyCode.value = row.policyCode; scopeType.value = row.scopeType ?? 'ALL'; scopeId.value = row.scopeId
  if (!preserveInput) { model.name = row.name; Object.assign(form, copyVisitPolicy(row.policy)) }
  loaded.value = true; error.value = ''; needsRecheck.value = false; reviewOpen.value = false
  formRef.value?.clearValidate()
}
async function load(preserveInput = false) {
  if (loading.value) return
  loading.value = true; loadError.value = ''
  try {
    history.value = await salesVisitPolicyApi.list()
    const selected = policyChoices.value.find(row => row.policyCode === policyCode.value) ?? (!loaded.value ? policyChoices.value[0] : undefined)
    if (selected) { selectPolicy(selected, preserveInput); if (preserveInput) notice.value = `已取得最新版本 v${selected.versionNo}，你的输入已保留，请逐项核对后再发布。` }
    else { loadError.value = '未找到所选规则，当前输入已保留，请联系管理员核对。'; needsRecheck.value = loaded.value }
  } catch (e) { loadError.value = e instanceof Error ? e.message : '读取拜访规则失败，请重新加载。' }
  finally { loading.value = false }
}
async function allowDiscard(action: string) {
  if (saving.value || loading.value) return false
  if (!dirty.value) return true
  try { await ElMessageBox.confirm(`有 ${changes.value.length} 项修改尚未发布，${action}将放弃这些修改。`, '保留未发布的修改？', { confirmButtonText: `放弃修改并${action}`, cancelButtonText: '继续编辑', type: 'warning' }); return true }
  catch { return false }
}
async function reload() { if (await allowDiscard('重新加载')) { notice.value = ''; await load() } }
async function recheck() { notice.value = ''; await load(true) }
async function changePolicy(code: string) { if (code !== policyCode.value && await allowDiscard('切换规则')) { const row = policyChoices.value.find(item => item.policyCode === code); if (row) { selectPolicy(row); notice.value = '' } } }
async function reset() { if (await allowDiscard('还原') && baseline.value) { selectPolicy(baseline.value); notice.value = '' } }
async function review() {
  if (!loaded.value || !dirty.value || !canPublish.value || saving.value || loading.value || needsRecheck.value) return
  if (!model.name.trim()) { openRename(); nameError.value = '请填写规则名称'; return }
  activeTab.value = 'settings'; await nextTick()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) { error.value = '请先修正标出的字段，当前输入已保留。'; return }
  error.value = ''; reviewOpen.value = true
}
async function publish() {
  if (!reviewOpen.value || saving.value || loading.value || !canPublish.value || !dirty.value || needsRecheck.value) return
  saving.value = true; error.value = ''; notice.value = ''
  const submitted = copyVisitPolicy(form), submittedName = model.name.trim()
  try {
    const receipt = await salesVisitPolicyApi.publish(version.value, policyCode.value, submittedName, submitted, scopeType.value, scopeId.value)
    if (!receipt?.policyVersionId || receipt.policyCode !== policyCode.value || receipt.versionNo !== version.value + 1 || receipt.publishStatus !== 'PUBLISHED') throw new Error('发布回执不完整，暂时无法确认保存结果')
    const row: VisitPolicyVersion = { id: receipt.policyVersionId, policyCode: receipt.policyCode, versionNo: receipt.versionNo, publishStatus: receipt.publishStatus, name: submittedName, policy: { ...submitted, id: receipt.policyVersionId }, scopeType: scopeType.value, scopeId: scopeId.value, createdAt: receipt.effectiveFrom ?? new Date().toISOString(), createdBy: auth.user?.id ?? '' }
    history.value = [row, ...history.value]; selectPolicy(row)
    ElMessage.success(`版本 v${receipt.versionNo} 已发布，仅对新拜访生效`)
    // The write receipt is authoritative. A failed history refresh must not invite a duplicate publish.
    try { history.value = await salesVisitPolicyApi.list() }
    catch { notice.value = `版本 v${receipt.versionNo} 已发布，历史列表暂未刷新，可稍后重新加载。` }
  } catch (e) {
    reviewOpen.value = false; needsRecheck.value = true
    error.value = `${e instanceof Error ? e.message : '发布结果尚未确认'}。当前输入已保留，请核对最新版本后重试。`
  } finally { saving.value = false }
}
async function leave() {
  if (!await allowDiscard('离开')) return false
  if (baseline.value && dirty.value) selectPolicy(baseline.value)
  return true
}
onBeforeRouteLeave(leave)
onBeforeRouteUpdate(leave)
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || saving.value) { event.preventDefault(); event.returnValue = '' } }
watch(activeTab, () => { if (scrollArea.value) scrollArea.value.scrollTop = 0 })
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); void load() })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped lang="scss">
.visit-policy { display: flex; flex: 1; min-height: 0; min-width: 0; flex-direction: column; background: var(--el-fill-color-light); color: var(--el-text-color-primary); container-type: inline-size; }
.policy-heading { flex: none; background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-light); padding: 18px 28px 13px; }
.heading-line, .title-group, .heading-actions { display: flex; align-items: center; gap: 16px; }
.heading-line { justify-content: space-between; }
.rule-area-tabs { padding: 3px; background: var(--el-fill-color-light); border-radius: 7px; }
.rule-area-tabs :deep(.el-radio-button__inner) { border: 0; background: transparent; box-shadow: none; padding: 8px 14px; border-radius: 5px; color: var(--el-text-color-secondary); }
.rule-area-tabs :deep(.el-radio-button.is-active .el-radio-button__inner) { background: var(--el-bg-color); color: var(--el-color-primary); box-shadow: 0 1px 3px #182b4a12; font-weight: 600; }
h1 { margin: 0; font-size: 23px; line-height: 1.4; font-weight: 650; letter-spacing: -.3px; }
h2 { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.5; }
.heading-actions { gap: 10px; }
.heading-actions .el-button + .el-button, .rule-choice .el-button { margin-left: 0; }
.published { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 5px; font-size: 12px; color: var(--el-color-success-dark-2); background: var(--el-color-success-light-9); white-space: nowrap; }
.published::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.policy-identity { display: flex; align-items: center; gap: 18px; margin-top: 12px; color: var(--el-text-color-secondary); font-size: 12px; }
.rule-choice { display: flex; align-items: center; gap: 10px; min-width: 0; }
.rule-choice label { white-space: nowrap; }
.rule-choice .el-select { width: 210px; }
.rule-choice :deep(.el-select__wrapper) { background: var(--el-fill-color-light); box-shadow: none; border-radius: 5px; }
.rule-choice :deep(.el-select__selected-item) { color: var(--el-text-color-primary); font-size: 13px; font-weight: 500; }
.rule-choice .el-button { width: 28px; padding: 4px; color: var(--el-text-color-secondary); }
.policy-scope { display: flex; align-items: center; gap: 6px; border-left: 1px solid var(--el-border-color-light); padding-left: 18px; overflow-wrap: anywhere; }
.policy-scope .el-icon { font-size: 15px; }
.policy-updated { margin-left: auto; font-size: 11px; white-space: nowrap; }
.policy-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 16px 28px 6px; }
.policy-scroll > .el-alert { margin-bottom: 16px; }
.policy-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.rule-stack { display: grid; gap: 16px; min-width: 0; }
.rule-section { min-width: 0; padding: 15px 22px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); }
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.section-icon { display: grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 8px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.section-icon .el-icon { font-size: 18px; }
.section-caption { margin-left: auto; color: var(--el-text-color-secondary); font-size: 11px; }
.number-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.policy-editor :deep(.el-form-item) { min-width: 0; margin-bottom: 0; }
.policy-editor :deep(.el-form-item__label) { font-size: 12px; font-weight: 500; color: var(--el-text-color-regular); line-height: 1.5; margin-bottom: 8px; padding: 0; }
.policy-editor :deep(.el-form-item__content) { min-width: 0; display: block; line-height: 1.5; }
.policy-editor :deep(.el-form-item__error) { position: static; padding-top: 5px; line-height: 1.5; }
.number-field { position: relative; width: 100%; }
.number-field > span { position: absolute; top: 0; right: 12px; height: 44px; display: flex; align-items: center; color: var(--el-text-color-secondary); font-size: 12px; pointer-events: none; }
.number-field :deep(.el-input-number) { width: 100%; }
.number-field :deep(.el-input__wrapper) { height: 44px; padding: 0 42px 0 12px; border-radius: 7px; }
.number-field :deep(.el-input__inner) { text-align: left; font-size: 18px; font-weight: 550; font-variant-numeric: tabular-nums; }
.field-note { margin: 7px 0 0; font-size: 11px; color: var(--el-text-color-secondary); }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 11px 13px; background: var(--el-fill-color-light); border-radius: 8px; }
.toggle-row label, .inline-field label { font-size: 13px; font-weight: 500; }
.toggle-row p, .inline-field p { font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); margin: 4px 0 0; }
.toggle-row .el-switch { flex: none; }
.location-section .toggle-row { margin-top: 16px; }
.section-note { display: flex; align-items: flex-start; gap: 6px; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.7; margin: 11px 0 0; }
.section-note .el-icon { flex: none; margin-top: 3px; color: var(--el-text-color-placeholder); font-size: 13px; }
.photo-sources { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.photo-sources :deep(.el-radio.is-bordered) { position: relative; min-width: 0; width: 100%; height: auto; margin: 0; padding: 14px 15px; border-radius: 8px; }
.photo-sources :deep(.el-radio__input) { position: absolute; right: 12px; top: 16px; }
.photo-sources :deep(.el-radio__label) { min-width: 0; padding: 0; white-space: normal; line-height: 1.6; }
.photo-sources :deep(.el-radio.is-checked) { background: var(--el-color-primary-light-9); }
.source-label { display: flex; align-items: center; gap: 8px; padding-right: 16px; font-size: 13px; }
.source-label strong { font-weight: 550; }
.source-label .el-icon { font-size: 18px; }
.source-description { display: block; margin: 4px 0 0 26px; color: var(--el-text-color-secondary); font-size: 11px; }
.inline-field { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.inline-field .el-form-item { width: 115px; flex: none; }
.inline-field p { font-size: 11px; }
.photo-count { margin-top: 19px; padding-top: 17px; border-top: 1px solid var(--el-border-color-lighter); }
.compact-number :deep(.el-input__wrapper), .compact-number > span { height: 36px; }
.compact-number :deep(.el-input__inner) { font-size: 15px; }
.recording-master { display: flex; align-items: center; gap: 10px; margin-left: auto; font-size: 11px; color: var(--el-text-color-secondary); }
.audio-section .toggle-row { margin-bottom: 13px; }
.policy-editor :deep(.audio-source) { margin-bottom: 13px; }
.audio-sources { display: flex; width: 100%; padding: 3px; border: 1px solid var(--el-border-color); border-radius: 7px; background: var(--el-fill-color-light); gap: 4px; }
.audio-sources :deep(.el-radio-button) { flex: 1; min-width: 0; }
.audio-sources :deep(.el-radio-button__inner) { width: 100%; border: 0; background: transparent; color: var(--el-text-color-secondary); border-radius: 4px !important; padding: 7px 8px; font-size: 12px; white-space: normal; line-height: 1.4; box-shadow: none; }
.audio-sources :deep(.el-radio-button.is-active .el-radio-button__inner) { background: var(--el-bg-color); color: var(--el-color-primary); font-weight: 550; box-shadow: 0 1px 3px #21385812; }
.clip-note { display: flex; align-items: flex-start; gap: 9px; border-top: 1px solid var(--el-border-color-light); padding-top: 13px; margin: 15px 0 0; font-size: 12px; line-height: 1.7; color: var(--el-text-color-secondary); }
.clip-note .el-icon { flex: none; margin-top: 3px; font-size: 16px; }
.clip-note strong { color: var(--el-text-color-regular); font-weight: 550; }
.validation-section .section-heading { margin-bottom: 13px; }
.checks { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 13px; }
.checks :deep(.el-checkbox.is-bordered) { margin: 0; padding: 8px 10px; height: 35px; border-radius: 6px; }
.checks :deep(.el-checkbox__label) { padding-left: 8px; font-size: 12px; }
.checks :deep(.el-checkbox.is-checked) { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary-light-7); }
.confidence-field { border-top: 1px solid var(--el-border-color-lighter); padding-top: 13px; }
.effect-note { display: flex; align-items: flex-start; gap: 9px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; margin: 10px 2px 0; }
.effect-note .el-icon { flex: none; font-size: 15px; margin-top: 2px; }
.effect-note strong { color: var(--el-text-color-regular); font-weight: 500; }
.policy-footer { flex: none; border-top: 1px solid var(--el-border-color-light); background: var(--el-bg-color); padding: 15px 28px; }
.footer-line { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.footer-status { display: flex; align-items: center; gap: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.footer-status .el-icon { font-size: 16px; color: var(--el-color-success); }
.footer-status.is-dirty .el-icon { color: var(--el-color-primary); }
.footer-status small { margin-left: 8px; font-size: 11px; color: var(--el-text-color-placeholder); }
.footer-actions { display: flex; flex: none; gap: 10px; }
.footer-actions .el-button + .el-button { margin-left: 0; }
.footer-actions .el-button { height: 36px; border-radius: 7px; }
.footer-actions .el-button--primary.is-disabled { color: var(--el-text-color-placeholder); background: var(--el-fill-color-light); border-color: var(--el-border-color-light); }
.publish-error { font-size: 13px; color: var(--el-color-danger); margin-bottom: 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.policy-history { padding: 22px 24px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 12px; }
.muted { margin: 5px 0 16px; font-size: 12px; line-height: 1.7; color: var(--el-text-color-secondary); }
.policy-history .el-tag { margin-left: 8px; }
.review-heading h2 { font-size: 20px; color: var(--el-text-color-primary); }
.review-heading p { margin: 7px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.review-context { display: flex; flex-direction: column; gap: 5px; padding: 15px 16px; border-radius: 8px; background: var(--el-fill-color-light); margin-bottom: 24px; }
.review-context strong { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.review-context span { font-size: 12px; color: var(--el-text-color-secondary); }
.diff-heading { display: flex; justify-content: space-between; font-size: 13px; }
.diff-heading > span { font-size: 12px; color: var(--el-text-color-secondary); }
.change-list { list-style: none; padding: 0; margin: 12px 0 24px; }
.change-list li { border-top: 1px solid var(--el-border-color-light); padding: 16px 0; font-size: 13px; overflow-wrap: anywhere; }
.change-list li > span { display: block; color: var(--el-text-color-regular); margin-bottom: 9px; }
.change-list li > div { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.change-list .previous-value { min-width: 80px; color: var(--el-text-color-secondary); }
.change-list .el-icon { flex: none; color: var(--el-text-color-placeholder); }
.change-list strong { color: var(--el-color-primary); font-weight: 600; }
.review-notice { padding: 13px 15px; border-radius: 7px; background: var(--el-color-primary-light-9); font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.8; }
.policy-details { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px 16px; font-size: 13px; margin: 0 0 20px; }
dt { color: var(--el-text-color-secondary); }
dd { margin: 0; overflow-wrap: anywhere; }
@container (min-width: 1700px) {
  .policy-editor { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 20px; }
  .rule-stack { display: contents; }
  .rule-section { padding: 23px 24px; }
  .location-section { grid-column: 1; grid-row: 1; }
  .photo-section { grid-column: 2; grid-row: 1; }
  .audio-section { grid-column: 3; grid-row: 1 / span 2; display: flex; flex-direction: column; }
  .validation-section { grid-column: 1 / span 2; grid-row: 2; display: grid; grid-template-columns: 1fr 1fr; column-gap: 32px; align-items: center; }
  .validation-section .section-heading, .validation-section .section-note { grid-column: 1 / span 2; }
  .validation-section .checks { margin: 0; }
  .validation-section .confidence-field { padding: 0 0 0 28px; border-top: 0; border-left: 1px solid var(--el-border-color-light); }
  .audio-section .toggle-row { margin-bottom: 24px; }
  .audio-section .audio-source { margin-bottom: 24px; }
  .audio-section .clip-note { margin-top: auto; }
  .audio-section .number-grid { margin-bottom: 24px; }
  .photo-sources :deep(.el-radio.is-bordered) { padding: 19px 17px; }
  .photo-count { margin-top: 25px; padding-top: 22px; }
}
@container (max-width: 1050px) {
  .rule-section { padding: 18px; }
  .policy-updated { display: none; }
  .photo-sources { gap: 8px; }
  .photo-sources :deep(.el-radio.is-bordered) { padding: 12px 10px; }
  .source-label { font-size: 12px; gap: 6px; }
  .source-description { margin-left: 0; }
  .checks { gap: 6px; }
  .checks :deep(.el-checkbox.is-bordered) { padding: 7px; }
  .number-grid { gap: 10px; }
}
@container (max-width: 720px) {
  .policy-editor { grid-template-columns: 1fr; }
  .policy-heading { padding: 16px 18px 13px; }
  .policy-scroll { padding: 18px; }
  .policy-identity { flex-wrap: wrap; gap: 10px; }
  .policy-scope { border-left: 0; padding-left: 0; }
  .policy-footer { padding: 13px 18px; }
  .title-group { gap: 10px; }
  h1 { font-size: 21px; }
  .footer-status small { display: none; }
}
@container (max-width: 480px) {
  h1 { font-size: 20px; }
  .heading-line { align-items: flex-start; gap: 10px; }
  .title-group { gap: 8px; flex-wrap: wrap; }
  .heading-actions { gap: 6px; }
  .heading-actions .el-button { padding: 8px; }
  .heading-actions :deep(.el-button span) { margin-left: 4px; font-size: 12px; }
  .published { font-size: 10px; padding: 3px 5px; }
  .rule-choice { width: 100%; }
  .rule-choice > label { display: none; }
  .rule-choice .el-select { width: min(240px, calc(100% - 40px)); }
  .policy-scope { font-size: 11px; }
  .policy-scroll { padding: 16px; }
  .policy-editor, .rule-stack { gap: 14px; }
  .rule-section { padding: 19px 17px; }
  .section-heading h2 { font-size: 15px; }
  .section-caption { font-size: 10px; }
  .number-field :deep(.el-input__wrapper) { padding: 0 32px 0 9px; height: 40px; }
  .number-field :deep(.el-input__inner) { font-size: 17px; }
  .number-field > span { right: 8px; font-size: 11px; height: 40px; }
  .compact-number :deep(.el-input__wrapper), .compact-number > span { height: 36px; }
  .compact-number :deep(.el-input__inner) { font-size: 15px; }
  .field-note { font-size: 10px; }
  .toggle-row { padding: 12px; }
  .toggle-row p { font-size: 11px; }
  .photo-sources :deep(.el-radio__input) { right: 8px; top: 15px; }
  .source-label .el-icon { font-size: 15px; }
  .source-description { font-size: 10px; }
  .checks :deep(.el-checkbox__label) { font-size: 11px; }
  .confidence-field .el-form-item { width: 100px; }
  .effect-note { font-size: 11px; }
  .policy-footer { padding: 10px 16px 13px; }
  .footer-line { display: block; }
  .footer-status { margin-bottom: 10px; font-size: 11px; }
  .footer-actions .el-button { flex: 1; }
  .policy-history { padding: 18px; }
}
@container (max-width: 340px) {
  .photo-sources { grid-template-columns: 1fr; }
  .source-description { margin-left: 21px; }
}
</style>
<style lang="scss">
.visit-policy-dialog.el-dialog { max-width: calc(100vw - 32px); }
.visit-policy-dialog .el-dialog__body { max-height: 60vh; overflow-y: auto; }
.visit-policy-review.el-drawer { max-width: 100vw; }
.visit-policy-review .el-drawer__header { padding: 25px 26px 22px; margin: 0; border-bottom: 1px solid var(--el-border-color-light); align-items: flex-start; }
.visit-policy-review .el-drawer__body { padding: 24px 26px; min-height: 0; overflow-y: auto; }
.visit-policy-review .el-drawer__footer { padding: 18px 26px; border-top: 1px solid var(--el-border-color-light); }
</style>
