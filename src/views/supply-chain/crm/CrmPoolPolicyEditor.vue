<template>
  <section class="pool-policy" aria-label="客户保护与回收" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="pool-error" />
    <el-form ref="formRef" class="pool-layout" :model="form" :rules="rules" label-position="top" :disabled="saving || loading || !canManage" @submit.prevent="review">
      <div class="rule-column">
        <section class="protection-sheet" aria-labelledby="protection-heading">
          <header class="sheet-heading"><div><h2 id="protection-heading">客户保护周期</h2><p>从认领到合作，按有效拜访和成交延续保护。</p></div><span class="effect-label">新认领生效</span></header>
          <div class="protection-journey">
            <div v-for="(field, index) in fields" :key="field.key" class="rule-row" :class="{ 'cooldown-row': index === 3 }">
              <div class="stage-mark" aria-hidden="true"><el-icon><component :is="stageIcons[index]" /></el-icon></div>
              <div class="rule-copy"><label :for="`pool-${field.key}`">{{ field.label }}<span class="required-star" aria-hidden="true">*</span></label><p>{{ field.note }}</p></div>
              <el-form-item :prop="field.key" class="duration-item"><div class="duration-control"><el-input-number :id="`pool-${field.key}`" v-model="form[field.key]" :min="1" :max="65535" :precision="0" :controls="false" :aria-label="field.label" /><span>{{ field.unit }}</span></div></el-form-item>
            </div>
          </div>
          <div class="sheet-footnote"><el-icon><Clock /></el-icon><span>已有私海保留原规则与期限，届满回公海。</span></div>
        </section>
        <section class="reminder-sheet" aria-labelledby="reminder-heading">
          <header class="sheet-heading"><div><h2 id="reminder-heading">提醒与客户活跃</h2><p>用于客户列表筛选，不改变保护期限。</p></div><span class="effect-label neutral">发布后生效</span></header>
          <div class="rule-row utility-row">
            <div class="utility-icon" aria-hidden="true"><el-icon><Bell /></el-icon></div>
            <div class="rule-copy"><label for="pool-dueSoonHours">到期提前提醒<span class="required-star" aria-hidden="true">*</span></label><p>在期限到达前进入“即将掉落”列表</p></div>
            <el-form-item prop="dueSoonHours" class="duration-item"><div class="duration-control"><el-input-number id="pool-dueSoonHours" v-model="form.dueSoonHours" :min="1" :max="65535" :precision="0" :controls="false" aria-label="到期提前提醒" /><span>小时</span></div></el-form-item>
          </div>
          <div class="rule-row utility-row">
            <div class="utility-icon" aria-hidden="true"><el-icon><ShoppingBag /></el-icon></div>
            <div class="rule-copy"><label for="pool-activityDays">长期未购判定<span class="required-star" aria-hidden="true">*</span></label><p>按最近有效公司订单判断，历史不完整时保持待核实</p></div>
            <el-form-item prop="activityDays" class="duration-item"><div class="duration-control"><el-input-number id="pool-activityDays" v-model="form.activityDays" :min="1" :max="65535" :precision="0" :controls="false" aria-label="长期未购判定" /><span>天</span></div></el-form-item>
          </div>
        </section>
      </div>
      <aside class="publication-panel" aria-label="规则发布">
        <header class="publication-heading"><h2>发布设置</h2><el-button :icon="Refresh" text circle :disabled="saving || loading" aria-label="重新加载" title="重新加载" @click="reload" /></header>
        <div class="version-line"><span class="live-dot"></span><strong>{{ current ? `生效中 v${current.version}` : '尚未配置' }}</strong><span>公司统一规则</span></div>
        <p v-if="current" class="published-time">{{ time(current.publishedAt) }} 发布</p>
        <div class="publication-boundary"><el-icon><Check /></el-icon><span>已有客户的保护期限保持不变</span></div>
        <el-form-item label="修改说明" prop="description" class="reason-item"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="记录本次调整的原因" aria-label="客户规则修改说明" /></el-form-item>
        <div class="pool-actions"><span class="draft-status" :class="{ changed: dirty }">{{ dirty ? `${changes.length} 项待发布修改` : '与已发布规则一致' }}</span><el-button type="primary" :disabled="!dirty || blocked || !canManage" :loading="saving" @click="review">查看变更并发布</el-button></div>
        <el-button class="history-entry" text :icon="Clock" @click="historyOpen = true">发布记录<span class="history-count">{{ history.length }}</span></el-button>
      </aside>
    </el-form>
    <el-drawer v-model="historyOpen" title="客户保护规则发布记录" size="min(540px, 100vw)" append-to-body>
      <div v-for="item in history" :key="item.id" class="history-row"><header><strong>v{{ item.version }}</strong><el-tag v-if="item.id === current?.id" size="small" type="success">当前生效</el-tag><time>{{ time(item.publishedAt) }}</time></header><p>{{ item.description }}</p><dl class="history-values"><template v-for="field in allFields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ item[field.key] }} {{ field.unit }}</dd></template></dl></div>
    </el-drawer>
    <el-dialog v-model="reviewOpen" title="确认发布客户保护规则" width="min(560px, calc(100vw - 32px))" append-to-body :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <p>已有私海继续沿用原规则；新认领使用新版本。</p>
      <dl class="pool-changes"><template v-for="change in changes" :key="change.key"><dt>{{ change.label }}</dt><dd>{{ change.before }} → {{ change.after }} {{ change.unit }}</dd></template></dl>
      <p>{{ form.description }}</p><el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template #footer><el-button :disabled="saving" @click="reviewOpen = false">返回编辑</el-button><el-button type="primary" :loading="saving" :disabled="blocked" @click="publish">发布新版本</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Bell, Check, Clock, Connection, Refresh, RefreshLeft, ShoppingBag, UserFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { crmPoolPolicyApi, type PoolPolicy, type PoolPolicyValues } from '@/api/core/crm-pool-policy'
const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('crm:store:manage'))
const current = ref<PoolPolicy | null>(null), history = ref<PoolPolicy[]>([])
const loading = ref(false), saving = ref(false), blocked = ref(false), reviewOpen = ref(false), error = ref('')
const formRef = ref<FormInstance>(), requestId = ref(''), historyOpen = ref(false)
const stageIcons = [UserFilled, Connection, Check, RefreshLeft]
const form = reactive<{ [K in keyof PoolPolicyValues]: number | null } & { description: string }>({ firstVisitHours: null, followupDays: null, cooperatingDays: null, returnCooldownHours: null, activityDays: null, dueSoonHours: null, description: '' })
const fields: { key: keyof PoolPolicyValues; label: string; unit: string; note: string }[] = [
  { key: 'firstVisitHours', label: '认领后首访期限', unit: '小时', note: '认领后需完成有效首访或有效成交' },
  { key: 'followupDays', label: '未合作客户跟进保护', unit: '天', note: '从最近一次有效拜访起算' },
  { key: 'cooperatingDays', label: '合作客户保护', unit: '天', note: '本轮归属成交后，从最近有效拜访或订单起算' },
  { key: 'returnCooldownHours', label: '回公海后认领冷却', unit: '小时', note: '仅限制原归属人再次认领' },
]
const allFields = [...fields, { key: 'dueSoonHours' as const, label: '到期提前提醒', unit: '小时' }, { key: 'activityDays' as const, label: '长期未购判定', unit: '天' }]
const rules: FormRules = Object.fromEntries(allFields.map(f => [f.key, [{ required: true, type: 'integer', min: 1, max: 65535, message: `${f.label}须为 1–65535 的整数`, trigger: ['blur', 'change'] }]]))
rules.description = [{ required: true, whitespace: true, message: '请填写修改说明', trigger: 'blur' }]
const changes = computed(() => allFields.filter(f => form[f.key] !== current.value?.[f.key]).map(f => ({ ...f, before: current.value?.[f.key] ?? '未设置', after: form[f.key] ?? '未填写' })))
const dirty = computed(() => changes.value.length > 0)
const time = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false })
const message = (e: unknown) => e instanceof Error ? e.message : '规则操作失败，请重试'
async function reload() {
  if (loading.value || saving.value) return
  if (dirty.value && current.value) { try { await ElMessageBox.confirm('重新加载会放弃未发布修改。', '重新加载规则') } catch { return } }
  loading.value = true; error.value = ''
  try {
    const [value, records] = await Promise.all([crmPoolPolicyApi.current(), crmPoolPolicyApi.history()])
    current.value = value; history.value = records
    for (const f of allFields) form[f.key] = value?.[f.key] ?? null
    form.description = ''; blocked.value = false; requestId.value = ''; reviewOpen.value = false
    await nextTick(); formRef.value?.clearValidate()
  } catch (e) { error.value = message(e); blocked.value = true }
  finally { loading.value = false }
}
async function review() {
  if (!canManage.value || !dirty.value || blocked.value || saving.value) return
  if (!await formRef.value?.validate().catch(() => false)) return
  requestId.value = crypto.randomUUID(); error.value = ''; reviewOpen.value = true
}
async function publish() {
  if (!reviewOpen.value || saving.value || blocked.value || !canManage.value) return
  saving.value = true; error.value = ''
  try {
    const value = await crmPoolPolicyApi.publish({ ...form as PoolPolicyValues, description: form.description.trim(), expectedVersion: current.value?.version ?? 0, requestId: requestId.value })
    current.value = value; history.value = [value, ...history.value]; form.description = ''; reviewOpen.value = false
    ElMessage.success('客户保护规则已发布，新认领使用新版本')
  } catch (e) { error.value = message(e); if (/其他管理员|重新加载|409/.test(error.value)) blocked.value = true }
  finally { saving.value = false }
}
onMounted(reload)
</script>
<style scoped>
.pool-policy { width: 100%; max-width: 1480px; margin: 8px auto 24px; color: var(--el-text-color-primary); container-type: inline-size; }
.pool-error { margin-bottom: 16px; }
.pool-layout { display: grid; grid-template-columns: minmax(0, 1fr) 312px; gap: 24px; align-items: start; }
.rule-column { display: grid; gap: 20px; min-width: 0; }
.protection-sheet, .reminder-sheet { background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 10px; overflow: hidden; }
.sheet-heading { padding: 16px 26px 14px; display: flex; align-items: start; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--el-border-color-lighter); }
.sheet-heading h2, .publication-heading h2 { margin: 0; font-size: 17px; line-height: 1.5; font-weight: 650; letter-spacing: .1px; }
.sheet-heading p { margin: 5px 0 0; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; }
.effect-label { flex-shrink: 0; padding: 4px 9px; margin-top: 2px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); border-radius: 4px; font-size: 12px; line-height: 1.5; }
.effect-label.neutral { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.rule-row { position: relative; display: grid; grid-template-columns: 34px minmax(0, 1fr) 146px; align-items: center; column-gap: 16px; min-height: 76px; padding: 10px 26px; box-sizing: border-box; }
.rule-row + .rule-row { border-top: 1px solid var(--el-border-color-lighter); }
.stage-mark { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--el-color-primary-light-7); background: var(--el-bg-color); border-radius: 50%; color: var(--el-color-primary); font-size: 16px; z-index: 1; }
.protection-journey .rule-row:not(:nth-child(3)):not(.cooldown-row) .stage-mark::after { content: ''; position: absolute; left: 42px; top: calc(50% + 17px); bottom: -21px; width: 1px; background: var(--el-color-primary-light-7); }
.cooldown-row { background: var(--el-fill-color-lighter); }.cooldown-row .stage-mark { color: var(--el-text-color-secondary); border-color: var(--el-border-color); border-radius: 7px; }
.rule-copy label { font-size: 14px; font-weight: 600; line-height: 1.6; color: var(--el-text-color-primary); }.required-star { color: var(--el-color-danger); margin-left: 5px; font-weight: 400; }
.rule-copy p { margin: 4px 0 0; font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); }
.duration-item { margin: 0; align-self: center; }.duration-item :deep(.el-form-item__content) { line-height: normal; }.duration-item :deep(.el-form-item__error) { position: static; font-size: 12px; line-height: 1.4; padding-top: 5px; }
.duration-control { display: flex; align-items: center; width: 146px; height: 42px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-bg-color); overflow: hidden; transition: border-color .15s; }
.duration-control:focus-within { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-9); }
.duration-control :deep(.el-input-number) { width: 100px; min-width: 0; }.duration-control :deep(.el-input__wrapper) { box-shadow: none !important; padding: 0 10px; background: transparent; }.duration-control :deep(.el-input__inner) { height: 40px; font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; color: var(--el-text-color-primary); }
.duration-control > span { padding: 0 12px 0 4px; color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; }
.sheet-footnote { display: flex; align-items: center; gap: 7px; padding: 10px 26px; color: var(--el-text-color-secondary); font-size: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.utility-icon { display: grid; place-items: center; width: 32px; color: var(--el-text-color-secondary); font-size: 18px; }
.publication-panel { position: sticky; top: 8px; padding: 20px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 10px; }
.publication-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 17px; }.publication-heading :deep(.el-button) { margin-right: -6px; }
.version-line { display: flex; align-items: center; gap: 7px; font-size: 13px; }.version-line > span:last-child { margin-left: auto; color: var(--el-text-color-secondary); font-size: 12px; }.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-color-success); }
.published-time { font-size: 12px; color: var(--el-text-color-secondary); margin: 8px 0 20px; }.publication-boundary { display: flex; align-items: center; gap: 7px; padding: 12px 0; margin-bottom: 18px; border-top: 1px solid var(--el-border-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); font-size: 12px; color: var(--el-text-color-regular); }.publication-boundary .el-icon { color: var(--el-color-success); }
.reason-item :deep(.el-form-item__label) { font-weight: 600; }.reason-item :deep(.el-textarea__inner) { font-size: 13px; line-height: 1.7; padding: 10px 12px 23px; resize: vertical; }.reason-item { margin-bottom: 16px; }
.pool-actions { display: grid; gap: 10px; }.draft-status { font-size: 12px; color: var(--el-text-color-secondary); }.draft-status.changed { color: var(--el-color-primary); }.pool-actions :deep(.el-button) { width: 100%; height: 40px; font-weight: 600; }
.history-entry { width: 100%; margin: 16px 0 0; border-top: 1px solid var(--el-border-color-lighter); border-radius: 0; padding: 20px 0 2px; height: auto; color: var(--el-text-color-regular); }.history-count { padding: 1px 6px; margin-left: 8px; background: var(--el-fill-color); border-radius: 4px; font-size: 12px; }
.history-row { padding: 20px 0; border-bottom: 1px solid var(--el-border-color-light); }.history-row:first-child { padding-top: 0; }.history-row header { display: flex; align-items: center; gap: 10px; }.history-row time { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }.history-row p { line-height: 1.7; font-size: 13px; }.history-values, .pool-changes { display: grid; grid-template-columns: 1fr auto; gap: 10px 20px; font-size: 13px; }.history-values { background: var(--el-fill-color-light); padding: 14px; }.history-values dt { color: var(--el-text-color-secondary); }.history-values dd, .pool-changes dd { margin: 0; font-variant-numeric: tabular-nums; }
@container (max-width: 900px) { .pool-layout { grid-template-columns: minmax(0, 1fr) 276px; gap: 16px; }.sheet-heading, .rule-row { padding-left: 18px; padding-right: 18px; }.rule-row { grid-template-columns: 28px minmax(0, 1fr) 120px; column-gap: 10px; }.duration-control { width: 120px; }.duration-control :deep(.el-input-number) { width: 78px; }.protection-journey .rule-row:not(:nth-child(3)):not(.cooldown-row) .stage-mark::after { left: 34px; }.effect-label { display: none; } }
@container (max-width: 720px) { .pool-layout { grid-template-columns: minmax(0, 1fr); }.publication-panel { position: static; }.rule-copy p { font-size: 12px; }.rule-row { min-height: 88px; }.sheet-heading h2 { font-size: 16px; } }
@container (max-width: 400px) { .rule-row { grid-template-columns: 26px minmax(0, 1fr); }.duration-item { grid-column: 2; justify-self: start; margin-top: 10px; }.stage-mark { width: 26px; height: 26px; }.protection-journey .stage-mark::after { display: none; }.rule-row { padding: 16px; align-items: start; }.sheet-heading { padding: 18px 16px; } }
@media (prefers-reduced-motion: reduce) { .duration-control { transition: none; } }
</style>
