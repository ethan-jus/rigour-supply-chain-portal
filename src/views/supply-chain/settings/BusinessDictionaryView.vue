<template>
  <div class="dict-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">数据字典 · 基础设置</span>
        <h1>数据字典</h1>
        <p>维护业务使用的单位、类型、状态和支付方式。</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="canWrite" type="primary" @click="openDict()">新增字典</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadDicts">
        <el-form-item label="字典编码">
          <el-input v-model="filters.dictionaryCode" clearable placeholder="输入字典编码" style="width: 260px" />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>数据字典列表</h2>
          <span class="result-count"><strong>{{ dictionaries.length }}</strong> 条</span>
        </div>
      </div>
    </div>

    <el-card class="list-card dictionary-list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          v-loading="loading"
          class="business-table dictionary-overview-table supply-scroll-table"
          height="100%"
          :data="dictionaries"
          row-key="id"
          @row-click="openItemsDrawer"
        >
          <el-table-column label="字典编码" min-width="230" fixed="left" show-overflow-tooltip>
            <template #default="scope">
              <span class="dictionary-code">{{ scope.row.dictionaryCode }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="dictionaryName" label="字典名称" min-width="220" show-overflow-tooltip />
          <el-table-column label="字典项汇总" min-width="520" show-overflow-tooltip>
            <template #default="scope">
              <strong>{{ scope.row.dictionaryName }}：</strong>{{ dictionaryItemSummary(scope.row) }}
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="说明" min-width="220" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column label="字典项" width="100" align="center">
            <template #default="scope">{{ dictionaryItems(scope.row).length }}</template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openItemsDrawer(scope.row)">字典项</el-button>
              <el-button v-if="canWrite" link type="primary" @click.stop="openDict(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无数据字典" /></template>
        </el-table>
      </div>
    </el-card>

    <el-drawer v-model="itemDrawerVisible" class="dictionary-item-drawer" size="min(900px, 92vw)" :with-header="false">
      <div v-if="selectedDict" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>字典项</span>
            <h2>{{ selectedDict.dictionaryName }}</h2>
            <p>{{ selectedDict.dictionaryCode }}</p>
          </div>
          <el-button circle plain aria-label="关闭字典项" @click="itemDrawerVisible = false">×</el-button>
        </header>

        <div class="drawer-toolbar">
          <span>共 {{ items.length }} 个字典项</span>
          <el-button v-if="canWrite" type="primary" plain @click="openItem()">新增字典项</el-button>
        </div>

        <el-table
          v-loading="itemsLoading"
          class="supply-scroll-table detail-table"
          max-height="560"
          :data="itemTree"
          row-key="id"
          default-expand-all
          :tree-props="{ children: 'children' }"
        >
          <el-table-column prop="dictionaryItemCode" label="字典项编码" min-width="190" fixed="left" show-overflow-tooltip />
          <el-table-column prop="dictionaryItemName" label="字典项名称" min-width="190" show-overflow-tooltip />
          <el-table-column prop="parentDictionaryItemCode" label="父级编码" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.parentDictionaryItemCode || '-' }}</template>
          </el-table-column>
          <el-table-column prop="dictionaryItemLevel" label="层级" width="80" align="center" />
          <el-table-column prop="ordinal" label="排序" width="90" align="center" />
          <el-table-column prop="remark" label="说明" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="canWrite" label="操作" width="90" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click="openItem(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无字典项" /></template>
        </el-table>
      </div>
      <el-empty v-else description="请选择数据字典" />
    </el-drawer>

    <el-dialog v-model="dictDialog" :title="editingDictId ? '修改字典' : '新增字典'" width="620px">
      <el-form :model="dictForm" label-width="100px">
        <el-form-item label="字典名称" required>
          <el-input v-model="dictForm.dictionaryName" placeholder="例如：商品单位" />
        </el-form-item>
        <el-form-item label="字典编码" required>
          <el-input v-model="dictForm.dictionaryCode" :disabled="!!editingDictId" placeholder="例如 PRODUCT_UNIT" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="dictForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDict">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialog" :title="editingItemId ? '修改字典项' : '新增字典项'" width="620px">
      <el-form :model="itemForm" label-width="110px">
        <el-form-item label="字典项名称" required>
          <el-input v-model="itemForm.dictionaryItemName" />
        </el-form-item>
        <el-form-item label="字典项编码" required>
          <el-input v-model="itemForm.dictionaryItemCode" placeholder="例如 ON_SHELF" />
        </el-form-item>
        <el-form-item label="父级字典项">
          <el-select v-model="itemForm.parentDictionaryItemCode" clearable placeholder="不选择表示根节点" style="width: 100%">
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
          <el-input v-model="itemForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
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
import { useAuthStore } from '@/stores/auth'

interface DictItemTree extends DictItemView { children?: DictItemTree[] }

const DEFAULT_DICTIONARY_TYPE = 'COMMON'

const auth = useAuthStore()
const loading = ref(false)
const itemsLoading = ref(false)
const saving = ref(false)
const dictionaries = ref<DictView[]>([])
const dictionaryItemsMap = ref<Record<string, DictItemView[]>>({})
const items = ref<DictItemView[]>([])
const selectedDict = ref<DictView | null>(null)
const dictDialog = ref(false)
const itemDialog = ref(false)
const itemDrawerVisible = ref(false)
const editingDictId = ref('')
const editingItemId = ref('')

const filters = reactive({
  dictionaryCode: '',
})

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
  revision: 0,
})

const canWrite = computed(() => auth.hasPermission('business-settings:dict:write'))
const parentOptions = computed(() => items.value.filter((item) => item.id !== editingItemId.value))

const itemTree = computed<DictItemTree[]>(() => {
  const nodes = new Map<string, DictItemTree>()
  items.value.forEach((item) => nodes.set(item.dictionaryItemCode, { ...item, children: [] }))
  const roots: DictItemTree[] = []
  nodes.forEach((node) => {
    const parent = node.parentDictionaryItemCode ? nodes.get(node.parentDictionaryItemCode) : null
    if (parent) parent.children?.push(node)
    else roots.push(node)
  })
  const sortTree = (rows: DictItemTree[]) => {
    rows.sort((a, b) => a.ordinal - b.ordinal || a.dictionaryItemCode.localeCompare(b.dictionaryItemCode))
    rows.forEach((row) => sortTree(row.children || []))
  }
  sortTree(roots)
  return roots
})

async function loadDicts() {
  loading.value = true
  try {
    dictionaries.value = await getBizDicts({
      dictionaryCode: empty(filters.dictionaryCode),
    })
    await loadDictionaryItemSummaries(dictionaries.value)
    if (selectedDict.value) {
      const refreshed = dictionaries.value.find((item) => item.id === selectedDict.value?.id)
      if (refreshed) selectedDict.value = refreshed
      else {
        selectedDict.value = null
        items.value = []
      }
    }
  } finally {
    loading.value = false
  }
}

async function loadDictionaryItemSummaries(rows: DictView[]) {
  const entries = await Promise.all(rows.map(async (dictionary) => {
    try {
      return [dictionary.id, await getBizDictItems(dictionary.id)] as const
    } catch {
      return [dictionary.id, []] as const
    }
  }))
  dictionaryItemsMap.value = Object.fromEntries(entries)
}

async function openItemsDrawer(row: DictView) {
  itemDrawerVisible.value = true
  await selectDict(row)
}

async function selectDict(row: DictView | null) {
  selectedDict.value = row
  items.value = []
  if (!row) return
  itemsLoading.value = true
  try {
    items.value = await getBizDictItems(row.id)
    dictionaryItemsMap.value = { ...dictionaryItemsMap.value, [row.id]: items.value }
  } finally {
    itemsLoading.value = false
  }
}

function dictionaryItems(dictionary: DictView) {
  return (dictionaryItemsMap.value[dictionary.id] || [])
    .sort((a, b) => a.ordinal - b.ordinal || a.dictionaryItemCode.localeCompare(b.dictionaryItemCode))
}

function dictionaryItemSummary(dictionary: DictView) {
  const names = dictionaryItems(dictionary)
    .map((item) => item.dictionaryItemName)
    .filter(Boolean)
  return names.length ? names.join('、') : '暂无字典项'
}

function resetFilters() {
  filters.dictionaryCode = ''
  void loadDicts()
}

function openDict(row?: DictView) {
  editingDictId.value = row?.id || ''
  Object.assign(dictForm, row ? {
    dictionaryCode: row.dictionaryCode,
    dictionaryName: row.dictionaryName,
    dictionaryType: row.dictionaryType || DEFAULT_DICTIONARY_TYPE,
    remark: row.remark,
    revision: row.revision,
  } : {
    dictionaryCode: '',
    dictionaryName: '',
    dictionaryType: DEFAULT_DICTIONARY_TYPE,
    remark: null,
    revision: 0,
  })
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
  Object.assign(itemForm, row ? {
    dictionaryCode: row.dictionaryCode,
    parentDictionaryItemCode: row.parentDictionaryItemCode,
    dictionaryItemCode: row.dictionaryItemCode,
    dictionaryItemName: row.dictionaryItemName,
    remark: row.remark,
    ordinal: row.ordinal,
    revision: row.revision,
  } : {
    dictionaryCode: selectedDict.value.dictionaryCode,
    parentDictionaryItemCode: null,
    dictionaryItemCode: '',
    dictionaryItemName: '',
    remark: null,
    ordinal: 0,
    revision: 0,
  })
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
      revision: itemForm.revision,
    }
    if (editingItemId.value) await updateBizDictItem(editingItemId.value, command)
    else await createBizDictItem(selectedDict.value.id, command)
    ElMessage.success('字典项保存成功')
    itemDialog.value = false
    await selectDict(selectedDict.value)
  } finally {
    saving.value = false
  }
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

onMounted(() => { void loadDicts() })
</script>

<style scoped lang="scss">
.dict-page {
  min-width: 0;
}

.dictionary-list-card :deep(.el-table__row) {
  cursor: pointer;
}

.dictionary-code {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  border-radius: 8px;
  padding: 2px 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.drawer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #64748b;
}
</style>
