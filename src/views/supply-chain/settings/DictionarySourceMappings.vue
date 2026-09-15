<template>
  <section v-loading="loading">
    <div class="mapping-toolbar">
      <span>{{ rows.filter(row => row.mappingStatus === 'PENDING').length }} 个待映射来源值</span>
      <span><el-button v-if="canWrite" :loading="scanning" @click="rescan">扫描已有飞书来源</el-button><el-button @click="load">刷新</el-button></span>
    </div>
    <el-alert v-if="scanSummary" class="scan-summary" :type="scanWarning ? 'warning' : 'info'" :closable="false" :title="scanSummary" />
    <el-alert v-if="loadFailed" type="error" :closable="false" title="来源映射加载失败，请刷新重试" />
    <el-table :data="rows" max-height="520" row-key="id">
      <el-table-column prop="sourceSystem" label="来源" width="90" />
      <el-table-column prop="sourceScope" label="来源表/对象" min-width="150" show-overflow-tooltip />
      <el-table-column prop="sourceField" label="来源字段" min-width="110" />
      <el-table-column prop="sourceValue" label="原始值" min-width="160" show-overflow-tooltip />
      <el-table-column label="标准项" min-width="180">
        <template #default="{ row }">{{ row.targetItemCode ? `${dictionaryName(row.targetDictionaryCode)} / ${row.targetItemCode}` : '待映射' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="105">
        <template #default="{ row }"><el-tag :type="row.mappingStatus === 'MAPPED' ? 'success' : 'warning'">{{ row.mappingStatus === 'MAPPED' ? '已映射' : '待映射' }}</el-tag></template>
      </el-table-column>
      <!-- @vue-generic {DictionarySourceMapping} -->
      <el-table-column v-if="canWrite" label="操作" fixed="right" width="85">
        <template #default="{ row }"><el-button link type="primary" @click="edit(row)">配置</el-button></template>
      </el-table-column>
      <template #empty><el-empty description="尚无来源观察记录；后续导入会自动记录" /></template>
    </el-table>
    <el-dialog v-model="dialog" title="配置来源映射" width="560px" append-to-body>
      <p v-if="selected">{{ selected.sourceSystem }} · {{ selected.sourceField }}：{{ selected.sourceValue }}</p>
      <el-form label-width="90px">
        <el-form-item label="标准字典">
          <el-select v-model="targetDictionary" filterable @change="loadTargets">
            <el-option v-for="d in catalog" :key="d.dictionaryCode" :value="d.dictionaryCode" :label="d.dictionaryName" />
          </el-select>
        </el-form-item>
        <el-form-item label="标准项">
          <el-select v-model="targetItem" filterable :loading="targetsLoading">
            <el-option v-for="item in targets" :key="item.dictionaryItemCode" :value="item.dictionaryItemCode" :label="`${item.dictionaryItemName}（${item.dictionaryItemCode}）`" />
          </el-select>
        </el-form-item>
      </el-form>
      <p>保存后用于该租户、来源表和字段的来源字典解析，原始值保留；业务状态仍按各业务模块的规则处理。</p>
      <template #footer><el-button @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!targetItem" @click="save">保存映射</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getDictionarySourceMappings, rescanDictionarySources, updateDictionarySourceMapping, getEffectiveBizDict, getBizDicts, type DictionarySourceMapping, type DictView, type DictItemView } from '@/api/core/business-settings'
const props = defineProps<{ dictionaryCode: string; dictionaries: DictView[]; canWrite: boolean }>()
const rows = ref<DictionarySourceMapping[]>([])
const catalog = ref<DictView[]>([])
const scanSummary = ref(''), scanWarning = ref(false)
const scanning = ref(false)
const loading = ref(false), loadFailed = ref(false), saving = ref(false), dialog = ref(false), targetsLoading = ref(false)
const selected = ref<DictionarySourceMapping | null>(null)
const targetDictionary = ref(''), targetItem = ref('')
const targets = ref<DictItemView[]>([])
let requestVersion = 0, targetVersion = 0
function dictionaryName(code: string) { return (catalog.value.length ? catalog.value : props.dictionaries).find(d => d.dictionaryCode === code)?.dictionaryName || code }
async function rescan() {
  scanning.value = true; scanSummary.value = ''; scanWarning.value = false
  try {
    const result = await rescanDictionarySources(props.dictionaryCode)
    const message = `已扫描本租户 ${result.batches} 个飞书导入批次、${result.rows} 行，发现 ${result.observedValues} 个来源值，${result.pendingValues} 个待映射`
    scanWarning.value = result.truncated
    scanSummary.value = message + (result.truncated ? '；扫描达到上限，可能存在未扫描记录' : '')
      + (result.observedValues === 0 ? '。已有导入记录中未提取到该字典的来源字段值' : '')
    await load()
  } catch { scanWarning.value = true; scanSummary.value = '来源扫描失败，请重试' }
  finally { scanning.value = false }
}
async function load() {
  const version = ++requestVersion
  loading.value = true; loadFailed.value = false
  try { const result = await getDictionarySourceMappings(props.dictionaryCode); if (version === requestVersion) rows.value = result }
  catch { if (version === requestVersion) { rows.value = []; loadFailed.value = true } }
  finally { if (version === requestVersion) loading.value = false }
}
async function loadTargets() {
  const version = ++targetVersion
  targetItem.value = ''; targets.value = []; targetsLoading.value = true
  try { const result = await getEffectiveBizDict(targetDictionary.value); if (version === targetVersion) targets.value = result.items }
  finally { if (version === targetVersion) targetsLoading.value = false }
}
async function edit(row: DictionarySourceMapping) {
  selected.value = row; targetDictionary.value = row.targetDictionaryCode || props.dictionaryCode; dialog.value = true
  await loadTargets()
  if (targets.value.some(item => item.dictionaryItemCode === row.targetItemCode)) targetItem.value = row.targetItemCode || ''
}
async function save() {
  if (!selected.value || !targetItem.value) return
  saving.value = true
  try {
    await updateDictionarySourceMapping(selected.value.id, { targetDictionaryCode: targetDictionary.value, targetItemCode: targetItem.value, revision: selected.value.revision })
    dialog.value = false; ElMessage.success('来源映射已保存'); await load()
  } finally { saving.value = false }
}
onMounted(async () => { catalog.value = await getBizDicts({}) })
watch(() => props.dictionaryCode, () => { scanSummary.value = ''; void load() }, { immediate: true })
</script>
<style scoped>
.scan-summary { margin-bottom: 12px; }
.mapping-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
</style>
