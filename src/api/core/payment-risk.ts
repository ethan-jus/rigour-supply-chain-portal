import { apiClient } from './client'

export type PaymentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE' | 'UNKNOWN'
export interface PaymentRiskCategory {
  id: string
  parentId: string | null
  name: string
}
export interface PaymentRiskProduct {
  categoryId: string | null
  categoryName: string | null
  productId: string | null
  productName: string | null
  riskLevel: PaymentRiskLevel
  productAmount: number
}
export interface PaymentRiskOrder {
  orderId: string
  orderNo: string
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerStaffCode: string | null
  ownerStaffName: string | null
  orderDate: string
  ageDays: number
  orderAmount: number
  paidAmount: number
  products: PaymentRiskProduct[]
}
export interface PaymentRiskData {
  generatedAt: string
  dataUpdatedAt: string | null
  categories: PaymentRiskCategory[]
  orders: PaymentRiskOrder[]
}
export const getPaymentRisk = (params: {
  from: string
  to: string
  regionCode?: string
  ownerStaffCode?: string
  productCategoryIds?: string[]
  riskLevel?: PaymentRiskLevel
}) =>
  apiClient.get<PaymentRiskData>('/analytics/supply/dashboard/payment-risk', {
    params,
    paramsSerializer: { indexes: null },
    stayOnUnauthorized: true,
  })
