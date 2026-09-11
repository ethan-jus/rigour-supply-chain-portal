<template>
  <el-select
    v-bind="$attrs"
    v-model="selectedValue"
    class="product-category-select"
    :clearable="clearable"
    :filter-method="handleFilter"
    :filterable="filterable"
    :loading="loading"
    :placeholder="placeholder"
    :popper-class="popperClass"
    :value-on-clear="emptyValue"
  >
    <el-option
      v-for="item in visibleRows"
      :key="item.id"
      :disabled="disabledValueSet.has(String(item.id))"
      :label="item.categoryName"
      :value="String(item.id)"
    >
      <span class="product-category-select__option" :style="{ paddingLeft: `${(item.depth - 1) * 28}px` }">
        {{ item.categoryName }}
      </span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ErpProductCategoryView } from '@/api/core/erp-internal'

defineOptions({ inheritAttrs: false })

type CategorySelectValue = string | number | null
type CategoryTreeRow = ErpProductCategoryView & { children: CategoryTreeRow[]; depth: number }

const props = withDefaults(defineProps<{
  modelValue?: CategorySelectValue
  categories: ErpProductCategoryView[]
  disabledValues?: Array<string | number | null | undefined>
  emptyValue?: string | null
  placeholder?: string
  clearable?: boolean
  filterable?: boolean
  loading?: boolean
  popperClass?: string
}>(), {
  modelValue: '',
  disabledValues: () => [],
  emptyValue: '',
  placeholder: '全部分类',
  clearable: true,
  filterable: true,
  loading: false,
  popperClass: 'product-category-select-popper',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: CategorySelectValue): void
  (event: 'change', value: CategorySelectValue): void
}>()

const keyword = ref('')

const selectedValue = computed({
  get: () => (props.modelValue == null || props.modelValue === '' ? '' : String(props.modelValue)),
  set: (value: string | number | null) => {
    const next = value == null || value === '' ? props.emptyValue : String(value)
    emit('update:modelValue', next)
    emit('change', next)
  },
})

const disabledValueSet = computed(() =>
  new Set(props.disabledValues.filter((value) => value != null && value !== '').map((value) => String(value))),
)

const treeRows = computed(() => buildCategoryTree(props.categories))
const flatRows = computed(() => flattenTreeRows(treeRows.value))

const visibleRows = computed(() => {
  const query = normalize(keyword.value)
  if (!query) return flatRows.value

  const byId = new Map(flatRows.value.map((item) => [String(item.id), item]))
  const matched = new Set<string>()
  for (const item of flatRows.value) {
    if (!categoryMatches(item, query)) continue
    let cursor: CategoryTreeRow | undefined = item
    while (cursor) {
      matched.add(String(cursor.id))
      cursor = cursor.parentId == null ? undefined : byId.get(String(cursor.parentId))
    }
  }

  return flatRows.value.filter((item) => matched.has(String(item.id)))
})

function handleFilter(value: string) {
  keyword.value = value
}

function buildCategoryTree(categories: ErpProductCategoryView[]): CategoryTreeRow[] {
  const nodes = new Map<string, CategoryTreeRow>()
  for (const item of categories) {
    nodes.set(String(item.id), { ...item, children: [], depth: 1 })
  }

  const roots: CategoryTreeRow[] = []
  for (const node of nodes.values()) {
    const parentId = node.parentId == null ? '' : String(node.parentId)
    const parent = parentId ? nodes.get(parentId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }

  sortCategoryTree(roots)
  assignDepth(roots, 1)
  return roots
}

function sortCategoryTree(rows: CategoryTreeRow[]) {
  rows.sort((left, right) =>
    Number(left.ordinal ?? 0) - Number(right.ordinal ?? 0)
    || String(left.categoryCode || '').localeCompare(String(right.categoryCode || ''), 'zh-CN')
    || String(left.categoryName || '').localeCompare(String(right.categoryName || ''), 'zh-CN')
    || Number(left.id) - Number(right.id),
  )
  for (const row of rows) sortCategoryTree(row.children)
}

function assignDepth(rows: CategoryTreeRow[], depth: number) {
  for (const row of rows) {
    row.depth = depth
    assignDepth(row.children, depth + 1)
  }
}

function flattenTreeRows(rows: CategoryTreeRow[]): CategoryTreeRow[] {
  const result: CategoryTreeRow[] = []
  const walk = (items: CategoryTreeRow[]) => {
    for (const item of items) {
      result.push(item)
      walk(item.children)
    }
  }
  walk(rows)
  return result
}

function categoryMatches(item: CategoryTreeRow, query: string) {
  return normalize(item.categoryName).includes(query) || normalize(item.categoryCode).includes(query)
}

function normalize(value?: string | null) {
  return String(value || '').trim().toLocaleLowerCase()
}
</script>

<style scoped>
.product-category-select {
  width: 100%;
}

.product-category-select__option {
  display: block;
  overflow: hidden;
  color: #4b5563;
  font-size: 16px;
  line-height: 44px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.product-category-select-popper .el-select-dropdown__item) {
  height: 44px;
  padding: 0 18px;
}

:global(.product-category-select-popper .el-select-dropdown__item.is-disabled .product-category-select__option) {
  color: #cbd5e1;
}

:global(.product-category-select-popper .el-select-dropdown__item.is-hovering) {
  background: #f3f5f8;
}
</style>
