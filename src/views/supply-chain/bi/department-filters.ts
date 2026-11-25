import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getDepartmentDashboardFilters,
  type DashboardFilterNode,
  type DepartmentDashboardFilters,
} from '@/api/core/bi'

export interface DashboardTreeNode extends DashboardFilterNode {
  children: DashboardTreeNode[]
}

export function departmentTree(rows: DashboardFilterNode[]) {
  const nodes = new Map(
    rows.map((row) => [row.code, { ...row, children: [] as DashboardTreeNode[] }]),
  )
  const roots: DashboardTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentCode && nodes.get(node.parentCode)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

function createFilters() {
  const route = useRoute(),
    router = useRouter()
  const options = ref<DepartmentDashboardFilters>()
  const error = ref('')
  async function load() {
    error.value = ''
    try {
      options.value = await getDepartmentDashboardFilters()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '部门和地区读取失败'
    }
  }
  const department = computed(() =>
    typeof route.query.regionCode === 'string'
      ? route.query.regionCode
      : options.value?.defaultDepartmentCode || '',
  )
  const customerRegion = computed(() => String(route.query.customerRegionCode || ''))
  function select(
    key: 'regionCode' | 'customerRegionCode',
    code: string,
    period?: Record<string, string | undefined>,
  ) {
    void router.push({
      query: { ...route.query, ...period, [key]: code || (key === 'regionCode' ? '' : undefined) },
    })
  }
  void load()
  return { options, error, load, department, customerRegion, select }
}
const key: InjectionKey<ReturnType<typeof createFilters>> = Symbol('department-dashboard-filters')
export function provideDashboardFilters() {
  const filters = createFilters()
  provide(key, filters)
  return filters
}
export function useDashboardFilters() {
  return inject(key, null)
}
