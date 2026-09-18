<template>
  <div
    class="settings-page supply-page supply-page--business-main menu-settings-page"
    v-loading="loading"
  >
    <el-card class="filter-card menu-query-card" shadow="never">
      <div class="menu-query">
        <el-input
          v-model="query.name"
          class="menu-query__input"
          clearable
          placeholder="菜单名称 / 权限标识"
          aria-label="菜单名称"
          @keyup.enter="applyQuery"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="query.type"
          class="menu-query__select"
          clearable
          placeholder="菜单类型"
          aria-label="菜单类型"
        >
          <el-option label="目录" value="MENU" />
          <el-option label="页面" value="PAGE" />
          <el-option label="按钮" value="BUTTON" />
        </el-select>
        <el-select
          v-model="query.status"
          class="menu-query__select is-compact"
          clearable
          placeholder="状态"
          aria-label="菜单状态"
        >
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
        <el-select
          v-model="query.visible"
          class="menu-query__select is-compact"
          clearable
          placeholder="显示状态"
          aria-label="显示状态"
        >
          <el-option label="侧栏显示" value="SHOWN" />
          <el-option label="侧栏隐藏" value="HIDDEN" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="applyQuery">查询</el-button>
        <el-button :icon="RefreshLeft" @click="resetQuery">重置</el-button>
      </div>
    </el-card>
    <el-card class="list-card menu-list-card" shadow="never">
      <div class="menu-list-head">
        <div class="menu-list-head__title">
          菜单结构
          <span class="menu-list-head__count" title="当前列表范围内的菜单节点数">
            共 <strong>{{ visibleCount }}</strong> 个节点
          </span>
        </div>
        <div class="menu-list-head__actions">
          <el-button
            class="menu-expand-toggle"
            :disabled="!expandableKeys.length"
            :aria-expanded="allExpanded"
            @click="toggleExpandAll"
          >
            {{ allExpanded ? '收起全部' : '展开全部' }}
            <el-icon :class="{ 'is-expanded': allExpanded }"><ArrowDown /></el-icon>
          </el-button>
          <el-button :icon="Refresh" @click="load">刷新</el-button>
          <el-button
            v-if="access.can('supply:menu:create')"
            type="primary"
            :icon="Plus"
            @click="openEditor()"
            >新增菜单</el-button
          >
        </div>
      </div>
      <div v-if="!access.context?.initialized" class="menu-empty-state">
        <el-alert
          title="请先在系统设置首页完成初始化。"
          type="info"
          :closable="false"
          show-icon
        />
      </div>
      <div v-else class="table-viewport">
        <el-table
          class="business-table supply-scroll-table menu-table"
          height="100%"
          :data="displayTree"
          row-key="id"
          :expand-row-keys="expandedKeys"
          @expand-change="handleExpandChange"
        >
          <el-table-column label="菜单名称" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="menu-name">
                <ConsoleNavIcon :icon-key="row.iconKey" />
                <span class="menu-name__text">{{ row.name }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="132">
            <template #default="{ row }">
              <span
                class="type-pill"
                :class="`is-${String(row.type).toLowerCase()}`"
                :title="labels[row.type as SupplyMenuNode['type']]"
              >
                <el-icon>
                  <component :is="typeIcons[row.type as SupplyMenuNode['type']]" />
                </el-icon>
                {{ labels[row.type as SupplyMenuNode['type']] }}
              </span>
              <span v-if="isCustomPage(row)" class="custom-flag">自定义</span>
            </template>
          </el-table-column>
          <el-table-column prop="sortOrder" label="排序" width="72" align="center" />
          <el-table-column label="显示状态" width="88" align="center">
            <template #default="{ row }">
              <span v-if="row.visible" class="display-cell">显示</span>
              <span v-else class="display-cell is-hidden">隐藏</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="92" align="center">
            <template #default="{ row }">
              <span class="status-cell" :class="{ 'is-off': row.status !== 'ACTIVE' }">
                <i class="status-cell__dot"></i>
                {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="路由地址" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <code v-if="row.routePath" class="route-path">{{ row.routePath }}</code>
              <span v-else class="cell-quiet">—</span>
            </template>
          </el-table-column>
          <el-table-column label="组件路径" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <code v-if="row.componentPath" class="route-path">{{ row.componentPath }}</code>
              <span v-else class="cell-quiet">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作权限" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <code v-if="row.permissionCode" class="permission-code">{{
                row.permissionCode
              }}</code>
              <span v-else class="cell-quiet">—</span>
            </template>
          </el-table-column>
          <!-- @vue-generic {SupplyMenuNode} -->
          <el-table-column label="操作" width="268" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  v-if="access.can('supply:menu:update')"
                  size="small"
                  :icon="Edit"
                  @click="openEditor(row)"
                  >编辑</el-button
                >
                <el-button
                  v-if="row.type !== 'BUTTON' && access.can('supply:menu:create')"
                  size="small"
                  :icon="Plus"
                  @click="openEditor(undefined, row)"
                  >增加子项</el-button
                >
                <el-button
                  v-if="!row.protectedNode && access.can('supply:menu:delete')"
                  size="small"
                  type="danger"
                  plain
                  :icon="Delete"
                  @click="remove(row)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <div class="menu-empty">
              <span class="menu-empty__title">{{
                queryActive ? '没有匹配的菜单' : '暂无菜单数据'
              }}</span>
              <span class="menu-empty__hint">{{
                queryActive ? '换一个查询条件，或点「重置」查看全部菜单' : '可点击右上角「新增菜单」创建'
              }}</span>
            </div>
          </template>
        </el-table>
      </div>
    </el-card>
    <el-dialog
      v-model="editing"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      class="menu-editor-dialog"
      width="min(760px, 94vw)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="menu-form-scroll">
        <el-form label-width="96px" @submit.prevent="save">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="上级菜单" :required="form.type === 'BUTTON'">
                <el-select
                  v-model="form.parentId"
                  :clearable="form.type !== 'BUTTON'"
                  filterable
                  placeholder="顶级目录"
                  style="width: 100%"
                >
                  <el-option
                    v-for="node in parents"
                    :key="node.id"
                    :label="node.name"
                    :value="node.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单类型" required>
                <el-radio-group v-model="form.type" :disabled="!!editingId" @change="typeChanged">
                  <el-radio-button value="MENU">目录</el-radio-button>
                  <el-radio-button value="PAGE">页面</el-radio-button>
                  <el-radio-button value="BUTTON">按钮</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单名称" required>
                <el-input v-model="form.name" maxlength="128" placeholder="请输入菜单名称" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单图标">
                <el-popover
                  v-model:visible="iconPickerOpen"
                  trigger="click"
                  placement="bottom-start"
                  :width="304"
                  popper-class="menu-icon-popover"
                  :show-arrow="false"
                >
                  <template #reference>
                    <div
                      class="icon-field"
                      :class="{ 'is-active': iconPickerOpen }"
                      role="button"
                      tabindex="0"
                      aria-label="选择菜单图标"
                      @keydown.enter.prevent="iconPickerOpen = !iconPickerOpen"
                    >
                      <template v-if="selectedIcon">
                        <el-icon class="icon-field__glyph">
                          <component :is="selectedIcon.component" />
                        </el-icon>
                        <span class="icon-field__label">{{ selectedIcon.label }}</span>
                        <el-icon class="icon-field__clear" title="清除图标" @click.stop="clearIcon">
                          <CircleClose />
                        </el-icon>
                      </template>
                      <span v-else class="icon-field__placeholder">选择内置图标</span>
                      <el-icon class="icon-field__arrow" :class="{ 'is-open': iconPickerOpen }">
                        <ArrowDown />
                      </el-icon>
                    </div>
                  </template>
                  <div class="icon-picker">
                    <el-input
                      v-model="iconKeyword"
                      class="icon-picker__search"
                      size="small"
                      clearable
                      placeholder="搜索图标名称"
                      @keydown.enter.prevent="pickFirstIcon"
                    >
                      <template #prefix><el-icon><Search /></el-icon></template>
                    </el-input>
                    <div class="icon-picker__grid">
                      <button
                        v-for="icon in filteredIcons"
                        :key="icon.key"
                        type="button"
                        class="icon-picker__item"
                        :class="{ 'is-selected': icon.key === form.iconKey }"
                        :title="icon.label + '（' + icon.key + '）'"
                        @click="chooseIcon(icon.key)"
                      >
                        <el-icon><component :is="icon.component" /></el-icon>
                        <span>{{ icon.label }}</span>
                      </button>
                    </div>
                    <div v-if="!filteredIcons.length" class="icon-picker__empty">
                      没有匹配的图标
                    </div>
                  </div>
                </el-popover>
              </el-form-item>
            </el-col>
            <el-col v-if="form.type === 'PAGE'" :span="24">
              <el-form-item label="页面来源" required>
                <el-radio-group v-model="pageSource" :disabled="!!editingId">
                  <el-radio-button value="BOUND">绑定已注册功能</el-radio-button>
                  <el-radio-button value="CUSTOM">自定义页面</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="usesBoundFeature" :span="24">
              <el-form-item label="绑定功能" required>
                <el-select
                  v-model="form.resourceId"
                  :disabled="!!editingId"
                  filterable
                  placeholder="选择已实现功能"
                  style="width: 100%"
                  @change="featureChanged"
                >
                  <el-option
                    v-for="feature in availableFeatures"
                    :key="feature.id"
                    :label="
                      feature.name + (feature.permissionCode ? ' · ' + feature.permissionCode : '')
                    "
                    :value="feature.resourceId!"
                  />
                  <template #empty><div class="feature-empty">{{ featureEmptyText }}</div></template>
                </el-select>
                <div v-if="!availableFeatures.length" class="field-hint">{{ featureEmptyText }}</div>
              </el-form-item>
            </el-col>
            <el-col
              v-if="usesBoundFeature && form.type === 'PAGE' && boundFeature"
              :span="24"
            >
              <el-form-item label="访问地址">
                <div class="feature-location">
                  <code>{{ boundFeature.routePath }}</code
                  ><small>由所选功能页面提供，菜单名称和层级可以独立调整。</small>
                </div>
              </el-form-item>
            </el-col>
            <el-col v-if="isCustomPageForm" :span="24">
              <el-form-item label="路由地址" required>
                <el-input
                  v-model="customRoutePath"
                  maxlength="255"
                  placeholder="/supply-chain/reports/custom-report"
                />
                <div class="field-hint">
                  菜单访问地址，需以 /supply-chain/ 开头；数据库中的 routeKey 由服务端生成。
                </div>
              </el-form-item>
            </el-col>
            <el-col v-if="isCustomPageForm" :span="24">
              <el-form-item label="组件路径" required>
                <el-select
                  v-model="customComponentPath"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="supply-chain/reports/CustomReportView.vue"
                  style="width: 100%"
                >
                  <el-option
                    v-for="view in registeredViews"
                    :key="view"
                    :label="view"
                    :value="view"
                  />
                </el-select>
                <div class="field-hint">组件路径对应代码仓库 src/views 下的页面文件。</div>
                <div v-if="customComponentMissing" class="field-warning">
                  该路径不在已编译页面清单中，保存前请从候选项选择，或确认文件位于 src/views 下。
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="显示排序">
                <el-input-number
                  v-model="form.sortOrder"
                  class="menu-sort-input"
                  :min="0"
                  :max="99999"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单状态">
                <el-radio-group v-model="form.status" :disabled="protectedNode">
                  <el-radio value="ACTIVE">启用</el-radio>
                  <el-radio value="DISABLED">停用</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="显示状态">
                <el-radio-group v-model="form.visible" :disabled="protectedNode">
                  <el-radio :value="true">显示</el-radio>
                  <el-radio :value="false">隐藏</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="showPermissionField" :span="12">
              <el-form-item label="权限标识">
                <el-input
                  v-if="isCustomPageForm"
                  v-model="customPermissionCode"
                  maxlength="128"
                  placeholder="可留空，例如 order:read"
                />
                <code v-else class="bound-permission">{{
                  boundFeature?.permissionCode || '—'
                }}</code>
                <div v-if="isCustomPageForm" class="field-hint">
                  角色能访问该页面仍需在「角色管理」中授权。
                </div>
              </el-form-item>
            </el-col>
            <el-col v-if="form.status === 'DISABLED'" :span="24">
              <el-alert
                class="menu-form-alert"
                type="warning"
                :closable="false"
                title="停用后，该菜单及其下级功能不可执行；已有角色配置保留。"
              />
            </el-col>
          </el-row>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="editing = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="save">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  CircleClose,
  Delete,
  Document,
  Edit,
  Folder,
  Plus,
  Pointer,
  Refresh,
  RefreshLeft,
  Search,
} from '@element-plus/icons-vue'
import ConsoleNavIcon from '@/components/console/ConsoleNavIcon.vue'
import {
  supplySettingsApi,
  type SupplyMenuCommand,
  type SupplyMenuNode,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { useNavigationStore } from '@/stores/navigation'
import { MENU_ICONS } from '@/utils/menu-icons'
import { isCustomPage, listRegisteredViews, resolveView } from '@/utils/dynamic-pages'
import {
  menuParentOptions,
  supplyMenuTree,
  type SupplyMenuTreeNode,
} from '@/utils/supply-menu-tree'

/** 与后端 saveMenu 校验保持一致：自定义页面的路由地址和组件路径格式。 */
const CUSTOM_ROUTE_PATH_PATTERN = /^\/supply-chain\/[A-Za-z0-9_\-/]+$/
const CUSTOM_COMPONENT_PATH_PATTERN = /^supply-chain\/[A-Za-z0-9_\-/]+\.vue$/

const access = useSupplyAuthorizationStore()
const navigation = useNavigationStore()
const nodes = ref<SupplyMenuNode[]>([]),
  catalog = ref<SupplyMenuNode[]>([])
const loading = ref(false),
  saving = ref(false),
  editing = ref(false)
/** 查询条件：面板上正在编辑的值，点「查询」后才写入 activeQuery 生效。 */
type MenuQuery = {
  name: string
  type: '' | SupplyMenuNode['type']
  status: '' | SupplyMenuNode['status']
  visible: '' | 'SHOWN' | 'HIDDEN'
}
const emptyQuery = (): MenuQuery => ({ name: '', type: '', status: '', visible: '' })
const query = reactive<MenuQuery>(emptyQuery())
const activeQuery = reactive<MenuQuery>(emptyQuery())
/** 树形表格的展开状态：进入页面默认全部收起，避免一次性铺开几百行子菜单。 */
const expandedKeys = ref<string[]>([])
const editingId = ref<string | null>(null),
  protectedNode = ref(false)
const pageSource = ref<'BOUND' | 'CUSTOM'>('BOUND')
/** 图标选择弹层：搜索关键字与开合状态，选中后立即收起。 */
const iconPickerOpen = ref(false)
const iconKeyword = ref('')
const registeredViews = listRegisteredViews()
const labels = { MENU: '目录', PAGE: '页面', BUTTON: '按钮' }
const typeIcons: Record<SupplyMenuNode['type'], typeof Folder> = {
  MENU: Folder,
  PAGE: Document,
  BUTTON: Pointer,
}
const empty = (): SupplyMenuCommand => ({
  parentId: null,
  type: 'MENU',
  resourceId: null,
  name: '',
  iconKey: 'Folder',
  sortOrder: 10,
  visible: true,
  status: 'ACTIVE',
  version: 0,
  routeKey: null,
  routePath: null,
  componentPath: null,
  permissionCode: null,
})
const form = reactive<SupplyMenuCommand>(empty())
const isCustomPageForm = computed(() => form.type === 'PAGE' && pageSource.value === 'CUSTOM')
const selectedIcon = computed(() => MENU_ICONS.find(icon => icon.key === form.iconKey))
const filteredIcons = computed(() => {
  const keyword = iconKeyword.value.trim().toLowerCase()
  if (!keyword) return MENU_ICONS
  return MENU_ICONS.filter(
    icon =>
      icon.label.toLowerCase().includes(keyword) || icon.key.toLowerCase().includes(keyword),
  )
})
const usesBoundFeature = computed(() => form.type === 'BUTTON'
  || (form.type === 'PAGE' && pageSource.value === 'BOUND'))
/** 绑定功能的权限标识由功能自带，自定义页面可手工填写，二者共用同一格位置。 */
const showPermissionField = computed(() => isCustomPageForm.value || usesBoundFeature.value)
const customRoutePath = computed({
  get: () => form.routePath ?? '',
  set: (value: string) => { form.routePath = value.trim() ? value : null },
})
const customComponentPath = computed({
  get: () => form.componentPath ?? '',
  set: (value: string) => { form.componentPath = value.trim() ? value : null },
})
const customPermissionCode = computed({
  get: () => form.permissionCode ?? '',
  set: (value: string) => { form.permissionCode = value.trim() ? value : null },
})
const customComponentMissing = computed(() => {
  const componentPath = form.componentPath?.trim()
  return Boolean(componentPath) && resolveView(componentPath) === null
})
const featureEmptyText = computed(() => form.type === 'BUTTON'
  ? '当前上级页面下已没有可绑定的操作权限。'
  : '已注册页面都已加入菜单，请把「页面来源」切换为「自定义页面」，直接填写路由地址和组件路径。')
const boundFeature = computed(() => form.resourceId
  ? catalog.value.find(node => node.resourceId === form.resourceId)
    ?? nodes.value.find(node => node.resourceId === form.resourceId)
  : undefined)
const parents = computed(() => menuParentOptions(nodes.value, editingId.value, form.type))
const availableFeatures = computed(() => {
  const used = new Set(nodes.value.filter((n) => n.id !== editingId.value).map((n) => n.resourceId))
  const parent = nodes.value.find((n) => n.id === form.parentId)
  return catalog.value.filter(
    (n) =>
      n.type === form.type &&
      !used.has(n.resourceId) &&
      (form.type !== 'BUTTON' || n.parentId === parent?.resourceId),
  )
})
const queryActive = computed(() =>
  Boolean(activeQuery.name || activeQuery.type || activeQuery.status || activeQuery.visible),
)
const displayTree = computed(() => {
  const tree = supplyMenuTree(nodes.value)
  if (!queryActive.value) return tree
  const key = activeQuery.name.toLowerCase()
  /** 命中子项时保留其上级，否则折叠后的树看不到命中的深层菜单。 */
  const matches = (item: SupplyMenuTreeNode) =>
    (!key ||
      item.name.toLowerCase().includes(key) ||
      (item.permissionCode ?? '').toLowerCase().includes(key)) &&
    (!activeQuery.type || item.type === activeQuery.type) &&
    (!activeQuery.status || item.status === activeQuery.status) &&
    (!activeQuery.visible ||
      (activeQuery.visible === 'SHOWN' ? item.visible : !item.visible))
  const filter = (items: SupplyMenuTreeNode[]): SupplyMenuTreeNode[] =>
    items.flatMap((item) => {
      const children = filter(item.children)
      return matches(item) || children.length ? [{ ...item, children }] : []
    })
  return filter(tree)
})
const countNodes = (items: SupplyMenuTreeNode[]): number =>
  items.reduce((total, item) => total + 1 + countNodes(item.children), 0)
const visibleCount = computed(() => countNodes(displayTree.value))
/** 当前展示范围内、确实有下级、可以被展开的节点。 */
const expandableKeys = computed(() => {
  const keys: string[] = []
  const walk = (items: SupplyMenuTreeNode[]) => {
    for (const item of items) {
      if (item.children.length) {
        keys.push(item.id)
        walk(item.children)
      }
    }
  }
  walk(displayTree.value)
  return keys
})
const allExpanded = computed(() => expandableKeys.value.length > 0
  && expandableKeys.value.every(id => expandedKeys.value.includes(id)))
function toggleExpandAll() {
  expandedKeys.value = allExpanded.value ? [] : [...expandableKeys.value]
}
function handleExpandChange(row: SupplyMenuTreeNode, expanded: boolean | SupplyMenuTreeNode[]) {
  // 树形表格只回传布尔值；兼容展开列的回传数组，避免误判。
  const nextExpanded = Array.isArray(expanded)
    ? expanded.some(item => item.id === row.id)
    : expanded
  const listed = expandedKeys.value.includes(row.id)
  if (nextExpanded && !listed) expandedKeys.value = [...expandedKeys.value, row.id]
  else if (!nextExpanded && listed) {
    expandedKeys.value = expandedKeys.value.filter(id => id !== row.id)
  }
}
/** 查询生效后展开命中层级，否则用户只能看到父级、看不到命中的子菜单。 */
function applyQuery() {
  Object.assign(activeQuery, { ...query, name: query.name.trim() })
  if (queryActive.value) expandedKeys.value = [...expandableKeys.value]
}
function resetQuery() {
  Object.assign(query, emptyQuery())
  Object.assign(activeQuery, emptyQuery())
  expandedKeys.value = []
}
async function load() {
  loading.value = true
  try {
    await access.refresh()
    if (access.context?.initialized)
      [nodes.value, catalog.value] = await Promise.all([
        supplySettingsApi.menus(),
        supplySettingsApi.catalog(),
      ])
  } finally {
    loading.value = false
  }
}
function openEditor(node?: SupplyMenuNode, parent?: SupplyMenuNode) {
  editingId.value = node?.id || null
  protectedNode.value = node?.protectedNode || false
  pageSource.value = node && isCustomPage(node) ? 'CUSTOM' : 'BOUND'
  iconPickerOpen.value = false
  iconKeyword.value = ''
  Object.assign(
    form,
    empty(),
    node
      ? {
          parentId: node.parentId,
          type: node.type,
          resourceId: node.resourceId,
          name: node.name,
          iconKey: node.iconKey,
          sortOrder: node.sortOrder,
          visible: node.visible,
          status: node.status,
          version: node.version,
          routeKey: node.routeKey,
          routePath: node.routePath,
          componentPath: node.componentPath,
          permissionCode: node.permissionCode,
        }
      : {},
  )
  if (parent) {
    form.parentId = parent.id
    form.type = parent.type === 'PAGE' ? 'BUTTON' : 'MENU'
  }
  editing.value = true
}
function typeChanged() {
  form.resourceId = null
  if (!parents.value.some((n) => n.id === form.parentId)) form.parentId = null
}
function chooseIcon(key: string) {
  form.iconKey = key
  iconPickerOpen.value = false
  iconKeyword.value = ''
}
function clearIcon() {
  form.iconKey = null
  iconKeyword.value = ''
}
function pickFirstIcon() {
  const [first] = filteredIcons.value
  if (first) chooseIcon(first.key)
}
function featureChanged() {
  const feature = catalog.value.find((n) => n.resourceId === form.resourceId)
  if (feature) {
    form.name = feature.name
    form.iconKey = feature.iconKey
    form.sortOrder = feature.sortOrder
  }
}
async function refreshNavigation() {
  await access.refresh()
  navigation.invalidate('SUPPLY_CHAIN')
  await navigation.fetchNavigation('SUPPLY_CHAIN')
}
async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写菜单名称')
    return
  }
  if (usesBoundFeature.value && !form.resourceId) {
    ElMessage.warning(form.type === 'BUTTON'
      ? '请选择已注册功能的操作权限'
      : '请选择已注册功能，或把「页面来源」切换为「自定义页面」')
    return
  }
  let routePath: string | null = null
  let componentPath: string | null = null
  let permissionCode: string | null = null
  if (isCustomPageForm.value) {
    routePath = form.routePath?.trim() || null
    componentPath = form.componentPath?.trim() || null
    permissionCode = form.permissionCode?.trim() || null
    if (!routePath || !CUSTOM_ROUTE_PATH_PATTERN.test(routePath)) {
      ElMessage.warning('路由地址需以 /supply-chain/ 开头，例如 /supply-chain/reports/custom-report')
      return
    }
    if (!componentPath || !CUSTOM_COMPONENT_PATH_PATTERN.test(componentPath)) {
      ElMessage.warning('组件路径需形如 supply-chain/xxx/YyyView.vue')
      return
    }
    if (resolveView(componentPath) === null) {
      ElMessage.warning('该组件路径不在已编译页面清单中，请从候选项选择，或确认文件位于 src/views 下')
      return
    }
  }
  saving.value = true
  try {
    await supplySettingsApi.saveMenu(editingId.value, {
      ...form,
      parentId: form.parentId || null,
      iconKey: form.iconKey || null,
      name: form.name.trim(),
      resourceId: usesBoundFeature.value ? form.resourceId : null,
      routeKey: isCustomPageForm.value ? form.routeKey : null,
      routePath,
      componentPath,
      permissionCode,
    })
    editing.value = false
    await load()
    await refreshNavigation()
    ElMessage.success('菜单已保存')
  } finally {
    saving.value = false
  }
}
async function remove(node: SupplyMenuNode) {
  const impact = await supplySettingsApi.menuImpact(node.id)
  if (impact.childCount) {
    ElMessage.warning('请先移动或删除该菜单的子项')
    return
  }
  try {
    await ElMessageBox.confirm(
      '删除“' +
        node.name +
        '”？将撤销 ' +
        impact.roleNames.length +
        ' 个角色的关联授权，影响 ' +
        impact.userCount +
        ' 名用户。重新添加不会恢复授权。',
      '删除菜单',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await supplySettingsApi.deleteMenu(node.id, impact.version, true)
  await load()
  await refreshNavigation()
  ElMessage.success('菜单已删除')
}
onMounted(load)
</script>

<style scoped>
/* 页面骨架来自 supply-page--business-main：工具栏与表头固定，只有表格区滚动。 */
.menu-settings-page {
  min-height: 0;
}

/* 骨架默认把查询区和列表拼成一张卡，这里还原圆角并留出间隔。 */
.menu-settings-page > .filter-card,
.menu-settings-page > .list-card {
  border-radius: var(--supply-radius);
}

.menu-settings-page > .filter-card {
  margin-bottom: 10px;
  border-bottom: 1px solid var(--supply-border);
}

.menu-settings-page > .menu-query-card :deep(.el-card__body) {
  padding: 12px;
}

.menu-query {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.menu-query :deep(.el-button + .el-button) {
  margin-left: 0;
}

.menu-query__input {
  width: 240px;
}

.menu-query__select {
  width: 128px;
}

.menu-query__select.is-compact {
  width: 118px;
}

.menu-list-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--supply-border);
}

.menu-list-head__title {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  color: var(--supply-text);
  font-size: 15px;
  font-weight: 700;
}

.menu-list-head__count {
  color: var(--supply-text-muted);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}

.menu-list-head__count strong {
  color: var(--supply-text);
  font-weight: 700;
}

.menu-list-head__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.menu-list-head__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.menu-expand-toggle :deep(.el-icon) {
  margin-left: 4px;
  transition: transform 0.18s ease;
}

.menu-expand-toggle :deep(.el-icon.is-expanded) {
  transform: rotate(180deg);
}

.menu-list-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.menu-empty-state {
  padding: 16px;
}

/* 全局 .supply-scroll-table 表头规则同为 3 类 1 元素，这里必须多一层选择器才能生效。 */
.menu-table :deep(.el-table__header-wrapper th.el-table__cell),
.menu-table :deep(.el-table__fixed-header-wrapper th.el-table__cell) {
  height: 44px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.menu-table :deep(.el-table__row > td.el-table__cell) {
  padding: 9px 0;
}

.menu-table :deep(.el-table__expand-icon) {
  color: #7c8798;
}

.menu-name {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.menu-name__text {
  overflow: hidden;
  color: var(--supply-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-code {
  display: inline-block;
  overflow: hidden;
  max-width: 100%;
  padding: 1px 6px;
  border: 1px solid var(--supply-border);
  border-radius: 4px;
  background: var(--supply-surface-subtle);
  color: #4a5568;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

/* 类型列：颜色 + 图标双重区分，目录/页面/按钮一眼可辨。 */
.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.type-pill .el-icon {
  font-size: 13px;
}

.type-pill.is-menu {
  border-color: #c7d9fb;
  background: #eef4ff;
  color: #1f57c3;
}

.type-pill.is-page {
  border-color: #b9e6cd;
  background: #eefaf3;
  color: #157347;
}

.type-pill.is-button {
  border-color: #f5d8a8;
  background: #fff7e8;
  color: #a9651b;
}

.custom-flag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}

.route-path {
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.display-cell {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  line-height: 1;
}

.display-cell.is-hidden {
  background: #fff4e0;
  color: #a9651b;
}

.row-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.row-actions :deep(.el-button) {
  padding: 5px 10px;
  font-weight: 500;
}

.cell-quiet {
  color: var(--supply-text-muted);
}

.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1d7b4d;
  font-size: 13px;
}

.status-cell__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
  box-shadow: 0 0 0 3px rgb(29 123 77 / 12%);
}

.status-cell.is-off {
  color: var(--supply-text-muted);
}

.status-cell.is-off .status-cell__dot {
  box-shadow: 0 0 0 3px rgb(148 163 184 / 14%);
}

.menu-empty {
  display: grid;
  gap: 6px;
  padding: 30px 0;
  place-items: center;
}

.menu-empty__title {
  color: var(--supply-text);
  font-size: 14px;
  font-weight: 600;
}

.menu-empty__hint {
  color: var(--supply-text-muted);
  font-size: 12px;
}

.menu-form-scroll {
  max-height: min(66vh, 620px);
  padding-right: 6px;
  overflow-y: auto;
}

.menu-form-scroll :deep(.el-form-item) {
  margin-bottom: 18px;
}

.menu-form-scroll :deep(.el-form-item__label) {
  color: #4b5563;
  font-weight: 500;
}

.menu-form-scroll :deep(.el-form-item:last-of-type) {
  margin-bottom: 6px;
}

/* 以下为编辑弹窗内的表单辅助样式。 */
.feature-location { display: grid; gap: 4px; overflow-wrap: anywhere; }
.feature-location small { color: #64748b; line-height: 1.6; }
.field-hint,
.field-warning,
.feature-empty {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
}
.field-hint,
.feature-empty { color: #64748b; }
.field-warning { color: #b45309; }

/* 图标选择：收起后是输入框样式，展开后是图标网格弹层。 */
.icon-field {
  display: flex;
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.icon-field:hover {
  border-color: var(--el-border-color-hover);
}

.icon-field.is-active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.icon-field__glyph {
  color: #475569;
  font-size: 15px;
}

.icon-field__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-field__placeholder {
  color: var(--el-text-color-placeholder);
}

.icon-field__clear {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.icon-field__clear:hover {
  color: var(--el-color-danger);
}

.icon-field__arrow {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  transition: transform 0.2s ease;
}

.icon-field__arrow.is-open {
  transform: rotate(180deg);
}

.menu-sort-input {
  width: 100%;
}

.bound-permission {
  display: inline-block;
  overflow: hidden;
  max-width: 100%;
  padding: 1px 6px;
  border: 1px solid var(--supply-border);
  border-radius: 4px;
  background: var(--supply-surface-subtle);
  color: #4a5568;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.menu-form-alert {
  margin-bottom: 6px;
}
</style>

<style>
/* 弹窗与图标弹层被 Element Plus 传送到 body，作用域样式命中不到，这里用专属类名收敛影响范围。 */
.menu-editor-dialog {
  overflow: hidden;
  border-radius: 10px;
}

.menu-editor-dialog .el-dialog__header {
  margin: 0;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.menu-editor-dialog .el-dialog__title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.menu-editor-dialog .el-dialog__body {
  padding: 20px 24px 4px;
}

.menu-editor-dialog .el-dialog__footer {
  padding: 14px 24px 18px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.menu-editor-dialog .el-dialog__footer .el-button {
  min-width: 78px;
  margin-left: 10px;
}

.menu-icon-popover.el-popper {
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 14%);
}

.menu-icon-popover .icon-picker {
  display: grid;
  gap: 10px;
}

.menu-icon-popover .icon-picker__grid {
  display: grid;
  max-height: 236px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding-right: 2px;
  overflow-y: auto;
}

.menu-icon-popover .icon-picker__item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.menu-icon-popover .icon-picker__item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.menu-icon-popover .icon-picker__item.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.menu-icon-popover .icon-picker__item .el-icon {
  flex: 0 0 auto;
  font-size: 15px;
}

.menu-icon-popover .icon-picker__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-icon-popover .icon-picker__empty {
  padding: 18px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
