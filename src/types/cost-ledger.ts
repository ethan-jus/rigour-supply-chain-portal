export interface LedgerParty {
  pointCode: string
  partyTypeCode: 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'OTHER'
  partyCode: string | null
  manualName: string | null
  displayName?: string | null
  contactName: string
  phone: string
  address: string
  cityCode: string
}
export interface LedgerFee {
  feeKey: string
  feeTypeCode: string
  feeAmount: number | null
  bearerCode: string
  ourAmount: number | null
  allocationMethodCode: string
  zeroCostReason: string
  remark: string
  basisUnitCode?: string | null
}
export interface LedgerAllocation {
  feeKey: string
  receivingPointCode: string
  cityCode: string
  basis: number | null
  amount: number | null
}
export interface LedgerSource {
  documentAmount?: number | null
  documentDate?: string | null
  linkedAt?: string | null
  employeeCode?: string | null
  employeeName?: string | null
  departmentId?: number | null
  departmentName?: string | null
  sourceWarehouseCode?: string | null
  orderTypeCode: string
  orderCode: string | null
  linkRoleCode: 'COST' | 'TRACE'
  allocations: LedgerAllocation[]
  noSourceReason?: string
}
export interface LogisticsLedger {
  platformOrderNo?: string | null
  schemaVersion: 2
  sourceSync?: {
    originBizKey: string
    originVersion: number
    lastAppliedFingerprint: string
    manuallyChanged: boolean
    lastSeenVersion: number
    lastSeenFingerprint: string
    differencePending: boolean
  } | null
  driverName?: string | null
  vehicleNo?: string | null
  transportPurposeCode: string
  deliveryModeCode: string
  carrierCode: string | null
  costMonth: string
  trackingNo: string
  transportMethodCode: string | null
  sender: LedgerParty
  receivingPoints: LedgerParty[]
  feeItems: LedgerFee[]
  sources: LedgerSource[]
  nonSalesPurposeCode: string
  noTrackingReason: string
  noSourceReason: string
  scopeWarehouseIds?: number[]
  scopeCityCodes?: string[]
}
export interface WarehouseLedgerFee {
  feeKey: string
  feeTypeCode: string
  quantity: number | null
  unitCode: string | null
  unitPrice: number | null
  feeAmount: number | null
  allocationMethodCode: string
  attributionDate: string | null
  serviceFrom: string | null
  serviceTo: string | null
  monthAllocations: { month: string; amount: number | null }[]
  remark: string
}
export interface WarehouseLedger {
  schemaVersion: 2
  warehouseCode: string | null
  serviceProviderCode: string | null
  paymentDate: string | null
  depositAmount: number | null
  contractNo: string
  feeItems: WarehouseLedgerFee[]
}
