<template>
  <section class="master-data division-page" v-loading="loading">
    <header class="master-heading">
      <div>
        <SupplyPageTitle>行政区划</SupplyPageTitle>
      </div>
      <div class="heading-actions">
        <el-popover
          v-if="catalog"
          placement="bottom-end"
          width="min(420px, calc(100vw - 32px))"
          trigger="click"
        >
          <template #reference><el-button :icon="InfoFilled">数据来源</el-button></template>
          <div class="source-note">
            <strong>{{ catalog.sourceName }}</strong>
            <p>{{ catalog.sourceRef }}</p>
            <p>目录版本：{{ catalog.version }}</p>
            <p>
              <span v-for="(name, code) in levels" :key="code"
                >{{ name }} {{ counts[code].toLocaleString() }} 个　</span
              >
            </p>
            <p v-if="incompleteProvinces.length">
              {{ incompleteProvinces.join('、') }}：当前来源仅提供省级资料。
            </p>
            <p>
              按官方层级展示；直辖市、省直辖县不补造中间层级。七大区域采用公司已确认的省级对应关系。
            </p>
          </div>
        </el-popover>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button :icon="Download" :disabled="!catalog || loading" @click="openExport"
          >导出 Excel</el-button
        >
      </div>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="catalog">
      <div class="master-workspace division-workspace">
        <aside class="master-directory" aria-label="省级地区目录">
          <div class="directory-heading">
            <h2>地区目录</h2>
            <span>{{ tree.length }} 个省级地区</span>
          </div>
          <div class="directory-scroll">
            <button
              class="directory-item all-regions"
              :aria-pressed="!selectedProvince && !applied.region"
              @click="reset"
            >
              <span>全国</span><span>{{ tree.length }}</span>
            </button>
            <section v-for="(name, code) in GEO_REGIONS" :key="code" class="region-group">
              <div class="region-heading">
                <button
                  class="region-select"
                  :aria-pressed="applied.region === code"
                  @click="chooseRegion(code)"
                >
                  {{ name }}<span>{{ tree.filter((n) => n.region === code).length }}</span>
                </button>
                <button
                  class="region-toggle"
                  :aria-label="`${expandedRegions[code] ? '折叠' : '展开'}${name}地区`"
                  :aria-expanded="!!expandedRegions[code]"
                  :aria-controls="`region-${code}`"
                  @click="expandedRegions[code] = !expandedRegions[code]"
                >
                  <el-icon :class="{ expanded: expandedRegions[code] }"><ArrowRight /></el-icon>
                </button>
              </div>
              <div :id="`region-${code}`" v-show="expandedRegions[code]">
                <button
                  v-for="node in tree.filter((n) => n.region === code)"
                  :key="node.code"
                  class="directory-item province-item"
                  :aria-pressed="selectedProvince === node.code"
                  @click="chooseProvince(node.code)"
                >
                  <span>{{ node.name }}</span>
                </button>
              </div>
            </section>
          </div>
        </aside>
        <section class="master-detail">
          <div class="mobile-directory">
            <label for="province-select">地区目录</label>
            <select
              id="province-select"
              :value="selectedProvince"
              @change="chooseProvince(($event.target as HTMLSelectElement).value)"
            >
              <option value="">全国</option>
              <option v-for="node in tree" :key="node.code" :value="node.code">
                {{ node.name }}
              </option>
            </select>
          </div>
          <form
            class="detail-toolbar division-filters"
            aria-label="行政区划查询"
            @submit.prevent="search"
          >
            <h2 class="scope-title">{{ scopeTitle }}</h2>
            <el-input
              v-model="filters.keyword"
              :prefix-icon="Search"
              placeholder="搜索地区名称或编码"
              aria-label="地区名称或编码"
              clearable
            />
            <el-select
              v-model="filters.level"
              placeholder="全部行政等级"
              aria-label="行政等级"
              clearable
              ><el-option v-for="(name, code) in levels" :key="code" :label="name" :value="code"
            /></el-select>
            <el-button type="primary" native-type="submit">查询</el-button
            ><el-button @click="reset">重置</el-button>
          </form>
          <div class="master-table">
            <el-table
              :key="tableKey"
              :data="rows"
              row-key="code"
              height="100%"
              lazy
              :load="loadChildren"
              :tree-props="{ hasChildren: 'hasChildren' }"
              :empty-text="
                province && !province.children.length && !flatMode
                  ? '当前来源仅提供省级资料，暂无下级数据'
                  : '没有匹配的行政区划'
              "
            >
              <el-table-column prop="name" label="地区名称" width="190" show-overflow-tooltip />
              <el-table-column prop="code" label="行政编码" width="120" />
              <el-table-column label="等级" width="80"
                ><template #default="{ row }"
                  ><span class="admin-level" :class="`admin-level--${row.level.toLowerCase()}`">{{
                    levels[row.level as AdminArea['level']]
                  }}</span></template
                ></el-table-column
              >
              <el-table-column label="所属大区" width="90"
                ><template #default="{ row }">{{
                  GEO_REGIONS[row.region] || '—'
                }}</template></el-table-column
              >
              <el-table-column prop="path" label="行政路径" min-width="220" show-overflow-tooltip />
            </el-table>
          </div>
          <footer class="detail-footer">
            <span v-if="flatMode">找到 {{ matches.length }} 个地区</span>
            <span v-else
              >{{
                province
                  ? `共 ${scopeNodes.length} 个直属地区`
                  : `共 ${scopeNodes.length} 个省级地区`
              }}<span class="footer-hint"> · 展开查看下级</span></span
            >
            <el-pagination
              v-if="flatMode"
              v-model:current-page="page"
              :page-size="50"
              :total="matches.length"
              :pager-count="5"
              layout="prev, pager, next"
              size="small"
            />
          </footer>
        </section>
      </div>
    </template>
    <el-dialog
      v-model="exportVisible"
      title="导出行政区划"
      width="min(480px, 94vw)"
      :close-on-click-modal="!exporting"
      :show-close="!exporting"
      @closed="clearExportFile"
    >
      <el-form label-position="top">
        <el-form-item label="导出范围">
          <el-select v-model="exportScope" aria-label="导出范围" :disabled="exporting">
            <el-option :label="`当前范围：${scopeTitle}`" value="current" />
            <el-option label="全国（不含当前筛选）" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="导出等级">
          <el-radio-group v-model="exportLevel" aria-label="导出等级" :disabled="exporting">
            <el-radio-button v-for="(name, code) in levels" :key="code" :value="code">{{
              name
            }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <p class="export-summary">
        将导出 <strong>{{ exportRows.length.toLocaleString() }}</strong> 条{{
          levels[exportLevel]
        }}数据
      </p>
      <p v-if="exportScope === 'current' && applied.keyword">查询关键词：{{ applied.keyword }}</p>
      <p class="source-note">
        导出该范围内所选等级的全部资料，不受分页限制；未提供的下级资料不会补造。
      </p>
      <p v-if="exportFile" class="export-result">
        文件已生成。<a ref="exportLink" :href="exportFile.url" :download="exportFile.name"
          >下载 {{ exportFile.name }}</a
        >
      </p>
      <el-alert v-if="exportError" :title="exportError" type="error" :closable="false" />
      <template #footer
        ><el-button :disabled="exporting" @click="exportVisible = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!exportRows.length"
          :loading="exporting"
          @click="exportExcel"
          >导出 Excel</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight, Download, InfoFilled, Refresh, Search } from '@element-plus/icons-vue'

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ADMIN_LEVELS,
  buildDivisionWorkbook,
  selectDivisionExportRows,
} from '@/utils/admin-division-export'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import {
  adminDivisionApi,
  type AdminArea,
  type AdminDivisionCatalog,
} from '@/api/core/admin-divisions'
import { buildAdminAreaTree, GEO_REGIONS, type AdminAreaNode } from '@/utils/admin-divisions'

const catalog = ref<AdminDivisionCatalog | null>(null)
const loading = ref(false),
  error = ref(''),
  page = ref(1)
const filters = reactive({ keyword: '', region: '', level: '' })
const applied = ref({ ...filters })
const levels = ADMIN_LEVELS
const expandedRegions = reactive<Record<string, boolean>>({ NORTH: true })
const exportVisible = ref(false)
const exportLevel = ref<AdminArea['level']>('PROVINCE')
const exportScope = ref('current')
const exporting = ref(false)
const exportError = ref('')
const exportFile = ref<{ url: string; name: string } | null>(null)
const exportLink = ref<HTMLAnchorElement>()
function clearExportFile() {
  if (exportFile.value) URL.revokeObjectURL(exportFile.value.url)
  exportFile.value = null
}
onBeforeUnmount(clearExportFile)
const exportSelection = computed(() => ({
  level: exportLevel.value,
  provinceCode: exportScope.value === 'current' ? selectedProvince.value : '',
  region: exportScope.value === 'current' ? applied.value.region : '',
  keyword: exportScope.value === 'current' ? applied.value.keyword : '',
}))
const exportRows = computed(() =>
  catalog.value ? selectDivisionExportRows(catalog.value, exportSelection.value) : [],
)
watch([exportLevel, exportScope], clearExportFile)
function openExport() {
  clearExportFile()
  exportLevel.value = (applied.value.level as AdminArea['level']) || 'PROVINCE'
  exportScope.value = 'current'
  exportError.value = ''
  exportVisible.value = true
}
async function exportExcel() {
  if (!catalog.value || !exportRows.value.length || exporting.value) return
  exporting.value = true
  exportError.value = ''
  const scope = exportScope.value === 'current' ? scopeTitle.value : '全国行政区划'
  try {
    const workbook = await buildDivisionWorkbook(catalog.value, exportSelection.value, scope)
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
    clearExportFile()
    exportFile.value = {
      url: URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ),
      name: `行政区划_${scope}_${levels[exportLevel.value]}.xlsx`,
    }
    await nextTick()
    exportLink.value?.click()
  } catch {
    exportError.value = 'Excel 导出失败，请重试。'
  } finally {
    exporting.value = false
  }
}
const tree = computed(() => buildAdminAreaTree(catalog.value?.nodes ?? []))
const indexed = computed(() => {
  const nodes = new Map<string, AdminAreaNode>()
  function visit(branch: AdminAreaNode[]) {
    for (const node of branch) {
      nodes.set(node.code, node)
      visit(node.children)
    }
  }
  visit(tree.value)
  return nodes
})
const counts = computed(() => {
  const result = { PROVINCE: 0, PREFECTURE: 0, COUNTY: 0 }
  catalog.value?.nodes.forEach((node) => result[node.level]++)
  return result
})
const selectedProvince = ref('')
const province = computed(() => indexed.value.get(selectedProvince.value))
const scopeTitle = computed(
  () => province.value?.name || GEO_REGIONS[applied.value.region] || '全国行政区划',
)
function chooseProvince(code: string) {
  selectedProvince.value = code
  const region = indexed.value.get(code)?.region
  if (region) expandedRegions[region] = true
  Object.assign(filters, { keyword: '', region: '', level: '' })
  search()
}
function chooseRegion(code: string) {
  expandedRegions[code] = true
  selectedProvince.value = ''
  Object.assign(filters, { keyword: '', region: code, level: '' })
  search()
}
const scopeNodes = computed(() => (province.value ? province.value.children : visibleRoots.value))

const incompleteProvinces = computed(() =>
  tree.value.filter((node) => !node.children.length).map((node) => node.name),
)
const visibleRoots = computed(() =>
  tree.value.filter((node) => !applied.value.region || node.region === applied.value.region),
)
const flatMode = computed(() => Boolean(applied.value.keyword || applied.value.level))
const matches = computed(() =>
  [...indexed.value.values()].filter(
    (node) =>
      (!province.value || node.path.startsWith(province.value.path + ' / ')) &&
      (!applied.value.region || node.region === applied.value.region) &&
      (!applied.value.level || node.level === applied.value.level) &&
      (!applied.value.keyword ||
        node.path.includes(applied.value.keyword) ||
        node.code.includes(applied.value.keyword)),
  ),
)
function tableRow(node: AdminAreaNode) {
  return { ...node, children: undefined, hasChildren: !flatMode.value && node.children.length > 0 }
}
const rows = computed(() =>
  (flatMode.value
    ? matches.value.slice((page.value - 1) * 50, page.value * 50)
    : scopeNodes.value
  ).map(tableRow),
)
const tableKey = computed(
  () => catalog.value?.version + selectedProvince.value + JSON.stringify(applied.value),
)
function loadChildren(
  row: ReturnType<typeof tableRow>,
  _tree: unknown,
  resolve: (rows: ReturnType<typeof tableRow>[]) => void,
) {
  resolve((indexed.value.get(row.code)?.children ?? []).map(tableRow))
}
function search() {
  applied.value = { ...filters, keyword: filters.keyword.trim() }
  page.value = 1
}
function reset() {
  selectedProvince.value = ''
  Object.assign(filters, { keyword: '', region: '', level: '' })
  search()
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    catalog.value = await adminDivisionApi.catalog()
    page.value = 1
  } catch (e) {
    catalog.value = null
    error.value = e instanceof Error ? e.message : '行政区划加载失败'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<style scoped lang="scss" src="./master-data.scss"></style>
<style scoped lang="scss">
.division-workspace {
  grid-template-columns: 200px minmax(0, 1fr);
}
.region-group {
  margin-top: 4px;
}
.region-heading {
  display: flex;
  align-items: center;
  background: #e6edf5;
  border-radius: 4px;
  color: #263f5d;
}
.region-select,
.region-toggle {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  min-height: 34px;
}
.region-select {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-weight: 600;
  text-align: left;
}
.region-select span {
  font-size: var(--app-font-size-small);
  font-weight: 400;
}
.region-select[aria-pressed='true'] {
  color: #1d4ed8;
}
.region-toggle {
  padding: 8px 10px;
  display: grid;
  place-items: center;
}
.region-toggle .expanded {
  transform: rotate(90deg);
}
.region-select:focus-visible,
.region-toggle:focus-visible {
  outline: 2px solid var(--md-accent);
  outline-offset: -2px;
}
.province-item {
  min-height: 34px;
  padding-left: 24px;
}
.admin-level {
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 4px;
  line-height: 22px;
  white-space: nowrap;
  font-size: var(--app-font-size-base);
  font-weight: 500;
}
.admin-level--province {
  color: #1e40af;
  background: #eff6ff;
  border-color: #bfdbfe;
}
.admin-level--prefecture {
  color: #0f6569;
  background: #edfafa;
  border-color: #a5dddd;
}
.admin-level--county {
  color: #6b21a8;
  background: #faf5ff;
  border-color: #e9d5ff;
}
.export-summary {
  margin: 12px 0;
}
.division-filters > .el-input {
  width: 240px;
}
.division-filters > .el-select {
  width: 140px;
}
.scope-title {
  margin-right: auto;
  font-size: var(--app-font-size-base);
  font-weight: 600;
  color: var(--app-text-primary);
}
.source-note {
  font-size: var(--app-font-size-small);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
@media (max-width: 800px) {
  .division-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .scope-title {
    width: 100%;
  }
  .division-filters > .el-input {
    width: 100%;
  }
  .division-filters > .el-select {
    flex: 1;
  }
}
</style>

<style scoped>
.export-result {
  padding: 12px;
  background: #eff6ff;
  color: #1f2329;
  overflow-wrap: anywhere;
}
.export-result a {
  color: #1d4ed8;
  text-decoration: underline;
}
</style>
