<template>
  <section class="settings-home" v-loading="loading">
    <el-result
      v-if="!access.context?.initialized"
      icon="info"
      title="供应链系统设置"
      sub-title="初始化后可维护本系统的菜单、用户和角色。"
    >
      <template #extra
        ><el-button
          v-if="access.context?.canInitialize"
          type="primary"
          :loading="initializing"
          @click="initialize"
          >初始化系统设置</el-button
        >
        <p v-else>请联系本租户管理员完成初始化。</p></template
      >
    </el-result>
    <template v-else>
      <SupplyPageTitle tag="h2">系统设置</SupplyPageTitle>
      <p class="description">维护供应链系统的用户、角色、菜单和业务配置。</p>
      <el-alert
        v-if="access.context?.mode === 'PREPARING'"
        title="当前处于配置准备阶段"
        description="完成用户、角色和业务范围配置后，检查并启用范围控制。"
        type="warning"
        :closable="false"
      />
      <el-button
        v-if="access.context?.mode === 'PREPARING' && access.can('supply:role:grant')"
        :loading="checking"
        @click="inspect"
        style="margin-top: 16px"
        >检查并启用范围控制</el-button
      >
      <el-button
        v-if="access.can('supply:role:grant')"
        @click="loadObservations(1)"
        style="margin: 16px 0 0 12px"
        >功能授权对比</el-button
      >
      <el-button
        v-if="access.can('supply:role:grant')"
        @click="loadDataObservations(1)"
        style="margin: 16px 0 0 12px"
        >数据权限对比</el-button
      >
      <div class="settings-grid">
        <router-link
          v-for="entry in entries"
          :key="entry.path"
          :to="entry.path"
          class="settings-card"
          ><strong>{{ entry.name }}</strong
          ><span>{{ entry.description }}</span></router-link
        >
      </div>
    </template>
    <el-dialog v-model="dataVisible" title="实际记录数据权限对比" width="min(1100px,96vw)">
      <el-alert
        title="对比准备阶段同一请求中实际记录的旧决定与候选 SQL 决定，每个请求最多采样20条。记录只用于核对；采样不代表所有列表、汇总或角色场景已完成验收。"
        type="info"
        :closable="false"
      />
      <el-table :data="dataObservations" max-height="450">
        <el-table-column prop="username" label="登录账号" /><el-table-column
          prop="domain"
          label="业务领域"
          width="90"
        /><el-table-column prop="action" label="操作" min-width="180" /><el-table-column
          prop="recordKey"
          label="记录标识"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column label="旧决定"
          ><template #default="{ row }">{{
            row.legacyAllowed ? '允许' : '拒绝'
          }}</template></el-table-column
        >
        <el-table-column label="新决定"
          ><template #default="{ row }"
            ><el-tag :type="row.legacyAllowed === row.proposedAllowed ? 'info' : 'warning'">{{
              row.proposedAllowed ? '允许' : '拒绝'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="applicationVersion" label="配置版本" /><el-table-column
          prop="sampleCount"
          label="采样次数"
        />
      </el-table>
      <el-pagination
        :current-page="dataPage"
        :total="dataTotal"
        :page-size="20"
        layout="total,prev,pager,next"
        @current-change="loadDataObservations"
      />
    </el-dialog>
    <el-dialog v-model="observationsVisible" title="实际请求功能授权对比" width="min(1000px,96vw)">
      <el-alert
        title="记录准备阶段实际请求的旧、新功能决定及候选范围，业务仍按旧授权执行。业务数据记录范围需要另行验收。"
        type="info"
        :closable="false"
      />
      <el-table :data="observations" max-height="460">
        <el-table-column type="expand"
          ><template #default="{ row }">
            <pre class="scope-evidence">{{ row.policyJson }}</pre>
          </template></el-table-column
        >
        <el-table-column prop="username" label="登录账号" />
        <el-table-column prop="action" label="新操作" min-width="180" />
        <el-table-column prop="legacyAction" label="旧操作" min-width="150" />
        <el-table-column label="旧决定"
          ><template #default="{ row }">{{
            row.legacyAllowed ? '允许' : '拒绝'
          }}</template></el-table-column
        >
        <el-table-column label="新决定"
          ><template #default="{ row }"
            ><el-tag :type="row.legacyAllowed === row.proposedAllowed ? 'info' : 'warning'">{{
              row.proposedAllowed ? '允许' : '拒绝'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="sampleCount" label="采样次数" />
        <el-table-column prop="applicationVersion" label="配置版本" />
      </el-table>
      <el-pagination
        :current-page="observationPage"
        :total="observationTotal"
        :page-size="20"
        layout="total,prev,pager,next"
        @current-change="loadObservations"
      />
    </el-dialog>
    <el-dialog v-model="cutoverVisible" title="启用供应链范围控制" width="820px" destroy-on-close>
      <template v-if="report"
        ><el-alert
          :title="report.ready ? '检查通过，请核对提示项后启用' : '请先处理阻塞问题，再重新检查'"
          :type="report.ready ? 'success' : 'error'"
          :closable="false"
        />
        <el-table :data="report.issues" max-height="360"
          ><el-table-column label="级别" width="80"
            ><template #default="{ row }">{{
              row.severity === 'BLOCKING' ? '阻塞' : '提示'
            }}</template></el-table-column
          ><el-table-column prop="count" label="数量" width="70" /><el-table-column
            prop="message"
            label="检查结果"
        /></el-table>
        <p>启用后，本供应链系统的业务操作统一使用已配置的角色和数据范围。</p>
        <el-checkbox v-if="report.issues.length" v-model="acknowledged"
          >已核对提示项，历史待核对数据按限制保留</el-checkbox
        >
        <el-input
          v-model="activationReason"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="填写启用说明，至少 4 字"
          style="margin-top: 12px"
        /> </template
      ><template #footer
        ><el-button @click="cutoverVisible = false">关闭</el-button
        ><el-button :loading="checking" @click="inspect">重新检查</el-button
        ><el-button
          type="primary"
          :loading="activating"
          :disabled="
            !report?.ready ||
            activationReason.trim().length < 4 ||
            (!!report?.issues.length && !acknowledged)
          "
          @click="activate"
          >启用范围控制</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onMounted, ref } from 'vue'
import type { SupplyDataObservation } from '@/api/core/supply-settings'
import { ElMessage } from 'element-plus'
import {
  supplySettingsApi,
  type CutoverReport,
  type SupplyAuthorizationObservation,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { useNavigationStore } from '@/stores/navigation'
const dataVisible = ref(false),
  dataObservations = ref<SupplyDataObservation[]>([]),
  dataPage = ref(1),
  dataTotal = ref(0)
async function loadDataObservations(page: number) {
  try {
    const result = await supplySettingsApi.dataObservations(page)
    dataObservations.value = result.items
    dataPage.value = result.page
    dataTotal.value = result.total
    dataVisible.value = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '数据权限对比加载失败')
  }
}
const access = useSupplyAuthorizationStore(),
  navigation = useNavigationStore()
const loading = ref(false),
  initializing = ref(false)
const observationsVisible = ref(false),
  observations = ref<SupplyAuthorizationObservation[]>([]),
  observationTotal = ref(0),
  observationPage = ref(1)
async function loadObservations(page: number) {
  const result = await supplySettingsApi.observations(page)
  observations.value = result.items
  observationTotal.value = result.total
  observationPage.value = page
  observationsVisible.value = true
}
const checking = ref(false),
  activating = ref(false),
  cutoverVisible = ref(false),
  acknowledged = ref(false),
  activationReason = ref(''),
  report = ref<CutoverReport | null>(null)
async function inspect() {
  checking.value = true
  try {
    report.value = await supplySettingsApi.readiness()
    acknowledged.value = false
    cutoverVisible.value = true
  } finally {
    checking.value = false
  }
}
async function activate() {
  const current = report.value
  if (!current) return
  activating.value = true
  try {
    await supplySettingsApi.activate({
      version: current.version,
      fingerprint: current.fingerprint,
      reason: activationReason.value,
      acknowledgeWarnings: acknowledged.value,
    })
    await access.refresh()
    await navigation.fetchNavigation('SUPPLY_CHAIN')
    cutoverVisible.value = false
    ElMessage.success('供应链范围控制已启用')
  } finally {
    activating.value = false
  }
}
const descriptions: Record<string, string> = {
  users: '关联员工与账号，分配角色和业务范围',
  roles: '配置功能与数据权限',
  menus: '设置菜单名称、层级、图标和操作权限',
  'numbering-dictionaries': '维护业务使用的字典项',
  parameters: '维护各业务模块的参数',
  audits: '查询系统设置操作记录',
}
const entries = computed(() => {
  const result: { path: string; name: string; description: string }[] = []
  const visit = (nodes: ReturnType<typeof navigation.getNavigation>) => {
    for (const node of nodes) {
      if (
        node.visible &&
        node.routePath?.startsWith('/supply-chain/settings/') &&
        node.type === 'PAGE'
      )
        result.push({
          path: node.routePath,
          name: node.displayName,
          description: descriptions[node.routePath.split('/').at(-1)!] || '',
        })
      visit(node.children)
    }
  }
  visit(navigation.getNavigation('SUPPLY_CHAIN'))
  return result
})
async function initialize() {
  initializing.value = true
  try {
    await access.initialize()
  } finally {
    initializing.value = false
  }
}
onMounted(async () => {
  loading.value = true
  try {
    await access.refresh()
  } finally {
    loading.value = false
  }
})
</script>
<style scoped>
.scope-evidence {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px;
}
.settings-home {
  padding: 24px;
}
.description {
  color: var(--el-text-color-secondary);
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.settings-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--el-border-color);
  padding: 24px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--el-text-color-primary);
}
.settings-card:hover {
  border-color: var(--el-color-primary);
}
.settings-card span {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
