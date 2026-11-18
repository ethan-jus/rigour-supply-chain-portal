<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { crmWecomApi, type WecomPerson, type WecomSummary } from '@/api/core/crm-wecom'
import wecomLogo from '@/assets/images/wecom-official.png'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
const props = defineProps<{ view: 'MINE' | 'ALL' }>()
const summary = ref<WecomSummary | null>(null), rows = ref<WecomPerson[]>([])
const loading = ref(false), error = ref(''), pending = ref(false), total = ref(0), cursor = ref<string | null>(null)
let generation = 0
async function load(append = false) {
  const request = ++generation
  loading.value = true; error.value = ''
  if (!append) { rows.value = []; summary.value = null; total.value = 0; cursor.value = null }
  try {
    const [stats, page] = await Promise.all([crmWecomApi.summary(props.view), crmWecomApi.list(props.view, pending.value, append ? cursor.value ?? undefined : undefined)])
    if (request !== generation) return
    summary.value = stats; rows.value = append ? rows.value.concat(page.items) : page.items; total.value = page.total; cursor.value = page.nextCursor
  } catch (e) { if (request === generation) error.value = e instanceof Error ? e.message : '加载企微联系人失败' }
  finally { if (request === generation) loading.value = false }
}
onMounted(() => load())
onBeforeUnmount(() => generation++)
</script>
<template>
  <section v-loading="loading" class="wecom-overview">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-else-if="summary?.dataStatus === 'NOT_CONNECTED'" title="尚未接入企微官方同步，统计暂不可用" type="info" :closable="false" />
    <el-alert v-else-if="summary?.dataStatus === 'PARTIAL' || summary?.dataStatus === 'STALE'" :title="summary.dataStatus === 'STALE' ? '数据超过 24 小时未更新，以下为最近同步结果' : '以下为已同步员工范围，尚未确认覆盖全公司'" type="warning" :closable="false" />
    <div class="wecom-metrics">
      <div><span>{{ view === 'MINE' ? '我的有效企微联系人' : '已同步企微联系人' }}</span><strong>{{ summary?.activeContacts ?? '—' }}</strong></div>
      <div><span>已关联企微人数</span><strong>{{ summary?.linkedContacts ?? '—' }}</strong></div>
      <div><span>待关联企微人数</span><strong>{{ summary?.pendingContacts ?? '—' }}</strong></div>
      <div><span>覆盖授权门店</span><strong>{{ summary?.coveredStores ?? '—' }}</strong></div>
    </div>
    <div class="wecom-toolbar"><el-radio-group v-model="pending" :disabled="loading" @change="load()" aria-label="企微关联状态"><el-radio-button :value="false">全部有效关系</el-radio-button><el-radio-button :value="true">待关联门店</el-radio-button></el-radio-group><span>按联系人去重 · {{ total }} 人</span></div>
    <el-table :data="rows" empty-text="暂无可展示的企微联系人">
      <el-table-column label="联系人" min-width="150"><template #default="{ row }"><img :src="wecomLogo" alt="企微" class="wecom-logo" />{{ row.name }}</template></el-table-column>
      <el-table-column label="门店" min-width="240"><template #default="{ row }"><div v-for="store in row.stores" :key="store.id">{{ store.name }} · {{ store.role }}</div><span v-if="!row.stores.length">{{ row.linked ? '已关联（当前无查看权限）' : '待关联门店' }}</span></template></el-table-column>
      <el-table-column label="企微跟进销售" min-width="180"><template #default="{ row }"><div v-for="relation in row.relations" :key="relation.employeeId + relation.addedAt">{{ relation.employeeName }} · {{ new Date(relation.addedAt).toLocaleDateString('zh-CN') }}</div></template></el-table-column>
      <el-table-column label="关系状态" width="120"><template #default>有效关系</template></el-table-column>
    </el-table>
    <ListTableFooter><template #actions><el-button :disabled="loading" @click="load()">刷新</el-button><span v-if="summary?.syncedAt">同步于 {{ new Date(summary.syncedAt).toLocaleString('zh-CN') }}</span></template><el-button v-if="cursor" :disabled="loading" @click="load(true)">加载更多</el-button></ListTableFooter>
  </section>
</template>
<style scoped>
.wecom-metrics { display: flex; flex-wrap: wrap; gap: 32px; padding: 22px 0; }
.wecom-metrics div { display: flex; flex-direction: column; gap: 10px; min-width: 130px; }
.wecom-metrics span { color: var(--el-text-color-secondary); }
.wecom-metrics strong { font-size: 28px; }
.wecom-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.wecom-logo { width: 20px; height: 20px; vertical-align: middle; margin-right: 6px; }
</style>
