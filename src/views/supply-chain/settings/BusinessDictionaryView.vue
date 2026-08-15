<template>
  <div class="dict-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>业务设置</span>
            <h1>业务字典</h1>
            <p>统一维护系统、业务模块和租户级字典；业务页面只使用服务端返回的编码与名称。</p>
          </div>
          <el-button v-if="canWrite" type="primary" @click="openDict()">新增字典</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="订货宝来源值由同步任务自动维护；业务人员只需核对来源值与业务显示名称的对应关系。"
      />

      <el-form class="filters" inline @submit.prevent="loadDicts">
        <el-form-item label="业务模块">
          <el-input v-model="filters.moduleCode" clearable placeholder="如 COMMON、ERP、CRM、ORDER" />
        </el-form-item>
        <el-form-item label="作用域">
          <el-select v-model="filters.scopeType" clearable placeholder="全部作用域" style="width: 150px">
            <el-option label="系统级" value="SYSTEM" />
            <el-option label="模块级" value="MODULE" />
            <el-option label="租户级" value="TENANT" />
          </el-select>
        </el-form-item>
        <el-form-item label="治理状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 140px">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadDicts">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <div class="workspace">
        <section class="dict-list">
          <div class="section-title">
            <strong>字典列表</strong>
            <span>共 {{ dictionaries.length }} 条</span>
          </div>
          <el-table
            v-loading="loading"
            :data="dictionaries"
            row-key="id"
            highlight-current-row
            @current-change="selectDict"
          >
            <el-table-column label="字典" min-width="210">
              <template #default="scope">
                <strong>{{ scope.row.name }}</strong>
                <div class="secondary">{{ scope.row.code }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="moduleCode" label="模块" width="100" />
            <el-table-column label="作用域" width="110">
              <template #default="scope">{{ scopeName(scope.row.scopeType) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
                  {{ governanceStatusName(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column v-if="canWrite" label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button v-if="canEditDict(scope.row)" link type="primary" @click.stop="openDict(scope.row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="item-list">
          <div class="section-title">
            <div>
              <strong>{{ selectedDict?.name || '字典项' }}</strong>
              <span v-if="selectedDict">{{ selectedDict.moduleCode }} · {{ selectedDict.code }}</span>
              <span v-if="isSourceDictionary">来源值自动同步，可维护业务显示名称</span>
            </div>
            <div class="item-actions">
              <el-checkbox v-if="selectedDict" v-model="showDisabledItems">显示停用项</el-checkbox>
              <el-button v-if="canAddSelectedItem" type="primary" plain @click="openItem()">
                新增字典项
              </el-button>
            </div>
          </div>
          <el-table
            v-if="selectedDict"
            v-loading="itemsLoading"
            :data="itemTree"
            row-key="id"
            default-expand-all
            :tree-props="{ children: 'children' }"
          >
            <el-table-column v-if="isSourceDictionary" prop="value" label="订货宝原值" min-width="150">
              <template #default="scope">{{ scope.row.value || '-' }}</template>
            </el-table-column>
            <el-table-column :label="isSourceDictionary ? '业务显示名称' : '名称'" min-width="190">
              <template #default="scope">
                <strong>{{ scope.row.name }}</strong>
                <div v-if="!isSourceDictionary" class="secondary">{{ scope.row.code }}</div>
              </template>
            </el-table-column>
            <el-table-column v-if="!isSourceDictionary" prop="value" label="业务值" min-width="120">
              <template #default="scope">{{ scope.row.value || '-' }}</template>
            </el-table-column>
            <el-table-column v-if="hasHierarchy" prop="levelNo" label="层级" width="72" align="center" />
            <el-table-column label="状态" width="88">
              <template #default="scope">
                {{ governanceStatusName(scope.row.status) }}
              </template>
            </el-table-column>
            <el-table-column v-if="canManageSelected" label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button link type="primary" @click="openItem(scope.row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="请先选择左侧字典" />
        </section>
      </div>
    </el-card>

    <el-dialog v-model="dictDialog" :title="editingDictId ? '修改字典' : '新增字典'" width="620px">
      <el-form label-width="100px">
        <el-form-item label="字典编码" required>
          <el-input v-model="dictForm.code" :disabled="!!editingDictId" placeholder="大写字母、数字和下划线" />
        </el-form-item>
        <el-form-item label="字典名称" required>
          <el-input v-model="dictForm.name" />
        </el-form-item>
        <el-form-item label="业务模块" required>
          <el-input v-model="dictForm.moduleCode" :disabled="!!editingDictId" placeholder="如 COMMON、ERP、CRM、ORDER" />
        </el-form-item>
        <el-form-item label="作用域" required>
          <el-select v-model="dictForm.scopeType" :disabled="!!editingDictId || !isPlatformActor" style="width: 100%">
            <el-option v-if="isPlatformActor" label="系统级" value="SYSTEM" />
            <el-option v-if="isPlatformActor" label="模块级" value="MODULE" />
            <el-option label="租户级" value="TENANT" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="dictForm.scopeType === 'TENANT' && isPlatformActor" label="租户ID" required>
          <el-input v-model="dictForm.tenantId" />
        </el-form-item>
        <el-form-item label="基础字典">
          <el-select
            v-model="dictForm.baseDictId"
            clearable
            :disabled="!!editingDictId || dictForm.scopeType !== 'TENANT'"
            placeholder="可选；选择后复制完整字典项树"
            style="width: 100%"
          >
            <el-option
              v-for="item in baseDictOptions"
              :key="item.id"
              :label="`${item.name}（${scopeName(item.scopeType)}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="治理状态" required>
          <el-select v-model="dictForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dictForm.sortNo" :min="-99999" :max="99999" />
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
      <el-form label-width="100px">
        <el-form-item v-if="isSourceDictionary" label="订货宝原值">
          <el-input :model-value="itemForm.value || '-'" disabled />
        </el-form-item>
        <el-form-item v-else label="字典项编码" required>
          <el-input v-model="itemForm.code" placeholder="大写字母、数字和下划线" />
        </el-form-item>
        <el-form-item :label="isSourceDictionary ? '业务显示名称' : '显示名称'" required>
          <el-input v-model="itemForm.name" />
        </el-form-item>
        <el-form-item v-if="!isSourceDictionary" label="父级">
          <el-select v-model="itemForm.parentId" clearable placeholder="不选择表示根节点" style="width: 100%">
            <el-option
              v-for="item in parentOptions"
              :key="item.id"
              :label="`${'　'.repeat(Math.max(item.levelNo - 1, 0))}${item.name}（${item.code}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isSourceDictionary" label="业务值">
          <el-input v-model="itemForm.value" maxlength="255" />
        </el-form-item>
        <el-form-item label="治理状态" required>
          <el-select v-model="itemForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sortNo" :min="-99999" :max="99999" />
        </el-form-item>
        <el-form-item v-if="!isSourceDictionary" label="扩展JSON">
          <el-input v-model="itemForm.extraJson" type="textarea" :rows="4" placeholder='例如 {"color":"success"}' />
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
  type BizDict,
  type BizDictCommand,
  type BizDictItem,
  type BizDictItemCommand,
  type DictScopeType,
  type DictStatus,
} from '@/api/core/business-settings'
import { useAuthStore } from '@/stores/auth'

interface DictItemTree extends BizDictItem { children?: DictItemTree[] }

const auth = useAuthStore()
const loading = ref(false)
const itemsLoading = ref(false)
const saving = ref(false)
const dictionaries = ref<BizDict[]>([])
const items = ref<BizDictItem[]>([])
const selectedDict = ref<BizDict | null>(null)
const dictDialog = ref(false)
const itemDialog = ref(false)
const editingDictId = ref('')
const editingItemId = ref('')
const showDisabledItems = ref(false)

const filters = reactive<{ moduleCode: string; scopeType: DictScopeType | ''; status: DictStatus | '' }>({
  moduleCode: '', scopeType: '', status: 'ACTIVE',
})

const dictForm = reactive<BizDictCommand>({
  code: '', name: '', scopeType: 'TENANT', moduleCode: 'COMMON', tenantId: null,
  baseDictId: null, status: 'ACTIVE', sortNo: 0, remark: null, version: 0,
})

const itemForm = reactive<BizDictItemCommand>({
  dictId: '', parentId: null, code: '', name: '', value: null,
  sortNo: 0, status: 'ACTIVE', extraJson: null, version: 0,
})

const canWrite = computed(() => auth.hasPermission('business-settings:dict:write'))
const isPlatformActor = computed(() => auth.user?.principalScope === 'PLATFORM')
const canManageSelected = computed(() => selectedDict.value ? canEditDict(selectedDict.value) : false)
const isSourceDictionary = computed(() => selectedDict.value?.code.startsWith('DHB_') === true)
const canAddSelectedItem = computed(() => canManageSelected.value && !isSourceDictionary.value)
const hasHierarchy = computed(() => !isSourceDictionary.value
  && items.value.some((item) => item.parentId !== null || item.levelNo > 1))
const baseDictOptions = computed(() => dictionaries.value.filter((item) =>
  item.scopeType !== 'TENANT'
  && item.code === dictForm.code.trim().toUpperCase()
  && item.moduleCode === dictForm.moduleCode.trim().toUpperCase(),
))
const parentOptions = computed(() => items.value.filter((item) => item.id !== editingItemId.value))

const itemTree = computed<DictItemTree[]>(() => {
  const nodes = new Map<string, DictItemTree>()
  items.value
    .filter((item) => showDisabledItems.value || item.status === 'ACTIVE')
    .forEach((item) => nodes.set(item.id, { ...item, children: [] }))
  const roots: DictItemTree[] = []
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null
    if (parent) parent.children?.push(node)
    else roots.push(node)
  })
  const sortTree = (rows: DictItemTree[]) => {
    rows.sort((a, b) => a.sortNo - b.sortNo || a.code.localeCompare(b.code))
    rows.forEach((row) => sortTree(row.children || []))
  }
  sortTree(roots)
  return roots
})

function scopeName(scope: DictScopeType) {
  return scope === 'SYSTEM' ? '系统级' : scope === 'MODULE' ? '模块级' : '租户级'
}

function governanceStatusName(status: DictStatus) {
  return status === 'ACTIVE' ? '启用' : '停用'
}

function canEditDict(dictionary: BizDict) {
  if (!canWrite.value) return false
  if (isPlatformActor.value) return true
  return dictionary.scopeType === 'TENANT' && dictionary.tenantId === auth.user?.tenantId
}

async function loadDicts() {
  loading.value = true
  try {
    dictionaries.value = await getBizDicts({
      moduleCode: filters.moduleCode.trim() || undefined,
      scopeType: filters.scopeType,
      status: filters.status,
    })
    if (selectedDict.value) {
      const refreshed = dictionaries.value.find((item) => item.id === selectedDict.value?.id)
      if (refreshed) selectedDict.value = refreshed
      else { selectedDict.value = null; items.value = [] }
    }
  } finally {
    loading.value = false
  }
}

async function selectDict(row: BizDict | null) {
  selectedDict.value = row
  items.value = []
  showDisabledItems.value = false
  if (!row) return
  itemsLoading.value = true
  try { items.value = await getBizDictItems(row.id) }
  finally { itemsLoading.value = false }
}

function resetFilters() {
  Object.assign(filters, { moduleCode: '', scopeType: '', status: 'ACTIVE' })
  void loadDicts()
}

function openDict(row?: BizDict) {
  if (row && !canEditDict(row)) return
  editingDictId.value = row?.id || ''
  Object.assign(dictForm, row ? {
    code: row.code, name: row.name, scopeType: row.scopeType, moduleCode: row.moduleCode,
    tenantId: row.tenantId, baseDictId: row.baseDictId, status: row.status,
    sortNo: row.sortNo, remark: row.remark, version: row.version,
  } : {
    code: '', name: '', scopeType: isPlatformActor.value ? 'MODULE' : 'TENANT',
    moduleCode: 'COMMON', tenantId: null, baseDictId: null, status: 'ACTIVE',
    sortNo: 0, remark: null, version: 0,
  })
  dictDialog.value = true
}

async function saveDict() {
  if (!dictForm.code.trim() || !dictForm.name.trim() || !dictForm.moduleCode.trim()) {
    ElMessage.warning('请填写字典编码、名称和业务模块')
    return
  }
  saving.value = true
  try {
    const command: BizDictCommand = {
      ...dictForm,
      code: dictForm.code.trim().toUpperCase(),
      name: dictForm.name.trim(),
      moduleCode: dictForm.moduleCode.trim().toUpperCase(),
      tenantId: dictForm.tenantId?.trim() || null,
      remark: dictForm.remark?.trim() || null,
    }
    if (editingDictId.value) await updateBizDict(editingDictId.value, command)
    else await createBizDict(command)
    ElMessage.success('字典保存成功')
    dictDialog.value = false
    await loadDicts()
  } finally { saving.value = false }
}

function openItem(row?: BizDictItem) {
  if (!selectedDict.value || !canManageSelected.value) return
  if (!row && isSourceDictionary.value) return
  editingItemId.value = row?.id || ''
  Object.assign(itemForm, row ? {
    dictId: row.dictId, parentId: row.parentId, code: row.code, name: row.name,
    value: row.value, sortNo: row.sortNo, status: row.status,
    extraJson: row.extraJson, version: row.version,
  } : {
    dictId: selectedDict.value.id, parentId: null, code: '', name: '', value: null,
    sortNo: 0, status: 'ACTIVE', extraJson: null, version: 0,
  })
  itemDialog.value = true
}

async function saveItem() {
  if (!selectedDict.value || !itemForm.code.trim() || !itemForm.name.trim()) {
    ElMessage.warning('请填写字典项编码和显示名称')
    return
  }
  if (itemForm.extraJson?.trim()) {
    try { JSON.parse(itemForm.extraJson) }
    catch { ElMessage.warning('扩展JSON格式不正确'); return }
  }
  saving.value = true
  try {
    const command: BizDictItemCommand = {
      ...itemForm,
      dictId: selectedDict.value.id,
      code: itemForm.code.trim().toUpperCase(),
      name: itemForm.name.trim(),
      value: itemForm.value?.trim() || null,
      extraJson: itemForm.extraJson?.trim() || null,
    }
    if (editingItemId.value) await updateBizDictItem(editingItemId.value, command)
    else await createBizDictItem(selectedDict.value.id, command)
    ElMessage.success('字典项保存成功')
    itemDialog.value = false
    await selectDict(selectedDict.value)
  } finally { saving.value = false }
}

onMounted(() => { void loadDicts() })
</script>

<style scoped lang="scss">
.dict-page { min-width: 0; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.page-header span { color: #64748b; font-size: 13px; }
.page-header h1 { margin: 4px 0; font-size: 24px; color: #0f172a; }
.page-header p { margin: 0; color: #64748b; }
.filters { margin: 20px 0 8px; }
.workspace { display: grid; grid-template-columns: minmax(440px, 0.9fr) minmax(520px, 1.1fr); gap: 16px; }
.dict-list, .item-list { min-width: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.section-title { min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.section-title > div { display: flex; flex-direction: column; gap: 2px; }
.section-title > .item-actions { flex-direction: row; align-items: center; gap: 12px; }
.section-title span, .secondary { color: #64748b; font-size: 12px; }
@media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
</style>
