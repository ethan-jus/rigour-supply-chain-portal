import { apiClient } from './client'
export const agingLabels: Record<string, string> = {
  CURRENT: '未到期及当日',
  D1_30: '逾期 1–30 天',
  D31_60: '逾期 31–60 天',
  D61_90: '逾期 61–90 天',
  OVER90: '超过 90 天',
  UNKNOWN: '到期日待核',
}
export interface Balance {
  orderId: string
  orderNo: string
  customerId: string
  customer: string
  region: string | null
  owner: string | null
  regionCode: string | null
  employeeCode: string | null
  installment: number
  dueDate: string | null
  dueSource: string
  followOwner?: string | null
  promisedOn?: string | null
  disputed?: boolean | null
  followedAt?: string | null
  nextDue?: string | null
  followNote?: string | null
  original: number
  installmentAmount: number
  paid: number
  remaining: number
  aging: string
  overdueDays: number | null
}
export interface CashReceipt {
  key: string
  reference: string
  customerId: string | null
  customer: string | null
  date: string
  kind: string
  channel?: string | null
  payee?: string | null
  ownerCode?: string | null
  verifiedAt?: string | null
  verified: boolean
  amount: number
  allocated: number
  available: number
}
export interface Allocation {
  id: string
  cashKey: string
  reference: string
  orderId: string
  orderNo: string
  date: string
  amount: number
}
export interface ReceivablesReport {
  from: string
  asOf: string
  projectedAt: string
  version: string
  completeCashScope: boolean
  coverageStart: string | null
  totals: {
    receipts: number
    refunds: number
    net: number
    cumulativeReceipts: number
    cumulativeNet: number
    unapplied: number | null
    pending: number
    opening: number
    newReceivables: number
    applied: number
    adjustments: number
    outstanding: number
    overdue: number
    dueSoon: number
    missingDue: number
    openOrderAmount: number
  }
  cashGroups?: {
    dimension: string
    label: string
    received: number
    refunded: number
    net: number
  }[]
  aging: { code: string; amount: number }[]
  customers: {
    id: string | null
    name: string | null
    receipts: number
    cumulativeReceipts: number
    unpaid: number
    overdue: number
    unapplied: number
  }[]
  balances: Balance[]
  receipts: CashReceipt[]
  applications: Allocation[]
  customerCount: number
  balanceCount: number
  receiptCount: number
  applicationCount: number
}
export interface ReceivableQuery {
  from: string
  asOf: string
  page: number
  size: number
  regionCode?: string
  ownerStaffCode?: string
  customerId?: string
  aging?: string
  collector?: string
  disputed?: boolean
}
export const getReceivables = (params: ReceivableQuery, signal?: AbortSignal) =>
  apiClient.get<ReceivablesReport, ReceivablesReport>('/analytics/supply/dashboard/receivables', {
    params,
    signal,
    cacheBypass: true,
    errorFeedback: 'inline',
  })

const archives = '/analytics/supply/dashboard/receivables/archives'
export interface ReportRevision {
  version: string
  archivedAt: string
}
export const getReportRevisions = (from: string, asOf: string) =>
  apiClient.get<ReportRevision[], ReportRevision[]>(archives, {
    params: { from, asOf },
    cacheBypass: true,
    errorFeedback: 'inline',
  })
export const archiveReport = (from: string, asOf: string) =>
  apiClient.post<string, string>(archives, null, {
    params: { from, asOf },
    errorFeedback: 'inline',
  })
export const getArchivedReport = (v: string, q: ReceivableQuery, signal?: AbortSignal) =>
  apiClient.get<ReceivablesReport, ReceivablesReport>(archives + '/' + encodeURIComponent(v), {
    params: {
      from: q.from,
      asOf: q.asOf,
      aging: q.aging,
      collector: q.collector,
      disputed: q.disputed,
      page: q.page,
      size: q.size,
    },
    signal,
    cacheBypass: true,
    errorFeedback: 'inline',
  })
