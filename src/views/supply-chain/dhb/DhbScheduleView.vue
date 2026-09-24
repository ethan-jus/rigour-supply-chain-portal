<template>
  <div class="sync-schedules supply-page">
    <header class="page-heading">
      <div>
        <h1>同步定时任务</h1>
        <p>按业务顺序依次同步订货宝相关数据，完成后按设定间隔自动执行下一轮。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" :disabled="savingDhb || savingBi" @click="load"
        >刷新状态</el-button
      >
    </header>
    <div v-if="connectors.length > 1" class="connector-picker">
      <label for="sync-connector">订货宝连接器</label>
      <el-select
        id="sync-connector"
        v-model="connector"
        :disabled="savingDhb || loadingDhb || loading"
        @change="loadDhb"
        ><el-option v-for="id in connectors" :key="id" :label="id" :value="id"
      /></el-select>
    </div>
    <section class="business-plan" aria-labelledby="business-title">
      <div class="flow-area">
        <h2 id="business-title">订货宝业务同步流程</h2>
        <p>按固定顺序依次执行，三个步骤共用同一个定时计划。</p>
        <ol class="flow" aria-label="业务同步顺序">
          <li v-for="(step, i) in steps" :key="step.title">
            <span class="flow-icon"
              ><el-icon><component :is="step.icon" /></el-icon
            ></span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
            <el-icon v-if="i < steps.length - 1" class="flow-arrow"><Right /></el-icon>
          </li>
        </ol>
        <div class="dependency-note">
          <el-icon><InfoFilled /></el-icon>关联风险仅暂缓相关订单，修复后自动重试；前置同步失败时暂停后续步骤
        </div>
      </div>
      <div v-loading="loadingDhb" class="settings-area">
        <h2>业务同步计划</h2>
        <el-alert v-if="dhbError" :title="dhbError" type="error" :closable="false" show-icon />
        <template v-if="dhb">
          <SyncScheduleForm :plan="dhb" :editable="canDhb" :saving="savingDhb" @save="saveDhb" />
          <p v-if="!dhb.managed" class="service-note">
            尚无已保存计划；首次启用从已有同步进度继续。
          </p>
        </template>
        <el-empty
          v-else-if="!loadingDhb && !dhbError"
          description="未配置订货宝同步来源"
          :image-size="60"
        />
      </div>
    </section>
    <section v-loading="loadingBi" class="bi-plan" aria-labelledby="bi-title">
      <div class="bi-intro">
        <h2 id="bi-title">BI 经营数据刷新 <el-tag effect="light">独立调度</el-tag></h2>
        <p>从系统业务表生成 BI 快照，可独立于业务同步流程运行。</p>
      </div>
      <div class="bi-detail"><span>数据来源</span><strong>系统业务表 → BI 快照</strong></div>
      <div class="bi-detail">
        <span>执行时机</span
        ><strong>{{ bi ? (bi.managed ? frequency(bi.settings) : '待配置') : '暂不可用' }}</strong
        ><small v-if="bi">{{
          bi.managed ? (bi.settings.enabled ? '已启用' : '已停用') : '沿用 BI 服务配置'
        }}</small>
      </div>
      <el-button :disabled="!bi || loadingBi" @click="biOpen = true">配置</el-button>
      <el-alert
        v-if="biError"
        class="bi-error"
        :title="biError"
        type="error"
        :closable="false"
        show-icon
      />
    </section>
    <div class="history-note">
      <el-icon><InfoFilled /></el-icon
      ><span>9 月 4 日前历史日期保持不变 · 保留已有同步进度 · 同一任务不重复运行</span
      ><small>切换时间：2026-09-04 00:00（北京时间）</small>
    </div>
    <section v-if="dhb || bi" class="runtime" aria-label="实际调度状态">
      <header>
        <h2>实际调度状态</h2>
        <span>服务运行期间执行；电脑睡眠或服务停止时不会继续调度。</span>
      </header>
      <div v-for="row in runtimeRows" :key="row.name" class="runtime-row">
        <strong>{{ row.name }}</strong
        ><span>{{ stateLabel(row.plan) }}</span
        ><span>下次运行：{{ nextRun(row.plan) }}</span
        ><span>最近结果：{{ resultLabel(row.plan.lastStatus) }}</span>
        <p v-if="row.plan.lastMessage">{{ row.plan.lastMessage }}</p>
        <small v-if="row.plan.lastStartedAt"
          >开始 {{ displayDateTime(row.plan.lastStartedAt)
          }}<template v-if="row.plan.lastFinishedAt">
            · 结束 {{ displayDateTime(row.plan.lastFinishedAt) }}</template
          ></small
        >
      </div>
    </section>
    <el-dialog
      v-model="biOpen"
      title="BI 经营数据刷新计划"
      width="min(480px, calc(100vw - 32px))"
      :close-on-click-modal="false"
    >
      <p class="bi-dialog-note">保存后使用这里的计划；保存停用配置也会停止原有自动刷新。</p>
      <SyncScheduleForm
        v-if="bi"
        :plan="bi"
        :editable="canBi"
        :saving="savingBi"
        inactive-label="保存并停用"
        @save="saveBi"
        @cancel="biOpen = false"
      />
      <el-alert v-if="biError" :title="biError" type="error" :closable="false" />
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Document, Tickets, Right, Refresh, InfoFilled } from '@element-plus/icons-vue'
import SyncScheduleForm from '@/components/supply/SyncScheduleForm.vue'
import { getDhbSyncTasks } from '@/api/core/dhb-orchestration'
import {
  getBiSchedule,
  getDhbSchedule,
  saveBiSchedule,
  saveDhbSchedule,
  frequency,
  type ScheduleSettings,
  type ScheduleView,
} from '@/api/core/sync-schedule'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayDateTime } from '@/utils/business-date'
const { can } = useSupplyPermissions()
const canDhb = computed(() => can('integration:dhb:write') && can('hr:employee:sync'))
const canBi = computed(() => can('integration:dhb:write') && can('analytics:refresh:write'))
const steps = [
  { title: '业务员与员工关联', text: '先匹配员工，再补订货宝关联', icon: User },
  { title: '客户资料', text: '按客户编码同步门店与归属', icon: Document },
  { title: '订单包', text: '订单 · 明细 · 回款', icon: Tickets },
]
const connectors = ref<string[]>([]),
  connector = ref('')
const dhb = ref<ScheduleView | null>(null),
  bi = ref<ScheduleView | null>(null)
const dhbError = ref(''),
  biError = ref('')
const loadingDhb = ref(false),
  loadingBi = ref(false),
  loading = ref(false)
const savingDhb = ref(false),
  savingBi = ref(false),
  biOpen = ref(false)
const runtimeRows = computed(() =>
  [
    { name: '订货宝业务同步', plan: dhb.value },
    { name: 'BI 经营数据刷新', plan: bi.value },
  ].filter((row): row is { name: string; plan: ScheduleView } => row.plan !== null),
)
function message(error: unknown) {
  return error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : '请求失败，请刷新后重试'
}
async function loadDhb() {
  if (!connector.value) return
  loadingDhb.value = true
  dhbError.value = ''
  dhb.value = null
  try {
    dhb.value = await getDhbSchedule(connector.value)
  } catch (error) {
    dhbError.value = `无法读取计划：${message(error)}`
  } finally {
    loadingDhb.value = false
  }
}
async function load() {
  loading.value = true
  loadingDhb.value = true
  loadingBi.value = true
  dhbError.value = ''
  biError.value = ''
  const results = await Promise.allSettled([
    (async () => {
      connectors.value = [...new Set((await getDhbSyncTasks()).map((task) => task.connectorId))]
      if (!connectors.value.includes(connector.value)) connector.value = connectors.value[0] ?? ''
      if (connector.value) await loadDhb()
      else {
        dhb.value = null
        dhbError.value = '请先配置订货宝客户与订单同步目标'
      }
    })(),
    (async () => {
      bi.value = await getBiSchedule()
    })(),
  ])
  if (results[0].status === 'rejected') {
    dhb.value = null
    dhbError.value = `无法读取同步来源：${message(results[0].reason)}`
  }
  if (results[1].status === 'rejected') {
    bi.value = null
    biError.value = `无法读取 BI 计划：${message(results[1].reason)}`
  }
  loading.value = false
  loadingDhb.value = false
  loadingBi.value = false
}
async function saveDhb(settings: ScheduleSettings) {
  if (!dhb.value || savingDhb.value) return
  savingDhb.value = true
  dhbError.value = ''
  try {
    dhb.value = await saveDhbSchedule(connector.value, settings, dhb.value.version)
    ElMessage.success(settings.enabled ? '计划已保存，将按配置时间执行' : '停用配置已保存')
  } catch (error) {
    dhbError.value = message(error)
  } finally {
    savingDhb.value = false
  }
}
async function saveBi(settings: ScheduleSettings) {
  if (!bi.value || savingBi.value) return
  savingBi.value = true
  biError.value = ''
  try {
    bi.value = await saveBiSchedule(settings, bi.value.version)
    biOpen.value = false
    ElMessage.success('BI 刷新计划已保存')
  } catch (error) {
    biError.value = message(error)
  } finally {
    savingBi.value = false
  }
}
function resultLabel(status: string | null) {
  return status
    ? ((
        {
          SUCCEEDED: '成功',
          SUCCESS: '成功',
          PARTIAL: '部分完成',
          SUCCEEDED_WITH_WARNINGS: '有待核对项',
          FAILED: '失败',
          SKIPPED: '本轮跳过',
          UNKNOWN: '结果待核实',
          RUNNING: '执行中',
        } as Record<string, string>
      )[status] ?? status)
    : '暂无执行记录'
}
function stateLabel(plan: ScheduleView) {
  return !plan.managed ? '尚未由页面管理' : plan.settings.enabled ? '已启用' : '已停用'
}
function nextRun(plan: ScheduleView) {
  return plan.runningJobId
    ? '本轮结束后确定；结果不明时暂停'
    : plan.nextRunAt
      ? displayDateTime(plan.nextRunAt)
      : plan.managed
        ? '未启用'
        : '待服务确认'
}
onMounted(load)
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.sync-schedules {
  max-width: 1600px;
  margin: 0 auto;
  color: $color-text-primary;
}
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}
.sync-schedules .page-heading h1 {
  margin: 0 0 12px;
  font-size: 30px;
  letter-spacing: -0.6px;
}
h2 {
  font-size: 20px;
  margin: 0 0 12px;
  font-weight: 600;
}
p {
  color: $color-text-secondary;
  line-height: 1.75;
  font-size: 14px;
  margin: 0;
}
.business-plan {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(310px, 1fr);
  background: white;
  border: 1px solid $color-border-base;
  border-radius: 8px;
  padding: 28px;
}
.flow-area {
  padding-right: 28px;
  display: flex;
  flex-direction: column;
}
.flow {
  flex: 1;
  list-style: none;
  padding: 38px 0 46px;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.flow li {
  position: relative;
  text-align: center;
}
.flow-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 20px;
  display: grid;
  place-items: center;
  background: #eff6ff;
  border-radius: 50%;
  color: $color-primary;
  font-size: 32px;
}
.flow h3 {
  font-size: 17px;
  margin: 0 0 8px;
}
.flow p {
  font-size: 13px;
}
.flow-arrow {
  position: absolute;
  top: 32px;
  right: -22px;
  font-size: 28px;
  color: #94a3b8;
}
.dependency-note,
.history-note {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #eff6ff;
  color: #475569;
  padding: 16px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.65;
}
.dependency-note .el-icon,
.history-note .el-icon {
  color: $color-primary;
  font-size: 18px;
  flex-shrink: 0;
}
.settings-area {
  padding-left: 30px;
  border-left: 1px solid $color-border-lighter;
}
.settings-area h2 {
  margin-bottom: 24px;
}
.settings-area .el-alert {
  margin-bottom: 16px;
}
.service-note {
  margin-top: 14px;
  font-size: 12px;
}
.bi-plan {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 22px;
  background: white;
  border: 1px solid $color-border-base;
  border-radius: 8px;
  margin: 20px 0;
  padding: 28px;
}
.bi-intro {
  flex: 1;
  min-width: 270px;
}
.bi-intro h2 {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 19px;
}
.bi-intro p {
  font-size: 13px;
}
.bi-detail {
  padding-left: 24px;
  border-left: 1px solid $color-border-base;
}
.bi-detail span,
.bi-detail strong,
.bi-detail small {
  display: block;
}
.bi-detail span {
  color: $color-text-secondary;
  font-size: 12px;
  margin-bottom: 12px;
}
.bi-detail strong {
  font-size: 14px;
  font-weight: 500;
}
.bi-detail small {
  color: $color-text-secondary;
  margin-top: 8px;
}
.bi-plan .el-button {
  min-width: 88px;
}
.bi-error {
  width: 100%;
}
.history-note small {
  margin-left: auto;
  color: #64748b;
}
.history-note {
  flex-wrap: wrap;
  border: 1px solid #dbeafe;
}
.runtime {
  margin-top: 28px;
}
.runtime header {
  display: flex;
  align-items: baseline;
  gap: 20px;
  flex-wrap: wrap;
}
.runtime header h2 {
  font-size: 16px;
}
.runtime header span {
  color: #64748b;
  font-size: 12px;
}
.runtime-row {
  display: grid;
  grid-template-columns: 170px 150px 1.7fr 1fr;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  color: #64748b;
}
.runtime-row strong {
  color: #334155;
  font-weight: 500;
}
.runtime-row p,
.runtime-row small {
  grid-column: 1/-1;
  font-size: 12px;
}
.connector-picker {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.connector-picker .el-select {
  max-width: 420px;
}
.bi-dialog-note {
  margin-bottom: 24px;
}
@media (max-width: 1150px) {
  .business-plan {
    grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr);
    padding: 22px;
  }
  .flow-icon {
    width: 64px;
    height: 64px;
  }
  .flow h3 {
    font-size: 14px;
  }
  .flow-arrow {
    top: 22px;
  }
  .flow {
    gap: 12px;
  }
  .runtime-row {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 800px) {
  .business-plan {
    grid-template-columns: 1fr;
  }
  .flow-area {
    padding: 0 0 24px;
  }
  .settings-area {
    border-left: none;
    border-top: 1px solid #e2e8f0;
    padding: 24px 0 0;
  }
  .flow {
    padding: 28px 0;
  }
  .page-heading {
    align-items: flex-start;
  }
  .sync-schedules .page-heading h1 {
    font-size: 24px;
  }
  .bi-detail {
    border: 0;
    padding: 0;
  }
  .history-note small {
    margin-left: 0;
  }
}
@media (max-width: 440px) {
  .flow {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .flow-arrow {
    display: none;
  }
  .page-heading {
    flex-direction: column;
  }
}
</style>
