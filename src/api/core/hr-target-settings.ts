import { apiClient } from './client'
export type TargetDimension = 'CITY' | 'SALES_OWNER'
export type TargetMetric = 'SALES_AMOUNT' | 'RECEIPT_AMOUNT' | 'NEW_CUSTOMER' | 'REPEAT_CUSTOMER'
export interface TargetSubject {
  dimensionType: TargetDimension
  code: string
  name: string
  cityCode: string | null
  cityName: string | null
  departmentName: string | null
  employmentStatus: string | null
  writable: boolean
}
export interface TargetValue {
  month: string
  dimensionType: TargetDimension
  code: string
  name: string
  metric: TargetMetric
  value: number | string
  revision: number
}
export interface TargetSettings {
  month: string
  subjects: TargetSubject[]
  targets: TargetValue[]
}
export interface TargetChange {
  dimensionType: TargetDimension
  code: string
  metric: TargetMetric
  value: string
  expectedRevision: number
}
export interface TargetBatch {
  month: string
  changes: TargetChange[]
  reason: string
}
export interface TargetHistory {
  metric: TargetMetric
  value: number | string
  revision: number
  reason: string
  actor: string
  occurredAt: string
}
const root = '/hr/target-settings'
const options = { stayOnUnauthorized: true }
export const getTargetSettings = (month: string) =>
  apiClient.get<TargetSettings>(root, { ...options, params: { month } })
export const saveTargetSettings = (command: TargetBatch) =>
  apiClient.put<void>(root, command, options)
export const getTargetHistory = (month: string, dimensionType: TargetDimension, code: string) =>
  apiClient.get<TargetHistory[]>(`${root}/history`, {
    ...options,
    params: { month, dimensionType, code },
  })
