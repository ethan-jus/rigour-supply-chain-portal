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
export interface TargetOverride {
  dimensionType: TargetDimension
  code: string
  metric: TargetMetric
  value: number | string
  revision: number
  deleted: boolean
  updatedBy: string | null
  updatedAt: string | null
}
export interface TargetDefault {
  dimensionType: TargetDimension
  effectiveMonth: string
  metric: TargetMetric
  value: number | string
  revision: number
}
export interface TargetSettings {
  month: string
  subjects: TargetSubject[]
  overrides: TargetOverride[]
  defaults: TargetDefault[]
  defaultsWritable: boolean
}
export interface TargetChange {
  dimensionType: TargetDimension
  code: string
  metric: TargetMetric
  value: string | null
  expectedRevision: number
}
export interface TargetBatch {
  month: string
  changes: TargetChange[]
  reason: string
}
export interface DefaultBatch {
  effectiveMonth: string
  dimensionType: TargetDimension
  changes: { metric: TargetMetric; value: string; expectedRevision: number }[]
  reason: string
}
export interface TargetHistory {
  metric: TargetMetric
  value: number | string
  deleted: boolean
  revision: number
  reason: string
  actor: string
  occurredAt: string
}
const root = '/analytics/supply/target-settings'
const options = { stayOnUnauthorized: true }
export const getTargetSettings = (month: string) =>
  apiClient.get<TargetSettings>(root, { ...options, params: { month } })
export const saveTargetSettings = (command: TargetBatch) =>
  apiClient.put<void>(root, command, options)
export const saveTargetDefaults = (command: DefaultBatch) =>
  apiClient.put<void>(`${root}/defaults`, command, options)
export const getTargetHistory = (month: string, dimensionType: TargetDimension, code: string) =>
  apiClient.get<TargetHistory[]>(`${root}/history`, {
    ...options,
    params: { month, dimensionType, code },
  })
