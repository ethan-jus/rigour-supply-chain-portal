import { apiClient } from './client'

import type { ProductUnitConfig } from '@/utils/product-unit'
export type RegisterPage = 'orders' | 'lines' | 'payments'
export interface PaymentFilterOptions {
  areas: { code: string; name: string }[]
  departments: { id: number; parentId: number | null; departmentName: string; sortOrder: number }[]
  employees: { employeeCode: string; employeeName: string; regionCode: string | null }[]
  paymentEmployees?: PaymentFilterOptions['employees']
  creators: string[]
  categories: { id: string; parentId: string | null; categoryName: string }[]
  products: (Partial<ProductUnitConfig> & { mainImageUrl?: string | null; id: string; productCode: string; productName: string; categoryId: string | null;
    variants: { id: string; specificationSnapshot: string | null }[] })[]
}

export const getPaymentFilterOptions = (page: RegisterPage = 'payments') =>
  apiClient.get<PaymentFilterOptions>(`/orders/register/${page}/filter-options`, { stayOnUnauthorized: true })
