import { reactive } from 'vue'

export interface OrderRegisterCommonFilters {
  orderNo: string
  customerName: string
  customerCode: string
  regionCode: string
  ownerEmployeeCode: string
  departmentId: number | null
  /** 部门筛选是否包含子部门；默认包含。 */
  includeSubDepartments: boolean
  createdBy: string
  orderDateRange: [string, string] | null
}

export function useOrderRegisterCommonFilters() {
  const filters = reactive<OrderRegisterCommonFilters>({
    orderNo: '',
    customerName: '',
    customerCode: '',
    regionCode: '',
    ownerEmployeeCode: '',
    departmentId: null,
    includeSubDepartments: true,
    createdBy: '',
    orderDateRange: null,
  })

  function resetCommonFilters() {
    filters.orderNo = ''
    filters.customerName = ''
    filters.customerCode = ''
    filters.regionCode = ''
    filters.ownerEmployeeCode = ''
    filters.departmentId = null
    filters.includeSubDepartments = true
    filters.createdBy = ''
    filters.orderDateRange = null
  }

  return { filters, resetCommonFilters }
}
