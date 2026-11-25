import { computed, ref } from 'vue'
import { getPaymentFilterOptions, type RegisterPage, type PaymentFilterOptions } from '@/api/core/payment-filter-options'
import { departmentTree } from '@/utils/hr-department-tree'
import type { OrderProductFilterSources } from './useOrderProductFilters'

/** 回款页不依赖用户具有 HR、CRM 或商品管理权限。 */
export function usePaymentFilterOptions(page: RegisterPage = 'payments') {
  const options = ref<PaymentFilterOptions | null>(null)
  const employeeOptions = ref<PaymentFilterOptions['employees']>([])
  const employeeLoading = ref(false)
  const optionError = ref('')
  let pending: Promise<PaymentFilterOptions> | undefined
  function fetchOptions() {
    if (options.value) return Promise.resolve(options.value)
    if (!pending) pending = getPaymentFilterOptions(page).then(value => {
      options.value = value
      return value
    }).finally(() => { pending = undefined })
    return pending
  }
  async function searchEmployees(keyword = '') {
    employeeLoading.value = true
    try {
      const data = await fetchOptions()
      const text = keyword.trim().toLocaleLowerCase()
      employeeOptions.value = [...new Map(data.employees
        .filter(row => !text || `${row.employeeName} ${row.employeeCode}`.toLocaleLowerCase().includes(text))
        .map(row => [row.employeeCode, row])).values()]
    } catch (e) { optionError.value = e instanceof Error ? e.message : '回款筛选选项加载失败' }
    finally { employeeLoading.value = false }
  }
  const collectorKeyword = ref('')
  async function searchCollectors(keyword = '') {
    collectorKeyword.value = keyword.trim().toLocaleLowerCase()
    try { await fetchOptions() } catch (e) { optionError.value = e instanceof Error ? e.message : '回款人加载失败' }
  }
  const collectorOptions = computed(() => (options.value?.paymentEmployees ?? []).filter(row =>
    `${row.employeeName} ${row.employeeCode}`.toLocaleLowerCase().includes(collectorKeyword.value)))
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
      return tree
    }),
    creatorOptions: computed(() => options.value?.creators ?? []),
    employeeOptions, employeeLoading, optionError, searchEmployees, collectorOptions, searchCollectors,
    loadOptions: () => searchEmployees(''), productSources,
    areaTreeProps: { value: 'code', label: 'name', children: 'children' },
    departmentTreeProps: { value: 'id', label: 'departmentName', children: 'children' },
    displayProducts: async () => (await fetchOptions()).products,
    departmentLabel: (id?: number | null, name?: string | null) =>
      name?.trim() || options.value?.departments.find(row => String(row.id) === String(id))?.departmentName || (id == null ? '归属待核' : String(id)),
    areaLabel: (code?: string | null, name?: string | null) =>
      name?.trim() || options.value?.areas.find(row => row.code === code)?.name || code || '-',
    employeeLabel: (code?: string | null, name?: string | null) =>
      name?.trim() || options.value?.employees.find(row => row.employeeCode === code)?.employeeName || code || '-',
  }
}
