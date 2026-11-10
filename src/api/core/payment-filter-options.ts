import { apiClient } from './client'

export interface PaymentFilterOptions {
  areas: { code: string; name: string }[]
  departments: { id: number; parentId: number | null; departmentName: string; sortOrder: number }[]
  employees: { employeeCode: string; employeeName: string; regionCode: string | null }[]
  creators: string[]
  categories: { id: string; parentId: string | null; categoryName: string }[]
  products: { id: string; productCode: string; productName: string; categoryId: string | null;
    variants: { id: string; specificationSnapshot: string | null }[] }[]
}

export const getPaymentFilterOptions = () =>
  apiClient.get<PaymentFilterOptions>('/orders/register/payments/filter-options', { stayOnUnauthorized: true })
