import { reactive } from 'vue'

export interface OrderRegisterCommonFilters {
  orderNo: string
  customerName: string
  customerCode: string
  regionCode: string
  ownerEmployeeCode: string
  departmentId: number | null
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
    filters.createdBy = ''
    filters.orderDateRange = null
  }

  return { filters, resetCommonFilters }
}
