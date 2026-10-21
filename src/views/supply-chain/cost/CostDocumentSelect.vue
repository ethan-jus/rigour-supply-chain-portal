<template>
  <div class="cost-document-select">
    <el-select
      v-model="selection"
      multiple
      filterable
      remote
      remote-show-suffix
      :loading="loading"
      :remote-method="search"
      :placeholder="placeholder || '选择来源单据，可输入单号搜索'"
      @visible-change="
        (visible) => {
          if (visible) void load(0)
        }
      "
      @change="changed"
    >
      <el-option v-for="row in options" :key="row.id" :value="row.id" :label="label(row)" />
      <template #empty
        ><div class="empty" role="status">
          {{ loading ? '正在加载单据…' : failure || '暂无可选单据，可手工补录未同步的订货宝单据' }}
          <el-button v-if="failure" link type="primary" @click.stop="load(0)">重新加载</el-button>
        </div></template
      >
    </el-select>
    <div v-if="failure" role="alert">
      {{ failure }} <el-button link type="primary" @click="load(0)">重新加载</el-button>
    </div>
    <el-button link type="primary" @click="openMore">更多查询</el-button>
    <el-dialog v-model="visible" title="选择来源单据" width="min(1000px, 95vw)" append-to-body>
      <el-input
        v-model="keyword"
        placeholder="单号、供应商、客户或仓库"
        clearable
        @keyup.enter="load(0)"
      >
        <template #append><el-button :loading="loading" @click="load(0)">查询</el-button></template>
      </el-input>
      <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
      <el-table v-loading="loading" :data="pageRows" row-key="id" border>
        <el-table-column width="65" label="选择"
          ><template #default="{ row }">
            <el-checkbox
              :model-value="selection.includes(row.id)"
              :aria-label="'选择' + row.documentNo"
              @change="toggle(row as CostSource)"
            /> </template
        ></el-table-column>
        <el-table-column prop="documentNo" label="单据号" min-width="170" />
        <el-table-column label="来源" width="110"
          ><template #default="{ row }">{{
            externalSourceName(row.sourceSystem)
          }}</template></el-table-column
        >
        <el-table-column label="日期" width="110"
          ><template #default="{ row }">{{
            row.documentDate || '日期待核对'
          }}</template></el-table-column
        >
        <el-table-column prop="senderName" label="发货方" min-width="150" />
        <el-table-column prop="receiverName" label="收货方" min-width="150" />
        <el-table-column label="归属城市" width="130"
          ><template #default="{ row }">{{
            cityName(row as CostSource)
          }}</template></el-table-column
        >
        <el-table-column prop="statusCode" label="单据状态" width="120" />
      </el-table>
      <div class="pager">
        <el-button :disabled="loading || offset === 0" @click="load(Math.max(0, offset - 50))"
          >上一页</el-button
        >
        <span>第 {{ Math.floor(offset / 50) + 1 }} 页 · 已选 {{ selection.length }} 张</span>
        <el-button :disabled="loading || pageRows.length < 50" @click="load(offset + 50)"
          >下一页</el-button
        >
      </div>
      <template #footer
        ><el-button type="primary" @click="visible = false">完成选择</el-button></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CostSource } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { externalSourceName } from './cost-source'
const props = defineProps<{
  loader: (keyword: string, begin: number) => Promise<CostSource[]>
  sources: CostSource[]
  cities?: { code: string; name: string }[]
  resetKey?: string
  placeholder?: string
}>()
const selection = defineModel<string[]>({ required: true })
const emit = defineEmits<{ sources: [CostSource[]]; change: [] }>()
const pageRows = ref<CostSource[]>([]),
  loading = ref(false),
  failure = ref(''),
  keyword = ref('')
const visible = ref(false),
  offset = ref(0)
const options = computed(() => [
  ...new Map([...props.sources, ...pageRows.value].map((r) => [r.id, r])).values(),
])
const cityName = (r: CostSource) =>
  props.cities?.find((city) => city.code === r.cityCode)?.name || r.cityCode || '城市待核对'
const label = (r: CostSource) =>
  `${r.originalNo || r.documentNo} · ${r.senderName || '待核对'} → ${r.receiverName || '待核对'} · ${cityName(r)} · ${r.documentDate || '日期待核对'} · ${r.statusCode}`
let version = 0,
  timer: ReturnType<typeof setTimeout> | undefined
async function load(begin: number) {
  const current = ++version
  loading.value = true
  failure.value = ''
  try {
    const rows = await props.loader(keyword.value, begin)
    if (current !== version) return
    pageRows.value = rows
    offset.value = begin
  } catch (e) {
    if (current === version) {
      failure.value = errorMessage(e, '单据加载失败，请重试')
      pageRows.value = []
    }
  } finally {
    if (current === version) loading.value = false
  }
}
function search(value: string) {
  keyword.value = value
  version++
  clearTimeout(timer)
  timer = setTimeout(() => void load(0), 250)
}
function changed(ids: string[] = selection.value) {
  emit(
    'sources',
    options.value.filter((r) => ids.includes(r.id)),
  )
  emit('change')
}
function toggle(row: CostSource) {
  const next = selection.value.includes(row.id)
    ? selection.value.filter((id) => id !== row.id)
    : [...selection.value, row.id]
  selection.value = next
  changed(next)
}
function openMore() {
  visible.value = true
  void load(0)
}
watch(
  () => props.resetKey,
  () => {
    version++
    clearTimeout(timer)
    pageRows.value = []
    failure.value = ''
    loading.value = false
    offset.value = 0
    keyword.value = ''
  },
)
onBeforeUnmount(() => {
  version++
  clearTimeout(timer)
})
</script>
<style scoped>
.cost-document-select {
  width: 100%;
}
.el-select {
  width: 100%;
}
.empty,
.pager {
  padding: 12px;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.el-table {
  margin-top: 12px;
}
</style>
