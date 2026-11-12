import { computed, ref } from 'vue'
import { getPaymentFilterOptions, type PaymentFilterOptions } from '@/api/core/payment-filter-options'
import { departmentTree } from '@/utils/hr-department-tree'
import type { OrderProductFilterSources } from './useOrderProductFilters'

/** 回款页不依赖用户具有 HR、CRM 或商品管理权限。 */
export function usePaymentFilterOptions({ salesDepartmentsOnly = false }: { salesDepartmentsOnly?: boolean } = {}) {
  const options = ref<PaymentFilterOptions | null>(null)
  const employeeOptions = ref<PaymentFilterOptions['employees']>([])
  const employeeLoading = ref(false)
  const optionError = ref('')
  let pending: Promise<PaymentFilterOptions> | undefined
  function fetchOptions() {
    if (options.value) return Promise.resolve(options.value)
    if (!pending) pending = getPaymentFilterOptions().then(value => {
      options.value = value
      return value
    }).finally(() => { pending = undefined })
    return pending
  }
  async function searchEmployees(keyword = '', regionCode?: string | null) {
    employeeLoading.value = true
    try {
      const data = await fetchOptions()
      const text = keyword.trim().toLocaleLowerCase()
      employeeOptions.value = [...new Map(data.employees
        .filter(row => (!regionCode || row.regionCode?.includes(regionCode))
          && (!text || `${row.employeeName} ${row.employeeCode}`.toLocaleLowerCase().includes(text)))
        .map(row => [row.employeeCode, row])).values()]
    } catch (e) { optionError.value = e instanceof Error ? e.message : '回款筛选选项加载失败' }
    finally { employeeLoading.value = false }
  }
  const productSources: OrderProductFilterSources = {
    async categories(query) {
      const rows = (await fetchOptions()).categories
      return { total: rows.length, items: rows.slice(query.begin, query.begin + query.step) }
    },
    async products(query) {
      const rows = (await fetchOptions()).products.filter(row =>
        (!query.categoryId || String(row.categoryId) === String(query.categoryId))
        && (!query.productIds || query.productIds.map(String).includes(String(row.id)))
        && (!query.productName || row.productName.includes(query.productName))
        && (!query.productCode || row.productCode.toLowerCase().includes(query.productCode.toLowerCase())))
      return { total: rows.length, items: rows.slice(query.begin, query.begin + query.step) }
    },
  }
  return {
    areaTree: computed(() => (options.value?.areas ?? []).map(row => ({ ...row, children: [] }))),
    departmentOptionsTree: computed(() => {
      const tree = departmentTree(options.value?.departments ?? [])
      if (!salesDepartmentsOnly) return tree
      const salesChildren = (nodes: typeof tree): typeof tree => nodes.flatMap(row =>
        row.departmentName.trim() === '销售部' ? row.children : salesChildren(row.children))
      return salesChildren(tree)
    }),
    creatorOptions: computed(() => options.value?.creators ?? []),
    employeeOptions, employeeLoading, optionError, searchEmployees,
    loadOptions: () => searchEmployees(''), productSources,
    areaTreeProps: { value: 'code', label: 'name', children: 'children' },
    departmentTreeProps: { value: 'id', label: 'departmentName', children: 'children' },
    areaLabel: (code?: string | null, name?: string | null) =>
      name?.trim() || options.value?.areas.find(row => row.code === code)?.name || code || '-',
    employeeLabel: (code?: string | null, name?: string | null) =>
      name?.trim() || options.value?.employees.find(row => row.employeeCode === code)?.employeeName || code || '-',
  }
}
