import { apiClient } from './client'

export interface SupplyDashboardQuery {
  from?: string
  to?: string
  regionCode?: string
  ownerStaffCode?: string
  customerTypeCode?: string
  productCategoryId?: string | number
  sourceSystemCode?: string
}

export interface SupplyDashboardMetricCard {
  metricCode: string
  metricName: string
  value: number
  unit: string
  previousValue: number | null
  changeRate: number | null
  description: string | null
}

export interface SupplyDashboardTrendPoint {
  metricCode: string
  period: string
  value: number
  secondaryValue: number
}

export interface SupplyDashboardRankingItem {
  rankType: string
  dimensionCode: string
  dimensionName: string
  regionCode: string | null
  regionName: string | null
  /** HR 员工当前归属；不参与订单城市筛选。 */
  currentRegionName?: string | null
  /** 所选期间及筛选范围内的订单城市。 */
  orderRegionNames?: string[]
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
  orderCount: number
  customerCount: number
  rate: number
}

export interface SupplyDashboardSalesMonthlyPerformance {
  period: string
  ownerStaffCode: string
  ownerStaffName: string
  regionCode: string | null
  regionName: string | null
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
  orderCount: number
  customerCount: number
  rate: number
}

export interface SupplyDashboardPaymentAgingBucket {
  bucketCode: string
  bucketName: string
  orderCount: number
  customerCount: number
  unpaidAmount: number
}

export interface SupplyDashboardCityCostItem {
  regionCode: string
  regionName: string | null
  costAmount: number
  budgetAmount: number
  varianceAmount: number
  salesAmount: number
  costRate: number
  recordCount: number
  latestCostTime: string | null
}

export interface SupplyDashboardProductSalesItem {
  rankType: string
  dimensionCode: string
  dimensionName: string
  categoryCode: string
  categoryName: string
  salesQuantity: number
  salesAmount: number
  discountAmount: number
  refundAmount: number
  salesNetAmount: number
  estimatedCostAmount: number
  estimatedGrossProfit: number
  estimatedGrossProfitRate: number
  costCoverageRate: number
  orderCount: number
  customerCount: number
}

export interface SupplyDashboardCustomerSegmentItem {
  segmentCode: string
  segmentName: string
  customerCount: number
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
  averageActivityScore: number
  churnRiskCustomerCount: number
}

export interface SupplyDashboardCustomerActivityItem {
  customerCode: string
  customerName: string
  regionCode: string | null
  regionName: string | null
  ownerStaffCode: string | null
  ownerStaffName: string | null
  customerTypeCode: string | null
  customerTypeName: string | null
  segmentCode: string
  segmentName: string
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
  orderCount: number
  paymentCount: number
  lastOrderTime: string | null
  lastPaymentTime: string | null
  inactiveDays: number
  activityScore: number
  churnRiskLevel: string
}

export interface SupplyDashboardTargetCompletionItem {
  dimensionType: string
  dimensionCode: string
  dimensionName: string
  metricCode: string
  metricName: string
  targetValue: number
  actualValue: number
  achievementRate: number
  configuredMonthCount?: number | null
  periodMonthCount?: number | null
}

export interface SupplyDashboardInventoryItemSummary {
  categoryCode: string
  categoryName: string
  unitCode: string
  procurementQuantity: number
  shippedQuantity: number
  remainingQuantity: number
  inactiveRemainingQuantity: number
}

export interface SupplyDashboardInventoryReplenishmentItem {
  categoryCode: string
  categoryName: string
  productCode: string
  productName: string
  unitCode: string
  salesQuantity: number
  dailySalesQuantity: number
  availableQuantity: number
  inTransitQuantity: number
  coverageDays: number
  suggestedProcurementQuantity: number
  riskLevel: string
  inventoryStatus: string
}

export interface SupplyDashboardRiskItem {
  riskType: string
  riskLevel: string
  dimensionCode: string
  dimensionName: string
  description: string
  primaryValue: number
  secondaryValue: number
  observedAt: string | null
}

export interface SupplyDashboardDataFreshness {
  sourceCode: string
  sourceName: string
  latestUpdatedTime: string | null
  status: string
  description: string | null
}

export interface SupplyDashboardMetricDefinition {
  metricCode: string
  metricName: string
  formula: string
  source: string
  owner: string
  version: string
  exclusionRule: string
  updatedAt: string
  dataCutoffTime: string | null
}

export interface SupplyDashboardRolePerspective {
  roleCode: string
  roleName: string
  primaryMetricCodes: string[]
  primarySectionCodes: string[]
  description: string
}

export interface SupplyDashboardOverview {
  from: string
  to: string
  generatedAt: string
  metrics: SupplyDashboardMetricCard[]
  salesTrend: SupplyDashboardTrendPoint[]
  collectionTrend: SupplyDashboardTrendPoint[]
  cityCostTrend: SupplyDashboardTrendPoint[]
  citySalesRanking: SupplyDashboardRankingItem[]
  salesRanking: SupplyDashboardRankingItem[]
  salesMonthlyPerformance: SupplyDashboardSalesMonthlyPerformance[]
  cityCollectionRateRanking: SupplyDashboardRankingItem[]
  sourceSystemBreakdown: SupplyDashboardRankingItem[]
  productSalesRanking: SupplyDashboardProductSalesItem[]
  skuSalesRanking: SupplyDashboardProductSalesItem[]
  categorySalesRanking: SupplyDashboardProductSalesItem[]
  brandSalesRanking: SupplyDashboardProductSalesItem[]
  paymentRiskCityRanking: SupplyDashboardRankingItem[]
  paymentRiskSalesRanking: SupplyDashboardRankingItem[]
  paymentAgingBuckets: SupplyDashboardPaymentAgingBucket[]
  cityTargetCompletions: SupplyDashboardTargetCompletionItem[]
  salesTargetCompletions: SupplyDashboardTargetCompletionItem[]
  customerSegments: SupplyDashboardCustomerSegmentItem[]
  customerActivityRanking: SupplyDashboardCustomerActivityItem[]
  customerChurnRiskRanking: SupplyDashboardCustomerActivityItem[]
  inventoryItemSummary: SupplyDashboardInventoryItemSummary[]
  inventoryReplenishment: SupplyDashboardInventoryReplenishmentItem[]
  cityCostRanking: SupplyDashboardCityCostItem[]
  risks: SupplyDashboardRiskItem[]
  freshness: SupplyDashboardDataFreshness[]
  rolePerspectives: SupplyDashboardRolePerspective[]
  definitions: SupplyDashboardMetricDefinition[]
}

export interface SupplyDashboardRefreshRun {
  id: number | null
  jobCode: string
  tenantId: string
  statusCode: string
  startedTime: string
  completedTime: string | null
  watermarkTime: string | null
  pulledCount: number
  upsertedCount: number
  skippedCount: number
  failureReason: string | null
}

export type SupplyDashboardRefreshSourceCode =
  | 'CRM_CUSTOMER'
  | 'ORDER_SALES_ORDER'
  | 'ORDER_SALES_ORDER_LINE'
  | 'ERP_PRODUCT'
  | 'ORDER_PAYMENT_RECORD'
  | 'ERP_STOCK_BALANCE'
  | 'ERP_INVENTORY_OPERATION'
  | 'BI_RECONCILIATION_CURRENT'
  | 'HR_EMPLOYEE'
  | 'SALES_SUBMITTED_VISIT'

export interface SupplyDashboardRefreshCommand {
  sourceCodes?: SupplyDashboardRefreshSourceCode[]
  fullRefresh?: boolean
}

export interface SupplyDashboardCityCostImportRecord {
  regionCode: string
  regionName?: string | null
  costTypeCode: string
  costTypeName?: string | null
  costDate: string
  costAmount: number
  budgetAmount?: number | null
  sourceRecordId: string
  remark?: string | null
}

export interface SupplyDashboardCityCostImportCommand {
  sourceSystemCode?: string | null
  records: SupplyDashboardCityCostImportRecord[]
}

export interface SupplyDashboardCityCostImportResult {
  receivedCount: number
  upsertedCount: number
  importedAt: string
}

export interface SupplyDashboardDataTrustSource {
  sourceCode: string
  sourceName: string
  checkpointWatermarkTime: string | null
  lastSuccessTime: string | null
  checkpointStatus: string
  lastRunId: number | null
  lastRunStatus: string | null
  lastRunStartedTime: string | null
  lastRunCompletedTime: string | null
  pulledCount: number
  upsertedCount: number
  skippedCount: number
  delayMinutes: number
  delayLevel: string
  failureReason: string | null
  description: string
}

export interface SupplyDashboardDataTrust {
  generatedAt: string
  overallStatus: string
  overallDescription: string
  latestRefreshRun: SupplyDashboardRefreshRun | null
  sources: SupplyDashboardDataTrustSource[]
}

export interface SupplyDashboardReconciliationItem {
  subjectCode: string
  subjectName: string
  sourceRowCount: number
  businessRowCount: number
  biRowCount: number
  sourceAmount: number
  businessAmount: number
  biAmount: number
  sourceBusinessRowDiff: number
  sourceBusinessAmountDiff: number
  businessBiRowDiff: number
  businessBiAmountDiff: number
  status: string
  description: string
}

export interface SupplyDashboardReconciliation {
  from: string
  to: string
  generatedAt: string
  status: string
  items: SupplyDashboardReconciliationItem[]
}

export interface SupplyDashboardFilterOption {
  optionType: string
  optionValue: string
  optionLabel: string
  usageCount: number
  parentOptionValue?: string | null
  categoryLevel?: number | null
  ordinal?: number | null
}

export interface SupplyDashboardFilterOptions {
  regions: SupplyDashboardFilterOption[]
  salesOwners: SupplyDashboardFilterOption[]
  customerTypes: SupplyDashboardFilterOption[]
  productCategories: SupplyDashboardFilterOption[]
  sourceSystems: SupplyDashboardFilterOption[]
}

export interface SupplyDashboardFeishuArchiveCommand {
  archiveCode: string
  tableId: string
  viewId?: string | null
  tableName: string
  fileName: string
  fileFormat: 'CSV' | 'XLSX'
  exportedBy: string
  exportedTime: string
  frozenTime: string
  recordCount: number
  checksumSha256: string
  storageUri?: string | null
  fieldMappingUri?: string | null
  reconciliationReportUri?: string | null
  remark?: string | null
}

export interface SupplyDashboardFeishuArchive {
  id: number
  archiveCode: string
  tableId: string
  viewId: string | null
  tableName: string
  fileName: string
  fileFormat: string
  exportedBy: string
  exportedTime: string
  frozenTime: string
  recordCount: number
  checksumSha256: string
  storageUri: string | null
  fieldMappingUri: string | null
  reconciliationReportUri: string | null
  archiveStatusCode: string
  remark: string | null
  createdTime: string
  updatedTime: string
}

const SUPPLY_DASHBOARD_PATH = '/analytics/supply/dashboard/overview'
export interface SupplyDashboardOperatingAnalysis {
  from: string
  to: string
  generatedAt: string
  previousFrom: string
  previousTo: string
  previousSalesRanking: SupplyDashboardRankingItem[]
  cityProducts: {
    regionCode: string | null
    regionName: string | null
    categoryCode: string
    categoryName: string
    salesAmount: number
    orderCount: number
    customerCount: number
  }[]
  cityCustomers: {
    regionCode: string | null
    regionName: string | null
    orderingCustomerCount: number
    repeatCustomerCount: number
  }[]
  salesReceipts: {
    ownerStaffCode: string
    ownerStaffName: string
    paidAmount: number
    paymentCount: number
    customerCount: number
  }[]
}

export const getSupplyDashboardOperatingAnalysis = (params: SupplyDashboardQuery) =>
  apiClient.get<SupplyDashboardOperatingAnalysis>(
    '/analytics/supply/dashboard/operating-analysis',
    { params, ...options },
  )
const SUPPLY_DASHBOARD_REFRESH_PATH = '/analytics/supply/dashboard/refresh-runs'
const SUPPLY_DASHBOARD_TRUST_PATH = '/analytics/supply/dashboard/trust'
const SUPPLY_DASHBOARD_RECONCILIATION_PATH = '/analytics/supply/dashboard/reconciliation'
const SUPPLY_DASHBOARD_FILTER_OPTIONS_PATH = '/analytics/supply/dashboard/filter-options'
const SUPPLY_DASHBOARD_CITY_COST_IMPORT_PATH = '/analytics/supply/city-cost-records/import'
const SUPPLY_DASHBOARD_FEISHU_ARCHIVES_PATH = '/analytics/supply/legacy/feishu-archives'
const options = { stayOnUnauthorized: true }

export const getSupplyDashboardOverview = (params: SupplyDashboardQuery) =>
  apiClient.get<SupplyDashboardOverview>(SUPPLY_DASHBOARD_PATH, { params, ...options })

export const createSupplyDashboardRefreshRun = (command: SupplyDashboardRefreshCommand = {}) =>
  apiClient.post<SupplyDashboardRefreshRun>(SUPPLY_DASHBOARD_REFRESH_PATH, command, options)

export const getSupplyDashboardDataTrust = () =>
  apiClient.get<SupplyDashboardDataTrust>(SUPPLY_DASHBOARD_TRUST_PATH, options)

export const getSupplyDashboardReconciliation = (params: SupplyDashboardQuery = {}) =>
  apiClient.get<SupplyDashboardReconciliation>(SUPPLY_DASHBOARD_RECONCILIATION_PATH, {
    params,
    ...options,
  })

export const getSupplyDashboardFilterOptions = () =>
  apiClient.get<SupplyDashboardFilterOptions>(SUPPLY_DASHBOARD_FILTER_OPTIONS_PATH, options)

export const importSupplyDashboardCityCostRecords = (
  command: SupplyDashboardCityCostImportCommand,
) =>
  apiClient.post<SupplyDashboardCityCostImportResult>(
    SUPPLY_DASHBOARD_CITY_COST_IMPORT_PATH,
    command,
    options,
  )

export const getSupplyDashboardFeishuArchives = () =>
  apiClient.get<SupplyDashboardFeishuArchive[]>(SUPPLY_DASHBOARD_FEISHU_ARCHIVES_PATH, options)

export const registerSupplyDashboardFeishuArchive = (
  command: SupplyDashboardFeishuArchiveCommand,
) =>
  apiClient.post<SupplyDashboardFeishuArchive>(
    SUPPLY_DASHBOARD_FEISHU_ARCHIVES_PATH,
    command,
    options,
  )
