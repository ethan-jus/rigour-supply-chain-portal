import { apiClient } from './client'
import type { FundDocumentAttachment } from './order-sales'

/**
 * 订单注册读接口（V2）。
 *
 * BASE /api/v1/orders/register，契约见 outputs/order-v2-20260917 下的
 * implementation-plan.md 与 backend-design.md。后端尚未联调时，页面按本文件的
 * camelCase 契约实现，并保留 mock/合约测试。
 */
export const ORDER_REGISTER_BASE_PATH = '/orders/register'

/** 历史覆盖提示；缺失范围明确标识，不把未知历史当作零余额。 */
export interface OrderRegisterCoverage {
  historyComplete?: boolean | null
  coverageFrom?: string | null
  message?: string | null
}

export interface OrderRegisterCommonQuery {
  begin: number
  step: number
  orderNo?: string
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
  orderDateFrom?: string
  orderDateTo?: string
  createdBy?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export interface OrderRegisterOrderQuery extends OrderRegisterCommonQuery {
  orderStatusCode?: string
  paymentStatusCode?: string
  hasUnpaid?: boolean
  invoiceStatusCode?: string
  /** 订货宝关联单：true=已关联，false=未关联。 */
  dhbLinked?: boolean
}

export interface OrderRegisterLineQuery extends OrderRegisterCommonQuery {
  productKeyword?: string
  productCode?: string
  /** 商品集合过滤：商品下拉选中的单个商品，或商品分类解析出的商品ID集合。 */
  productIds?: Array<string | number>
}

export interface OrderRegisterPaymentQuery extends OrderRegisterCommonQuery {
  paymentNo?: string
  transactionNo?: string
  paymentStatusCode?: string
  paymentTimeFrom?: string
  paymentTimeTo?: string
}

export interface OrderRegisterOrderItem {
  id: string
  orderNo: string
  legacyOrderNo: string | null
  sourceSystemCode: string | null
  sourceOrderNo: string | null
  /** 订货宝关联单号：来源为订货宝或已映射时展示。 */
  dhbOrderNo: string | null
  orderNumberState: string | null
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderStatusCode: string
  paymentStatusCode: string
  dataQualityStatusCode: string | null
  invoiceStatusCode: string | null
  invoiceStatusName: string | null
  originalAmount: number | null
  payableAmount: number | null
  paidAmount: number | null
  unpaidAmount: number | null
  checkedAmount: number | null
  orderDate: string
  shipmentTime: string | null
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
  syncedBy: string | null
  syncedAt: string | null
  revision: number
}

export interface OrderRegisterOrderTotals {
  originalAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  checkedAmount: number
}

export interface OrderRegisterOrderPage {
  total: number
  begin: number
  step: number
  items: OrderRegisterOrderItem[]
  totals: OrderRegisterOrderTotals
  coverage: OrderRegisterCoverage | null
}

export interface OrderRegisterLineItem {
  id: string
  orderId: string
  orderNo: string
  sourceOrderNo: string | null
  dhbOrderNo: string | null
  sourceSystemCode: string | null
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string
  lineNo: number
  sourceLineId: string | null
  productId: string | null
  productVariantId: string | null
  productCode: string | null
  skuCode: string | null
  productName: string | null
  specification: string | null
  unitCode: string | null
  quantity: number
  unitPrice: number
  lineAmount: number
  /** 分摊到本明细的回款金额：订单实收按「明细金额 / 订单应收」比例分摊，部分回款同样按比例。 */
  receivedAmount: number
  /** 来源系统真实创建/修改人（取所属订单）；无来源时为本系统记录人。 */
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
  syncedBy: string | null
  syncedAt: string | null
}

export interface OrderRegisterLineTotals {
  /** 明细金额：单价×数量逐行合计（折前）。 */
  lineAmount: number
  /** 回款金额：命中明细分摊后的回款合计（订单实收按明细金额比例分摊，部分回款同样按比例）。 */
  receivedAmount?: number
  /** 订单金额：命中订单去重后的折后应收合计。 */
  orderAmount?: number
  /** 客户数：命中明细去重后的客户数。 */
  customerCount?: number
  /** 商品数：命中明细去重后的商品数。 */
  productCount?: number
  /** 数量合计：按来源单位直接合计的数量。 */
  quantitySum?: number
}

export interface OrderRegisterLinePage {
  total: number
  begin: number
  step: number
  items: OrderRegisterLineItem[]
  totals: OrderRegisterLineTotals
  coverage: OrderRegisterCoverage | null
}

export interface OrderRegisterPaymentItem {
  id: string
  paymentNo: string
  sourceRecordId: string | null
  orderId: string
  orderNo: string
  dhbOrderNo: string | null
  customerId: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string | null
  orderAmount: number | null
  paidAmount: number
  paymentStatusCode: string
  paymentTime: string | null
  transactionNo: string | null
  /** 订单登记接口返回原始凭证对象键；attachmentViews 为带短时预览 URL 的附件视图。 */
  attachments: string[]
  attachmentViews?: FundDocumentAttachment[]
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
  syncedBy: string | null
  syncedAt: string | null
  checkedBy: string | null
  checkedAt: string | null
  revision: number
}

export interface OrderRegisterPaymentTotals {
  receivedAmount: number
  checkedAmount: number
  pendingDocumentAmount: number
  cancelledDocumentAmount: number
  relatedOrderAmount: number
}

export interface OrderRegisterPaymentPage {
  total: number
  begin: number
  step: number
  items: OrderRegisterPaymentItem[]
  totals: OrderRegisterPaymentTotals
  coverage: OrderRegisterCoverage | null
}

export type OrderPeriodGroupBy = 'region' | 'customer' | 'employee'

export interface OrderPeriodQuery {
  dateFrom: string
  dateTo: string
  groupBy?: OrderPeriodGroupBy
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
}

export interface OrderPeriodRow {
  key: string
  label: string
  periodOrderAmount: number
  periodReceivedAmount: number
  periodRefundAmount: number
  periodNetReceivedAmount: number
  endingUnpaidAmount: number
}

export interface OrderPeriodTotals {
  periodOrderAmount: number
  periodReceivedAmount: number
  periodRefundAmount: number
  periodNetReceivedAmount: number
  endingUnpaidAmount: number
}

export interface OrderPeriodView {
  dateFrom: string
  dateTo: string
  groupBy: OrderPeriodGroupBy
  totals: OrderPeriodTotals
  rows: OrderPeriodRow[]
  coverage: OrderRegisterCoverage | null
}

export interface OrderReceivablesQuery {
  asOfDate: string
  hasUnpaid?: boolean
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
  orderDateFrom?: string
  orderDateTo?: string
}

export interface OrderReceivablesRow {
  orderId: string
  orderNo: string
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string
  receivableAmount: number | null
  netReceivedAmount: number | null
  unpaidAmount: number | null
  overpaidAmount: number | null
  historyComplete: boolean | null
  coverageFrom: string | null
}

export interface OrderReceivablesTotals {
  receivableAmount: number | null
  netReceivedAmount: number | null
  unpaidAmount: number | null
  overpaidAmount: number | null
}

export interface OrderReceivablesView {
  asOfDate: string
  totals: OrderReceivablesTotals
  items: OrderReceivablesRow[]
  coverage: OrderRegisterCoverage | null
}

const readOptions = { stayOnUnauthorized: true }

export const getOrderRegisterOrders = (params: OrderRegisterOrderQuery) =>
  apiClient.get<OrderRegisterOrderPage>(`${ORDER_REGISTER_BASE_PATH}/orders`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterLines = (params: OrderRegisterLineQuery) =>
  apiClient.get<OrderRegisterLinePage>(`${ORDER_REGISTER_BASE_PATH}/lines`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterPayments = (params: OrderRegisterPaymentQuery) =>
  apiClient.get<OrderRegisterPaymentPage>(`${ORDER_REGISTER_BASE_PATH}/payments`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterPeriod = (params: OrderPeriodQuery) =>
  apiClient.get<OrderPeriodView>(`${ORDER_REGISTER_BASE_PATH}/statistics/period`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterReceivables = (params: OrderReceivablesQuery) =>
  apiClient.get<OrderReceivablesView>(`${ORDER_REGISTER_BASE_PATH}/statistics/receivables`, {
    params,
    ...readOptions,
  })

/** 创建人下拉数据源；契约补充项，后端尚未实现时页面降级为空列表并提示。 */
export const getOrderRegisterCreators = () =>
  apiClient.get<string[]>(`${ORDER_REGISTER_BASE_PATH}/creators`, readOptions)

export type OrderRegisterExportKind = 'orders' | 'lines' | 'payments' | 'period' | 'receivables'

export function exportOrderRegisterCsv(
  kind: OrderRegisterExportKind,
  params: Record<string, unknown>,
) {
  const path = kind === 'period'
    ? `${ORDER_REGISTER_BASE_PATH}/statistics/period/export`
    : kind === 'receivables'
      ? `${ORDER_REGISTER_BASE_PATH}/statistics/receivables/export`
      : `${ORDER_REGISTER_BASE_PATH}/${kind}/export`
  return apiClient.get<Blob>(path, {
    params,
    responseType: 'blob',
    timeout: 180000,
    stayOnUnauthorized: true,
  })
}

/** 财务核对回款：写入交易单号（凭证验重）并标记已核对；revision 为乐观锁版本。 */
export const checkOrderRegisterPayment = (
  id: string | number,
  payload: { transactionNo: string; revision: number },
) =>
  apiClient.post<OrderRegisterPaymentItem>(
    `${ORDER_REGISTER_BASE_PATH}/payments/${encodeURIComponent(String(id))}/check`,
    payload,
  )

/** 开票登记接口（V1）；一单一票，发票只按内部订单关联，不参与订货宝同步。 */
export const ORDER_INVOICE_BASE_PATH = '/orders/invoices'

export interface OrderInvoiceAttachment {
  objectKey: string
  fileName: string | null
  url: string | null
}

export interface OrderInvoiceView {
  id: string | number
  orderId: string | number
  orderNo: string
  statusCode: string
  statusName: string
  titleType: string | null
  titleTypeName: string | null
  title: string | null
  taxNo: string | null
  invoiceType: string | null
  invoiceTypeName: string | null
  bankName: string | null
  bankAccount: string | null
  registerAddress: string | null
  registerPhone: string | null
  email: string | null
  remark: string | null
  amount: number | null
  attachments: OrderInvoiceAttachment[]
  invoiceNo: string | null
  appliedBy: string | null
  appliedAt: string | null
  invoicedBy: string | null
  invoicedAt: string | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface OrderInvoiceApplyPayload {
  orderNo: string
  titleType: string
  title: string
  taxNo?: string | null
  invoiceType: string
  bankName?: string | null
  bankAccount?: string | null
  registerAddress?: string | null
  registerPhone?: string | null
  email?: string | null
  remark?: string | null
}

export interface OrderInvoiceCompletePayload {
  invoiceNo: string
  invoicedAt: string
}

export const getOrderInvoice = (orderNo: string) =>
  apiClient.get<OrderInvoiceView | null>(ORDER_INVOICE_BASE_PATH, {
    params: { orderNo },
    ...readOptions,
  })

export const applyOrderInvoice = (payload: OrderInvoiceApplyPayload) =>
  apiClient.post<OrderInvoiceView>(ORDER_INVOICE_BASE_PATH, payload)

export function uploadOrderInvoiceAttachments(id: string | number, files: File[]) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  return apiClient.post<OrderInvoiceView>(`${ORDER_INVOICE_BASE_PATH}/${id}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

export const completeOrderInvoice = (id: string | number, payload: OrderInvoiceCompletePayload) =>
  apiClient.post<OrderInvoiceView>(`${ORDER_INVOICE_BASE_PATH}/${id}/complete`, payload)

export const withdrawOrderInvoice = (id: string | number) =>
  apiClient.post<OrderInvoiceView>(`${ORDER_INVOICE_BASE_PATH}/${id}/withdraw`, {})

/** 发票管理列表行；带出订单客户名，便于财务按客户核对。 */
export interface OrderInvoiceListItem {
  id: string | number
  orderId: string | number
  orderNo: string
  customerName: string | null
  title: string | null
  invoiceTypeName: string | null
  amount: number | null
  statusCode: string
  statusName: string
  appliedBy: string | null
  appliedAt: string | null
  invoiceNo: string | null
  invoicedAt: string | null
  attachmentCount: number
}

export interface OrderInvoicePageView {
  page: {
    total: number
    begin: number
    step: number
    items: OrderInvoiceListItem[]
  }
  statusCounts: Record<string, number>
}

export interface OrderInvoicePageQuery {
  begin: number
  step: number
  status?: string
  orderNo?: string
  customerName?: string
  appliedFrom?: string
  appliedTo?: string
}

export const getOrderInvoicePage = (params: OrderInvoicePageQuery) =>
  apiClient.get<OrderInvoicePageView>(`${ORDER_INVOICE_BASE_PATH}/page`, {
    params,
    ...readOptions,
  })

/** 客户已保存的开票资料；申请弹窗下拉选择与回显，最近使用优先。 */
export interface OrderInvoiceProfile {
  id: string | number
  titleType: string | null
  titleTypeName: string | null
  title: string | null
  taxNo: string | null
  invoiceType: string | null
  invoiceTypeName: string | null
  bankName: string | null
  bankAccount: string | null
  registerAddress: string | null
  registerPhone: string | null
  email: string | null
  remark: string | null
  lastUsedAt: string | null
}

export const getOrderInvoiceProfiles = (orderNo: string) =>
  apiClient.get<OrderInvoiceProfile[]>(`${ORDER_INVOICE_BASE_PATH}/profiles`, {
    params: { orderNo },
    ...readOptions,
  })
