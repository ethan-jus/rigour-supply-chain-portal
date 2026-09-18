<template>
  <section class="supply-page department-page" v-loading="loading">
    <header class="page-heading">
      <div>
        <SupplyPageTitle>部门管理</SupplyPageTitle>
        <p>维护部门和上下级关系，新增员工时可选择所属部门。</p>
      </div>
      <el-button v-if="can('hr:department:create')" type="primary" @click="edit()"
        >新增部门</el-button
      >
    </header>
    <div class="department-toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索部门名称或编码"
        aria-label="搜索部门"
        class="department-search"
      />
      <el-button :disabled="!rows.length" @click="expandAll">展开全部</el-button>
      <el-button :disabled="!rows.length" @click="collapseAll">收起全部</el-button>
      <el-button :loading="loading" @click="load()">刷新</el-button>
      <span class="department-count">共 {{ rows.length }} 个部门</span>
    </div>
    <el-alert
      v-if="loadError"
      class="department-alert"
      type="error"
      :title="loadError"
      :closable="false"
      show-icon
    />
    <div class="department-tree-panel">
      <el-empty
        v-if="!loading && !rows.length && !loadError"
        description="还没有部门，请先创建顶级部门"
      >
        <el-button v-if="can('hr:department:create')" type="primary" @click="edit()"
          >创建第一个部门</el-button
        >
      </el-empty>
      <el-table
        v-else
        ref="table"
        :data="tree"
        row-key="id"
        :expand-row-keys="effectiveExpandedKeys"
        :indent="28"
        highlight-current-row
        :empty-text="loadError ? '部门加载失败，请点击刷新重试' : '没有匹配的部门'"
        @expand-change="expansionChanged"
      >
        <el-table-column label="部门名称" min-width="280" fixed="left">
          <template #default="{ row }">
            <span class="department-name"
              ><el-icon><OfficeBuilding /></el-icon>{{ row.departmentName }}</span
            >
            <span v-if="row.children.length" class="department-children"
              >{{ row.children.length }} 个直属下级</span
            >
          </template>
        </el-table-column>
        <el-table-column prop="departmentCode" label="部门编码" min-width="210" />
        <el-table-column prop="sortOrder" label="显示顺序" width="100" />
        <el-table-column label="负责人" min-width="110" show-overflow-tooltip
          ><template #default="{ row }">{{ row.leaderName || '—' }}</template></el-table-column
        >
        <el-table-column label="联系电话" min-width="150" show-overflow-tooltip
          ><template #default="{ row }">{{ row.contactPhone || '—' }}</template></el-table-column
        >
        <el-table-column label="设立日期" width="120"
          ><template #default="{ row }">{{ row.establishedDate || '—' }}</template></el-table-column
        >
        <el-table-column label="状态" width="90">
          <template #default="{ row }"
            ><el-tag :type="row.statusCode === 'ACTIVE' ? 'success' : 'info'">{{
              row.statusCode === 'ACTIVE' ? '正常' : '停用'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="创建时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.createdTime)
          }}</template></el-table-column
        >
        <el-table-column label="创建人" min-width="140" show-overflow-tooltip
          ><template #default="{ row }"
            ><span>{{
              actorLabel(row.createdByName, row.createdBy)
            }}</span></template
          ></el-table-column
        >
        <el-table-column label="修改时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.updatedTime)
          }}</template></el-table-column
        >
        <el-table-column label="修改人" min-width="140" show-overflow-tooltip
          ><template #default="{ row }"
            ><span>{{
              actorLabel(row.updatedByName, row.updatedBy)
            }}</span></template
          ></el-table-column
        >
        <!-- @vue-generic {DepartmentNode} -->
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="can('hr:department:create')"
              link
              type="primary"
              :disabled="row.statusCode !== 'ACTIVE'"
              @click="edit(undefined, row.id)"
              >新增子部门</el-button
            >
            <el-button v-if="can('hr:department:update')" link type="primary" @click="edit(row)"
              >编辑</el-button
            >
            <el-button v-if="can('hr:department:delete')" link type="danger" @click="remove(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>
    <p class="department-help">
      排序值越小越靠前。同级部门通过“编辑”调整排序；更换上级部门可调整层级。
    </p>
    <el-dialog
      v-model="visible"
      :title="editing !== null ? '编辑部门' : form.parentId !== null ? '新增子部门' : '新增部门'"
      width="min(700px, calc(100vw - 32px))"
      align-center
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      class="department-dialog"
    >
      <el-form label-width="88px" :disabled="saving" @submit.prevent="save">
        <el-form-item label="上级部门">
          <el-tree-select
            v-model="form.parentId"
            :data="parents"
            node-key="id"
            :props="{ label: 'departmentName', children: 'children', disabled: 'disabled' }"
            check-strictly
            clearable
            filterable
            default-expand-all
            placeholder="无（顶级部门）"
            style="width: 100%"
          />
        </el-form-item>
        <div class="department-form-grid">
          <el-form-item label="部门名称" required>
            <el-input
              v-model="form.departmentName"
              placeholder="例如：销售部、浙江区域、杭州市"
              maxlength="128"
            />
          </el-form-item>
          <el-form-item label="显示顺序" required>
            <el-input-number
              v-model="form.sortOrder"
              :min="0"
              :max="99999"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="负责人">
            <el-select
              v-model="form.leaderEmployeeCode"
              filterable
              remote
              clearable
              :remote-method="searchLeaders"
              :loading="leaderLoading"
              placeholder="搜索并选择在职员工"
              style="width: 100%"
              @visible-change="(open) => open && searchLeaders('')"
            >
              <el-option
                v-for="employee in leaders"
                :key="employee.employeeCode"
                :value="employee.employeeCode"
                :label="employee.employeeName + ' · ' + employee.employeeCode"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input
              v-model="form.contactPhone"
              placeholder="请输入联系电话"
              maxlength="32"
              clearable
            />
          </el-form-item>
          <el-form-item label="设立日期">
            <el-date-picker
              v-model="form.establishedDate"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              placeholder="请选择设立日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="部门状态">
            <el-radio-group v-model="form.statusCode"
              ><el-radio value="ACTIVE">正常</el-radio
              ><el-radio value="INACTIVE">停用</el-radio></el-radio-group
            >
          </el-form-item>
        </div>
        <el-alert
          v-if="form.statusCode === 'INACTIVE'"
          type="info"
          :closable="false"
          title="停用前请先处理启用中的下级部门和在职员工；有任职历史的部门应保留。"
        />
        <el-alert
          v-if="saveError"
          class="department-alert"
          type="error"
          :closable="false"
          :title="saveError"
          show-icon
        />
      </el-form>
      <div v-if="editingRecord" class="department-audit">
        <p>部门编码：{{ editingRecord.departmentCode }}</p>
        <el-descriptions :column="2" size="small">
          <el-descriptions-item label="创建时间">{{
            formatTime(editingRecord.createdTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{
            actorLabel(editingRecord.createdByName, editingRecord.createdBy)
          }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{
            formatTime(editingRecord.updatedTime)
          }}</el-descriptions-item>
          <el-descriptions-item label="修改人">{{
            actorLabel(editingRecord.updatedByName, editingRecord.updatedBy)
          }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { auditActorLabel } from '@/utils/audit-actor'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import { OfficeBuilding } from '@element-plus/icons-vue'
import {
  getHrEmployees,
  hrOrganizationApi,
  type HrDepartment,
  type HrDepartmentCommand,
} from '@/api/core/hr'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  departmentTree,
  filterDepartmentTree,
  departmentParentTree,
  type DepartmentNode,
} from '@/utils/hr-department-tree'

const leaders = ref<{ employeeCode: string; employeeName: string }[]>([])
const leaderLoading = ref(false)
let leaderRequest = 0
async function searchLeaders(keyword: string) {
  const request = ++leaderRequest
  leaderLoading.value = true
  try {
    const result = await getHrEmployees({ begin: 0, step: 50, keyword, employmentStatus: 'ACTIVE' })
    if (request !== leaderRequest) return
    const current = leaders.value.find((e) => e.employeeCode === form.leaderEmployeeCode)
    leaders.value = result.items
    if (current && !leaders.value.some((e) => e.employeeCode === current.employeeCode))
      leaders.value.unshift(current)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '负责人选项加载失败')
  } finally {
    if (request === leaderRequest) leaderLoading.value = false
  }
}
const { can } = useSupplyPermissions()
const rows = ref<HrDepartment[]>([]),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false)
const editing = ref<number | null>(null),
  editingRecord = ref<HrDepartment | null>(null),
  keyword = ref('')
const loadError = ref(''),
  saveError = ref(''),
  expandedKeys = ref<string[]>([])
const table = ref<TableInstance>()
const form = reactive<HrDepartmentCommand>({
  parentId: null,
  departmentName: '',
  sortOrder: 0,
  statusCode: 'ACTIVE',
  revision: 0,
  leaderEmployeeCode: null,
  contactPhone: null,
  establishedDate: null,
})
const allTree = computed(() => departmentTree(rows.value))
const tree = computed(() => filterDepartmentTree(allTree.value, keyword.value))
const parents = computed(() => departmentParentTree(allTree.value, editing.value))
const effectiveExpandedKeys = computed(() =>
  keyword.value.trim() ? rows.value.map((row) => String(row.id)) : expandedKeys.value,
)

const formatTime = displayDateTime
function actorLabel(name: string | null, id: string | null) {
  return name || auditActorLabel(id)
}
function message(error: unknown, fallback: string) {
  return error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : fallback
}
function expandAll() {
  expandedKeys.value = rows.value.map((row) => String(row.id))
}
function collapseAll() {
  keyword.value = ''
  expandedKeys.value = []
}
function expansionChanged(row: HrDepartment, expanded: boolean | HrDepartment[]) {
  if (typeof expanded !== 'boolean') return
  const keys = new Set(expandedKeys.value)
  if (expanded) keys.add(String(row.id))
  else keys.delete(String(row.id))
  expandedKeys.value = [...keys]
}
async function load(initial = false): Promise<boolean> {
  loading.value = true
  loadError.value = ''
  try {
    const result = await hrOrganizationApi.departments()
    departmentTree(result)
    rows.value = result
    if (initial) expandAll()
    return true
  } catch (error) {
    loadError.value = message(error, '部门加载失败，请稍后重试')
    return false
  } finally {
    loading.value = false
  }
}
function edit(row?: HrDepartment, parentId: number | null = null) {
  editing.value = row?.id ?? null
  editingRecord.value = row ?? null
  saveError.value = ''
  Object.assign(
    form,
    row
      ? {
          parentId: row.parentId,
          departmentName: row.departmentName,
          sortOrder: row.sortOrder,
          statusCode: row.statusCode,
          revision: row.revision,
          leaderEmployeeCode: row.leaderEmployeeCode ?? null,
          contactPhone: row.contactPhone ?? null,
          establishedDate: row.establishedDate ?? null,
        }
      : {
          parentId,
          departmentName: '',
          sortOrder: 0,
          statusCode: 'ACTIVE',
          revision: 0,
          leaderEmployeeCode: null,
          contactPhone: null,
          establishedDate: null,
        },
  )
  leaders.value = row?.leaderEmployeeCode
    ? [
        {
          employeeCode: row.leaderEmployeeCode,
          employeeName: row.leaderName || row.leaderEmployeeCode,
        },
      ]
    : []
  visible.value = true
}
async function save() {
  if (saving.value) return
  if (!form.departmentName.trim()) {
    saveError.value = '请输入部门名称'
    return
  }
  if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0 || form.sortOrder > 99999) {
    saveError.value = '显示顺序应为 0 到 99999 的整数'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const saved = await hrOrganizationApi.saveDepartment(editing.value, {
      ...form,
      departmentName: form.departmentName.trim(),
      parentId: form.parentId || null,
      leaderEmployeeCode: form.leaderEmployeeCode || null,
      contactPhone: form.contactPhone?.trim() || null,
      establishedDate: form.establishedDate || null,
    })
    visible.value = false
    keyword.value = ''
    // 保存接口返回真实记录后保留它；刷新失败也不能误导用户再次新增。
    rows.value = [...rows.value.filter((row) => row.id !== saved.id), saved]
    const loaded = await load()
    if (loaded && rows.value.some((row) => row.id === saved.id)) {
      expandAll()
      await nextTick()
      const findSaved = (nodes: DepartmentNode[]): DepartmentNode | undefined => {
        for (const node of nodes) {
          if (node.id === saved.id) return node
          const child = findSaved(node.children)
          if (child) return child
        }
      }
      table.value?.setCurrentRow(findSaved(tree.value))
      ElMessage.success('部门已保存')
    } else {
      rows.value = [...rows.value.filter((row) => row.id !== saved.id), saved]
      expandAll()
      loadError.value = `部门已保存，但列表未完成更新。${loadError.value || '请点击刷新重新读取。'}`
      ElMessage.warning('部门已保存，请刷新列表确认')
    }
  } catch (error) {
    saveError.value = message(error, '部门保存失败，请重试')
  } finally {
    saving.value = false
  }
}
async function remove(row: HrDepartment) {
  if (row.statusCode === 'ACTIVE') {
    ElMessage.warning('请先通过编辑停用部门，再执行删除')
    return
  }
  if (rows.value.some((child) => child.parentId === row.id)) {
    ElMessage.warning('请先移动或删除下级部门')
    return
  }
  try {
    await ElMessageBox.confirm(
      `删除部门“${row.departmentName}”？有员工或任职历史引用的部门须保留为停用状态。`,
      '删除部门',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await hrOrganizationApi.deleteDepartment(row.id, row.revision)
    rows.value = rows.value.filter((item) => item.id !== row.id)
    if (await load()) ElMessage.success('部门已删除')
    else ElMessage.warning('部门已删除，请刷新列表确认')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(message(error, '删除失败'))
  }
}
onMounted(() => load(true))
</script>
<style scoped>
.department-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}
.department-form-grid :deep(.el-form-item__content) {
  min-width: 0;
}
.department-audit {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  color: #64748b;
  font-size: 12px;
}
.department-audit p {
  margin: 0 0 8px;
}
@media (max-width: 600px) {
  .department-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.page-heading,
.department-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.page-heading {
  justify-content: space-between;
}
.page-heading p,
.department-count,
.department-help,
.field-help {
  color: #64748b;
  font-size: 13px;
}
.page-heading p {
  margin: 8px 0 0;
}
.department-toolbar {
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.department-toolbar .el-button + .el-button {
  margin-left: 0;
}
.department-search {
  width: 300px;
}
.department-count {
  margin-left: auto;
}
.department-tree-panel {
  overflow: hidden;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.department-name {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  vertical-align: middle;
  font-weight: 500;
}
.department-name .el-icon {
  color: #6688ad;
}
.department-children {
  margin-left: 12px;
  color: #94a3b8;
  font-size: 12px;
}
.department-alert {
  margin: 12px 0;
}
.field-help {
  margin-left: 12px;
}
.department-help {
  margin-top: 14px;
  line-height: 1.7;
}
.department-tree-panel :deep(.el-table__row td) {
  height: 56px;
}
@media (width < 700px) {
  .department-search {
    width: 100%;
  }
  .department-count {
    margin-left: 0;
  }
  .department-tree-panel {
    padding: 4px;
  }
}
</style>
