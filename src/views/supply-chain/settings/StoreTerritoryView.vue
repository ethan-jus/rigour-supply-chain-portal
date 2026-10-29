<template>
  <section class="territory-page" v-loading="loading">
    <header class="page-heading">
      <div>
        <SupplyPageTitle>客户地域权限</SupplyPageTitle>
        <p>按部门维护门店可访问地区，公海、私海和客户统计使用同一套范围。</p>
      </div>
      <el-button :loading="loading" :disabled="saving" @click="load">刷新</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <template v-if="context">
      <el-alert
        title="地域范围与角色数据权限共同生效"
        description="省、市自动包含下级区县；未配置地域的受限部门无法访问门店。全国访问由角色的全部数据权限控制。部门上下级本身不会自动扩大地域范围。"
        type="info"
        show-icon
        :closable="false"
      />
      <el-tabs v-model="tab">
        <el-tab-pane label="部门客户地域" name="departments">
          <div class="toolbar">
            <el-input
              v-model="departmentKeyword"
              placeholder="搜索部门名称"
              aria-label="搜索部门名称"
              clearable
            />
            <span>共 {{ context.departments.length }} 个部门 · {{ configuredCount }} 个已配置</span>
          </div>
          <el-table :data="departmentRows" row-key="id" empty-text="没有匹配的部门">
            <el-table-column prop="name" label="部门" min-width="190" />
            <el-table-column label="上级部门" min-width="150"
              ><template #default="{ row }">{{
                departmentNames.get(row.parentId) || '—'
              }}</template></el-table-column
            >
            <el-table-column label="可访问地区" min-width="350"
              ><template #default="{ row }">
                <div v-if="row.areas.length" class="area-tags">
                  <el-tag
                    v-for="area in row.areas"
                    :key="area.version + ':' + area.code"
                    :type="area.version === context.catalog.version ? 'info' : 'warning'"
                    >{{ areaLabel(area) }}</el-tag
                  >
                </div>
                <span v-else class="empty-scope">未配置</span>
              </template></el-table-column
            >
            <el-table-column label="部门状态" width="110"
              ><template #default="{ row }"
                ><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{
                  row.status === 'ACTIVE' ? '启用' : '停用'
                }}</el-tag></template
              ></el-table-column
            >
            <!-- @vue-generic {TerritoryDepartment} -->
            <el-table-column v-if="context.canWrite" label="操作" width="120" fixed="right"
              ><template #default="{ row }"
                ><el-button
                  link
                  type="primary"
                  :disabled="row.status !== 'ACTIVE'"
                  @click="edit(row)"
                  >设置地区</el-button
                ></template
              ></el-table-column
            >
          </el-table>
          <p class="footnote">
            保存会记录操作人、变更范围、时间及原因，可在系统设置的操作日志中查询。
          </p>
        </el-tab-pane>
        <el-tab-pane label="行政区划目录" name="catalog">
          <div class="catalog-source">
            <strong>{{ context.catalog.sourceName }}</strong
            ><span>版本 {{ context.catalog.version }}</span
            ><span>来源：{{ context.catalog.sourceRef }}</span>
          </div>
          <div class="toolbar">
            <el-input
              v-model="areaKeyword"
              placeholder="搜索地区名称或六位行政编码"
              aria-label="搜索行政区划"
              clearable
            /><el-select v-model="region" placeholder="全部大区" aria-label="筛选大区" clearable
              ><el-option
                v-for="(name, code) in GEO_REGIONS"
                :key="code"
                :label="name"
                :value="code"
            /></el-select>
          </div>
          <el-table
            :key="areaKeyword + region"
            :data="areaRows"
            row-key="code"
            :default-expand-all="Boolean(areaKeyword)"
            empty-text="没有匹配的行政区划"
          >
            <el-table-column prop="name" label="地区名称" min-width="240" /><el-table-column
              prop="code"
              label="行政编码"
              min-width="150"
            />
            <el-table-column label="行政等级" min-width="120"
              ><template #default="{ row }">{{
                levelNames[row.level as AdminArea['level']]
              }}</template></el-table-column
            >
            <el-table-column label="七大区域" min-width="140"
              ><template #default="{ row }">{{
                GEO_REGIONS[row.region] || row.region
              }}</template></el-table-column
            >
          </el-table>
          <p class="footnote">目录由公共服务按来源版本统一发布，已发布版本保持不变。</p>
        </el-tab-pane>
      </el-tabs>
    </template>
    <el-dialog
      v-model="visible"
      :title="`设置地区 · ${editing?.name ?? ''}`"
      width="min(640px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form :disabled="saving" label-position="top" @submit.prevent="save">
        <el-form-item label="可访问地区">
          <el-tree-select
            v-model="areaCodes"
            :data="areaTree"
            node-key="code"
            :props="{ label: 'label', children: 'children' }"
            multiple
            show-checkbox
            check-strictly
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="6"
            placeholder="选择省、市或区县"
            aria-label="可访问地区"
            class="area-picker"
          />
          <p class="footnote">选中上级地区即包含其下级地区；清空后，该部门不再提供客户地域授权。</p>
        </el-form-item>
        <el-alert
          v-if="editing?.areas.some((a) => a.version !== context?.catalog.version)"
          title="原范围含历史版本，请按当前目录重新核对；保存将替换原范围。"
          type="warning"
          :closable="false"
        />
        <el-alert
          v-if="!areaCodes.length"
          title="当前范围为空，保存后将撤销此部门的客户地域范围。"
          type="warning"
          :closable="false"
        />
        <el-form-item label="修改原因" required
          ><el-input
            v-model="reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="例如：杭州销售部负责杭州市全部区县"
            aria-label="修改原因"
        /></el-form-item>
        <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" show-icon />
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!reason.trim()" @click="save"
          >保存范围</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import {
  storeTerritoryApi,
  type TerritoryArea,
  type TerritoryContext,
  type TerritoryDepartment,
} from '@/api/core/store-territories'
import type { AdminArea } from '@/api/core/crm-store'
import { GEO_REGIONS } from '@/utils/crm-store'

interface AreaNode extends AdminArea {
  children: AreaNode[]
  label: string
  region: string
}
const context = ref<TerritoryContext | null>(null)
const loading = ref(false),
  saving = ref(false),
  error = ref(''),
  saveError = ref('')
const tab = ref('departments'),
  departmentKeyword = ref(''),
  areaKeyword = ref(''),
  region = ref('')
const visible = ref(false),
  editing = ref<TerritoryDepartment | null>(null),
  areaCodes = ref<string[]>([]),
  reason = ref('')
const levelNames = { PROVINCE: '省级', PREFECTURE: '地级', COUNTY: '县级' }
const areaNames = computed(
  () => new Map(context.value?.catalog.nodes.map((a) => [a.code, a.name]) ?? []),
)
const departmentNames = computed(
  () => new Map(context.value?.departments.map((d) => [d.id, d.name]) ?? []),
)
const configuredCount = computed(
  () => context.value?.departments.filter((d) => d.areas.length).length ?? 0,
)
const departmentRows = computed(
  () =>
    context.value?.departments.filter((d) => d.name.includes(departmentKeyword.value.trim())) ?? [],
)
const areaTree = computed(() => {
  const nodes = new Map<string, AreaNode>(
    (context.value?.catalog.nodes ?? []).map((a) => [
      a.code,
      { ...a, children: [], label: `${a.name} · ${a.code}`, region: '' },
    ]),
  )
  const roots: AreaNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentCode ? nodes.get(node.parentCode) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const assignRegion = (node: AreaNode, inherited: string) => {
    node.region = node.regionCode || inherited
    node.children.forEach((child) => assignRegion(child, node.region))
  }
  roots.forEach((root) => assignRegion(root, ''))
  return roots
})
const areaRows = computed(() => {
  const keyword = areaKeyword.value.trim()
  const filter = (nodes: AreaNode[]): AreaNode[] =>
    nodes.flatMap((node) => {
      if (region.value && node.region !== region.value) return []
      if (!keyword || node.label.includes(keyword)) return [node]
      const children = filter(node.children)
      return children.length ? [{ ...node, children }] : []
    })
  return filter(areaTree.value)
})
function areaLabel(area: TerritoryArea) {
  return area.version === context.value?.catalog.version
    ? `${areaNames.value.get(area.code) || area.code} · ${area.code}`
    : `${area.code}（历史版本 ${area.version}）`
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    context.value = await storeTerritoryApi.context()
  } catch (e) {
    context.value = null
    error.value = e instanceof Error ? e.message : '客户地域权限加载失败'
  } finally {
    loading.value = false
  }
}
function edit(row: TerritoryDepartment) {
  editing.value = row
  areaCodes.value = row.areas
    .filter((a) => a.version === context.value?.catalog.version)
    .map((a) => a.code)
  reason.value = ''
  saveError.value = ''
  visible.value = true
}
async function save() {
  if (saving.value || !context.value?.canWrite || !editing.value || !reason.value.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    await storeTerritoryApi.save(editing.value.id, {
      applicationVersion: context.value.applicationVersion,
      catalogVersion: context.value.catalog.version,
      areaCodes: areaCodes.value,
      reason: reason.value.trim(),
    })
    visible.value = false
    ElMessage.success('部门客户地域已保存')
    await load()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.territory-page {
  padding: 24px;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.page-heading p,
.footnote {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.territory-page > .el-alert {
  margin-bottom: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 8px 0 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.toolbar .el-input {
  width: 300px;
}
.toolbar .el-select {
  width: 160px;
}
.area-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}
.empty-scope {
  color: var(--el-text-color-secondary);
}
.area-picker {
  width: 100%;
}
.catalog-source {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 8px 0 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.catalog-source strong {
  color: var(--el-text-color-primary);
}
@media (max-width: 700px) {
  .territory-page {
    padding: 16px;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .toolbar .el-input {
    width: 100%;
  }
}
</style>
