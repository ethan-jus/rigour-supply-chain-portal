<template>
  <section class="master-data dict-page">
    <header class="master-heading">
      <div>
        <SupplyPageTitle>数据字典</SupplyPageTitle>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadDicts">刷新</el-button
        ><el-button v-if="canWrite" :icon="Plus" type="primary" @click="openDict()"
          >新增字典</el-button
        >
      </div>
    </header>
    <el-alert v-if="catalogError" :title="catalogError" type="error" :closable="false" show-icon />
    <div class="master-workspace" v-loading="loading">
      <aside class="master-directory" aria-label="字典目录">
        <div class="directory-heading">
          <h2>字典目录</h2>
          <span>{{
            directorySearch
              ? `匹配 ${filteredDictionaries.length} 个`
              : `${dictionaries.length} 个字典`
          }}</span>
        </div>
        <div class="directory-search">
          <el-input
            v-model="directorySearch"
            :prefix-icon="Search"
            placeholder="搜索名称或编码"
            aria-label="搜索字典名称或编码"
            clearable
          />
        </div>
        <nav class="directory-scroll" aria-label="选择数据字典">
          <button
            v-for="dictionary in filteredDictionaries"
            :key="dictionary.id"
            class="directory-item dictionary-entry"
            :aria-pressed="selectedDict?.id === dictionary.id"
            @click="selectDict(dictionary)"
          >
            <span :title="`${dictionary.dictionaryName}（${dictionary.dictionaryCode}）`">{{
              dictionary.dictionaryName
            }}</span>
            <el-icon v-if="selectedDict?.id === dictionary.id"><ArrowRight /></el-icon>
          </button>
          <div v-if="!filteredDictionaries.length && !loading" class="directory-empty">
            {{ directorySearch ? '没有匹配的字典' : '暂无数据字典'
            }}<el-button v-if="directorySearch" link type="primary" @click="directorySearch = ''"
              >清空搜索</el-button
            >
          </div>
        </nav>
      </aside>
      <section class="master-detail">
        <div class="mobile-directory">
          <label for="dictionary-select">选择字典</label
          ><select
            id="dictionary-select"
            :value="selectedDict?.id"
            @change="
              selectDict(
                dictionaries.find(
                  (d) => String(d.id) === ($event.target as HTMLSelectElement).value,
                ) || null,
              )
            "
          >
            <option v-for="dictionary in dictionaries" :key="dictionary.id" :value="dictionary.id">
              {{ dictionary.dictionaryName }} · {{ dictionary.dictionaryCode }}
            </option>
          </select>
        </div>
        <template v-if="selectedDict">
          <header class="detail-heading dictionary-detail-heading">
            <div class="dictionary-identity">
              <div class="detail-title-line">
                <h2>{{ selectedDict.dictionaryName }}</h2>
                <span class="neutral-label">{{
                  selectedDict.sourceType === 'BUILTIN'
                    ? '系统预置'
                    : selectedDict.sourceType === 'OVERRIDE'
                      ? '租户覆盖'
                      : '自定义'
                }}</span>
              </div>
              <span class="detail-code">{{ selectedDict.dictionaryCode }}</span>
              <el-tooltip
                v-if="selectedDict.remark"
                :content="selectedDict.remark"
                placement="bottom"
                ><el-button link :icon="InfoFilled" aria-label="字典说明"
              /></el-tooltip>
            </div>
            <el-button v-if="canWrite" @click="openDict(selectedDict)">编辑字典</el-button>
          </header>
          <div class="dictionary-controls">
            <el-tabs v-model="itemMode" class="dictionary-tabs" @tab-change="itemSearch = ''">
              <el-tab-pane
                :label="`标准项 ${itemsLoading || itemsError ? '—' : standardItems.length}`"
                name="standard"
              />
              <el-tab-pane
                :label="`历史兼容 ${itemsLoading || itemsError ? '—' : items.length - standardItems.length}`"
                name="aliases"
              />
              <el-tab-pane label="来源映射" name="sources" />
            </el-tabs>
            <div v-if="itemMode !== 'sources'" class="detail-toolbar">
              <el-input
                v-model="itemSearch"
                :prefix-icon="Search"
                placeholder="搜索字典项名称或编码"
                aria-label="搜索字典项"
                clearable
              />
              <el-button
                v-if="canWrite && selectedDict.allowNewItems && itemMode === 'standard'"
                :icon="Plus"
                type="primary"
                @click="openItem()"
                >新增字典项</el-button
              >
            </div>
          </div>
          <p v-if="itemMode === 'aliases'" class="detail-note">
            旧编码保留历史解析关系；新录入使用对应标准项。
          </p>
          <div v-if="itemsError && itemMode !== 'sources'" class="detail-error" role="alert">
            <span>{{ itemsError }}</span
            ><el-button @click="selectDict(selectedDict)">重新加载</el-button>
          </div>
          <DictionarySourceMappings
            v-else-if="itemMode === 'sources'"
            class="dictionary-mappings"
            :dictionary-code="selectedDict.dictionaryCode"
            :dictionaries="dictionaries"
            :can-write="canWrite"
          />
          <div v-else class="master-table" v-loading="itemsLoading">
            <el-table
              :data="itemTree"
              height="100%"
              row-key="id"
              default-expand-all
              :tree-props="{ children: 'children' }"
            >
              <el-table-column
                prop="dictionaryItemName"
                label="字典项名称"
                width="150"
                show-overflow-tooltip
              />
              <el-table-column
                prop="dictionaryItemCode"
                label="字典项编码"
                width="170"
                show-overflow-tooltip
              />
              <el-table-column label="状态" width="75"
                ><template #default="{ row }"
                  ><span class="item-status" :class="{ 'is-disabled': row.enabled === false }">{{
                    row.enabled === false ? '停用' : '启用'
                  }}</span></template
                ></el-table-column
              >
              <el-table-column prop="ordinal" label="排序" width="60" align="right" />
              <el-table-column
                v-if="itemMode === 'aliases'"
                label="对应标准项"
                width="230"
                show-overflow-tooltip
                ><template #default="{ row }"
                  >{{ row.canonicalDictionaryCode }} / {{ row.canonicalItemCode }}</template
                ></el-table-column
              >
              <el-table-column label="说明" min-width="140" show-overflow-tooltip
                ><template #default="{ row }">{{ row.remark || '—' }}</template></el-table-column
              >
              <!-- @vue-generic {DictItemView} -->
              <el-table-column
                v-if="canWrite && itemMode === 'standard'"
                label="操作"
                :width="selectedDict.allowNewItems ? 100 : 70"
                fixed="right"
                align="right"
                ><template #default="{ row }"
                  ><el-button link type="primary" @click="openItem(row)">编辑</el-button
                  ><el-button
                    v-if="selectedDict.allowNewItems"
                    link
                    type="primary"
                    @click="openMerge(row)"
                    >合并</el-button
                  ></template
                ></el-table-column
              >
              <template #empty
                ><el-empty
                  :image-size="72"
                  :description="
                    itemSearch
                      ? '没有匹配的字典项'
                      : itemMode === 'aliases'
                        ? '暂无历史兼容编码'
                        : '暂无字典项'
                  "
              /></template>
            </el-table>
          </div>
          <footer v-if="itemMode !== 'sources'" class="detail-footer">
            <span>{{
              itemsLoading
                ? '正在加载…'
                : itemsError
                  ? '数据未加载'
                  : `共 ${matchedItems.length} 个${itemMode === 'aliases' ? '兼容编码' : '标准项'}`
            }}</span
            ><span v-if="!selectedDict.allowNewItems" class="footer-hint"
              >系统固定选项，仅支持维护名称、排序与说明</span
            >
          </footer>
        </template>
        <el-empty v-else :description="catalogError ? '字典目录暂不可用' : '请选择数据字典'" />
      </section>
    </div>
    <el-dialog v-model="mergeDialog" title="合并字典项" width="min(560px, calc(100vw - 32px))">
      <p v-if="mergeSource">
        待合并：{{ mergeSource.dictionaryItemName }}（{{ mergeSource.dictionaryItemCode }}）
      </p>
      <el-form label-width="95px">
        <el-form-item label="保留标准项">
          <el-select v-model="mergeTargetId" filterable @change="loadMergePreview">
            <el-option
              v-for="item in mergeTargets"
              :key="item.id"
              :value="item.id"
              :label="`${item.dictionaryItemName}（${item.dictionaryItemCode}）`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合并原因"
          ><el-input v-model="mergeReason" type="textarea" maxlength="500"
        /></el-form-item>
      </el-form>
      <div v-loading="mergeLoading">
        <template v-if="mergePreview">
          <p>
            字典内引用：{{ mergePreview.childReferences }} 个下级条目、{{
              mergePreview.aliasReferences
            }}
            个兼容编码。
          </p>
          <el-alert
            v-for="blocker in mergePreview.blockers"
            :key="blocker"
            :title="blocker"
            type="warning"
            :closable="false"
          />
          <p>合并后保留旧编码的历史解析关系，业务记录不删除。</p>
        </template>
      </div>
      <template #footer
        ><el-button @click="mergeDialog = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="
            !mergePreview || mergeLoading || mergePreview.blockers.length > 0 || !mergeReason.trim()
          "
          @click="saveMerge"
          >确认合并</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="dictDialog"
      :title="editingDictId ? '修改字典' : '新增字典'"
      width="min(560px, calc(100vw - 32px))"
    >
      <el-form :model="dictForm" label-position="top">
        <el-form-item label="字典名称" required>
          <el-input v-model="dictForm.dictionaryName" placeholder="例如：商品单位" />
        </el-form-item>
        <el-form-item label="字典编码" required>
          <el-input
            v-model="dictForm.dictionaryCode"
            :disabled="!!editingDictId"
            placeholder="例如 PRODUCT_UNIT"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="dictForm.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDict">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="itemDialog"
      :title="editingItemId ? '修改字典项' : '新增字典项'"
      width="min(560px, calc(100vw - 32px))"
    >
      <el-form :model="itemForm" label-position="top">
        <el-form-item label="字典项名称" required>
          <el-input v-model="itemForm.dictionaryItemName" />
        </el-form-item>
        <el-form-item label="字典项编码" required>
          <el-input
            v-model="itemForm.dictionaryItemCode"
            :disabled="Boolean(editingItemId)"
            placeholder="例如 SALES"
          />
        </el-form-item>
        <el-form-item label="状态"
          ><el-switch
            v-model="itemForm.enabled"
            :disabled="!selectedDict?.allowNewItems"
            active-text="启用"
            inactive-text="停用"
        /></el-form-item>
        <el-form-item label="父级字典项">
          <el-select
            v-model="itemForm.parentDictionaryItemCode"
            :disabled="!selectedDict?.allowNewItems"
            clearable
            placeholder="不选择表示根节点"
            style="width: 100%"
          >
            <el-option
              v-for="item in parentOptions"
              :key="item.dictionaryItemCode"
              :label="`${'　'.repeat(Math.max(item.dictionaryItemLevel - 1, 0))}${item.dictionaryItemName}（${item.dictionaryItemCode}）`"
              :value="item.dictionaryItemCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.ordinal" :min="-99999" :max="99999" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="itemForm.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight, InfoFilled, Plus, Refresh, Search } from '@element-plus/icons-vue'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DictionarySourceMappings from './DictionarySourceMappings.vue'
import { refreshBusinessDictionaries } from '@/utils/business-dictionary'
import {
  previewBizDictMerge,
  mergeBizDictItem,
  type DictMergePreview,
  createBizDict,
  createBizDictItem,
  getBizDictItems,
  getBizDicts,
  updateBizDict,
  updateBizDictItem,
  type DictCommand,
  type DictItemCommand,
  type DictItemView,
  type DictView,
} from '@/api/core/business-settings'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

interface DictItemTree extends DictItemView {
  children?: DictItemTree[]
}

const DEFAULT_DICTIONARY_TYPE = 'COMMON'

const { can } = useSupplyPermissions()
const loading = ref(false)
const itemsLoading = ref(false)
const saving = ref(false)
const dictionaries = ref<DictView[]>([])
const catalogError = ref('')
const itemsError = ref('')
const directorySearch = ref('')
const itemSearch = ref('')
const filteredDictionaries = computed(() => {
  const query = directorySearch.value.trim().toLocaleLowerCase()
  return dictionaries.value.filter((row) =>
    `${row.dictionaryName} ${row.dictionaryCode}`.toLocaleLowerCase().includes(query),
  )
})
const matchedItems = computed(() => {
  const query = itemSearch.value.trim().toLocaleLowerCase()
  return visibleItems.value.filter((row) =>
    `${row.dictionaryItemName} ${row.dictionaryItemCode}`.toLocaleLowerCase().includes(query),
  )
})
const items = ref<DictItemView[]>([])
const itemMode = ref<'standard' | 'aliases' | 'sources'>('standard')
const standardItems = computed(() => items.value.filter((item) => !item.canonicalItemCode))
const visibleItems = computed(() =>
  items.value.filter((item) =>
    itemMode.value === 'aliases' ? !!item.canonicalItemCode : !item.canonicalItemCode,
  ),
)
const mergeDialog = ref(false),
  mergeLoading = ref(false)
const mergeSource = ref<DictItemView | null>(null)
const mergeTargetId = ref(''),
  mergeReason = ref('')
const mergePreview = ref<DictMergePreview | null>(null)
const mergeTargets = computed(() =>
  standardItems.value.filter(
    (item) =>
      item.id !== mergeSource.value?.id &&
      item.parentDictionaryItemCode === mergeSource.value?.parentDictionaryItemCode,
  ),
)
let mergeRequestVersion = 0
function openMerge(item: DictItemView) {
  ++mergeRequestVersion
  mergeSource.value = item
  mergeTargetId.value = ''
  mergeReason.value = ''
  mergePreview.value = null
  mergeLoading.value = false
  mergeDialog.value = true
}
async function loadMergePreview() {
  const version = ++mergeRequestVersion
  mergePreview.value = null
  if (!mergeSource.value || !mergeTargetId.value) return
  mergeLoading.value = true
  try {
    const result = await previewBizDictMerge(mergeSource.value.id, mergeTargetId.value)
    if (version === mergeRequestVersion) mergePreview.value = result
  } finally {
    if (version === mergeRequestVersion) mergeLoading.value = false
  }
}
async function saveMerge() {
  const preview = mergePreview.value
  if (!preview || preview.blockers.length || !mergeReason.value.trim()) return
  saving.value = true
  try {
    await mergeBizDictItem(preview.source.id, {
      targetItemId: preview.target.id,
      sourceRevision: preview.source.revision,
      targetRevision: preview.target.revision,
      reason: mergeReason.value.trim(),
    })
    mergeDialog.value = false
    ElMessage.success('字典项已合并')
    await loadDicts()
    await refreshBusinessDictionaries()
  } finally {
    saving.value = false
  }
}
const selectedDict = ref<DictView | null>(null)
const dictDialog = ref(false)
const itemDialog = ref(false)
const editingDictId = ref('')
const editingItemId = ref('')

const dictForm = reactive<DictCommand>({
  dictionaryCode: '',
  dictionaryName: '',
  dictionaryType: DEFAULT_DICTIONARY_TYPE,
  remark: null,
  revision: 0,
})

const itemForm = reactive<DictItemCommand>({
  dictionaryCode: '',
  parentDictionaryItemCode: null,
  dictionaryItemCode: '',
  dictionaryItemName: '',
  remark: null,
  ordinal: 0,
  enabled: true,
  revision: 0,
})

const canWrite = computed(() => can('business-settings:dict:write'))
const parentOptions = computed(() =>
  standardItems.value.filter((item) => item.id !== editingItemId.value),
)

const itemTree = computed<DictItemTree[]>(() => {
  if (itemSearch.value.trim()) return matchedItems.value
  const nodes = new Map<string, DictItemTree>()
  visibleItems.value.forEach((item) =>
    nodes.set(item.dictionaryItemCode, { ...item, children: [] }),
  )
  const roots: DictItemTree[] = []
  nodes.forEach((node) => {
    const parent = node.parentDictionaryItemCode ? nodes.get(node.parentDictionaryItemCode) : null
    if (parent) parent.children?.push(node)
    else roots.push(node)
  })
  const sortTree = (rows: DictItemTree[]) => {
    rows.sort(
      (a, b) => a.ordinal - b.ordinal || a.dictionaryItemCode.localeCompare(b.dictionaryItemCode),
    )
    rows.forEach((row) => sortTree(row.children || []))
  }
  sortTree(roots)
  return roots
})

async function loadDicts() {
  loading.value = true
  catalogError.value = ''
  try {
    dictionaries.value = await getBizDicts({ dictionaryCode: undefined })
    const selected =
      dictionaries.value.find((row) => row.id === selectedDict.value?.id) ||
      dictionaries.value[0] ||
      null
    await selectDict(selected)
  } catch (error) {
    dictionaries.value = []
    await selectDict(null)
    catalogError.value = error instanceof Error ? error.message : '字典目录加载失败，请重试'
  } finally {
    loading.value = false
  }
}

let selectionVersion = 0
async function selectDict(row: DictView | null) {
  const version = ++selectionVersion
  const changed = selectedDict.value?.id !== row?.id
  selectedDict.value = row
  items.value = []
  itemsError.value = ''
  itemsLoading.value = false
  if (changed) {
    itemMode.value = 'standard'
    itemSearch.value = ''
  }
  if (!row) return
  itemsLoading.value = true
  try {
    const result = await getBizDictItems(row.id)
    if (version === selectionVersion) items.value = result
  } catch (error) {
    if (version === selectionVersion)
      itemsError.value = error instanceof Error ? error.message : '字典项加载失败，请重试'
  } finally {
    if (version === selectionVersion) itemsLoading.value = false
  }
}

function openDict(row?: DictView) {
  editingDictId.value = row?.id || ''
  Object.assign(
    dictForm,
    row
      ? {
          dictionaryCode: row.dictionaryCode,
          dictionaryName: row.dictionaryName,
          dictionaryType: row.dictionaryType || DEFAULT_DICTIONARY_TYPE,
          remark: row.remark,
          revision: row.revision,
        }
      : {
          dictionaryCode: '',
          dictionaryName: '',
          dictionaryType: DEFAULT_DICTIONARY_TYPE,
          remark: null,
          revision: 0,
        },
  )
  dictDialog.value = true
}

async function saveDict() {
  if (!dictForm.dictionaryCode.trim() || !dictForm.dictionaryName.trim()) {
    ElMessage.warning('请填写字典编码和字典名称')
    return
  }
  saving.value = true
  try {
    const command: DictCommand = {
      dictionaryCode: dictForm.dictionaryCode.trim().toUpperCase(),
      dictionaryName: dictForm.dictionaryName.trim(),
      dictionaryType: dictForm.dictionaryType?.trim() || DEFAULT_DICTIONARY_TYPE,
      remark: empty(dictForm.remark) || null,
      revision: dictForm.revision,
    }
    if (editingDictId.value) await updateBizDict(editingDictId.value, command)
    else await createBizDict(command)
    ElMessage.success('字典保存成功')
    dictDialog.value = false
    await loadDicts()
  } finally {
    saving.value = false
  }
}

function openItem(row?: DictItemView) {
  if (!selectedDict.value) return
  editingItemId.value = row?.id || ''
  Object.assign(
    itemForm,
    row
      ? {
          dictionaryCode: row.dictionaryCode,
          parentDictionaryItemCode: row.parentDictionaryItemCode,
          dictionaryItemCode: row.dictionaryItemCode,
          dictionaryItemName: row.dictionaryItemName,
          remark: row.remark,
          ordinal: row.ordinal,
          enabled: row.enabled !== false,
          revision: row.revision,
        }
      : {
          dictionaryCode: selectedDict.value.dictionaryCode,
          parentDictionaryItemCode: null,
          dictionaryItemCode: '',
          dictionaryItemName: '',
          remark: null,
          ordinal: 0,
          enabled: true,
          revision: 0,
        },
  )
  itemDialog.value = true
}

async function saveItem() {
  if (!selectedDict.value) return
  if (!itemForm.dictionaryItemCode.trim() || !itemForm.dictionaryItemName.trim()) {
    ElMessage.warning('请填写字典项编码和字典项名称')
    return
  }
  saving.value = true
  try {
    const command: DictItemCommand = {
      dictionaryCode: selectedDict.value.dictionaryCode,
      parentDictionaryItemCode: empty(itemForm.parentDictionaryItemCode) || null,
      dictionaryItemCode: itemForm.dictionaryItemCode.trim().toUpperCase(),
      dictionaryItemName: itemForm.dictionaryItemName.trim(),
      remark: empty(itemForm.remark) || null,
      ordinal: itemForm.ordinal,
      enabled: itemForm.enabled !== false,
      revision: itemForm.revision,
    }
    if (editingItemId.value) await updateBizDictItem(editingItemId.value, command)
    else await createBizDictItem(selectedDict.value.id, command)
    ElMessage.success('字典项保存成功')
    itemDialog.value = false
    await loadDicts()
    await refreshBusinessDictionaries()
  } finally {
    saving.value = false
  }
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

onMounted(() => {
  void loadDicts()
})
</script>

<style scoped lang="scss" src="./master-data.scss"></style>
<style scoped lang="scss">
.dictionary-entry {
  min-height: 36px;
  align-items: center;
}
.dictionary-entry > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dictionary-identity,
.detail-title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}
.detail-code {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-small);
  overflow-wrap: anywhere;
}
.dictionary-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px 10px;
  flex: none;
  flex-wrap: wrap;
}
.dictionary-tabs {
  flex: 0 0 auto;
}
.dictionary-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.dictionary-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.dictionary-tabs :deep(.el-tabs__item) {
  height: 36px;
  font-size: var(--app-font-size-base);
  color: var(--app-text-primary);
  padding: 0 14px;
}
.dictionary-tabs :deep(.el-tabs__item.is-active) {
  color: var(--md-accent);
}
.dictionary-tabs :deep(.el-tabs__content) {
  display: none;
}
.dictionary-controls .detail-toolbar {
  padding: 0;
  margin-left: auto;
}
.dictionary-controls .el-input {
  width: 220px;
}
.item-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.item-status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: #059669;
  border-radius: 50%;
}
.item-status.is-disabled {
  color: var(--app-text-secondary);
}
.item-status.is-disabled::before {
  background: #606266;
}
.dictionary-mappings {
  padding: 0 12px;
  overflow: auto;
}
.detail-note {
  margin: 0;
  padding: 0 12px 10px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-small);
}
@media (max-width: 800px) {
  .dictionary-controls {
    gap: 8px;
  }
  .dictionary-controls .detail-toolbar {
    margin-left: 0;
    width: 100%;
  }
  .dictionary-controls .el-input {
    flex: 1;
    min-width: 140px;
  }
}
</style>
