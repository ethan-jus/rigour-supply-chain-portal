import { apiClient } from './client'

export interface ErpPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface ErpManagedProductSummary {
  id: string
  productCode: string
  productName: string
  businessLineName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryNameSnapshot: string | null
  brandId: string | null
  brandName: string | null
  brandNameSnapshot: string | null
  industryName: string | null
  productSpecification: string | null
  unitCode: string | null
  middleUnitCode: string | null
  bigUnitCode: string | null
  baseToMiddleRate: number | null
  baseToBigRate: number | null
  /** 默认统计单位层级：BASE/MIDDLE/BIG；空按基础单位。 */
  statisticsUnitLevel: string | null
  saleTypeCode: string
  shelfStatusCode: string
  ordinal: number
  submitStatusCode: string
  sourceSystemCode: string | null
  sourceDocumentNo: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  defaultWarehouseId: string | null
  defaultWarehouseName: string | null
  defaultSalePrice: number | null
  minOrderQuantity?: number | null
  orderMultipleFlag?: boolean | null
  orderMultipleQuantity?: number | null
  limitQuantity?: number | null
  tagCodes?: string[]
  recommendProductIds?: Array<string | number>
  mainImageKey: string | null
  mainImageUrl: string | null
  variantCount: number
  /** 仅在查询带 withVariants=true 时下发；否则为空数组。 */
  variants: ErpManagedProductVariant[]
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpManagedProductImage {
  imageKey: string
  imageUrl: string | null
  imageTypeCode: string | null
  ordinal: number | null
}

export interface ErpManagedProductVariant {
  id: string
  variantCode: string
  specificationSnapshot: string | null
  unitCode: string | null
  salePrice: number | null
  marketPrice: number | null
  purchasePrice: number | null
  minOrderQuantity: number | null
  orderMultipleQuantity: number | null
  limitQuantity: number | null
  defaultFlag: boolean
  remark: string | null
  revision: number
  updatedTime: string
}

export interface ErpManagedProductDetail extends ErpManagedProductSummary {
  minOrderQuantity: number | null
  orderMultipleFlag: boolean | null
  orderMultipleQuantity: number | null
  sourceStatusName: string | null
  tagCodes: string[]
  limitQuantity: number | null
  images: ErpManagedProductImage[]
  recommendProductIds: Array<string | number>
  sourceFields: Record<string, unknown>
  remark: string | null
}

export interface ErpManagedProductQuery {
  begin: number
  step: number
  productCode?: string
  productName?: string
  categoryId?: string | number
  brandId?: string | number
  unitCode?: string
  saleTypeCode?: string
  shelfStatusCode?: string
  submitStatusCode?: string
  defaultWarehouseId?: string | number
  /** 为 true 时列表行额外携带规格明细，用于列表就地展开规格。 */
  withVariants?: boolean
  /** 按商品ID批量核对（明细页批量取主图与单位配置）；单次最多 200 个。 */
  productIds?: Array<string | number>
}

export interface ErpManagedProductImageCommand {
  imageKey: string
  imageTypeCode?: string | null
  ordinal?: number | null
}

export interface ErpManagedProductVariantCommand {
  id?: string | number | null
  specificationSnapshot?: string | null
  unitCode?: string | null
  salePrice?: number | null
  marketPrice?: number | null
  purchasePrice?: number | null
  minOrderQuantity?: number | null
  orderMultipleQuantity?: number | null
  limitQuantity?: number | null
  defaultFlag?: boolean | null
  remark?: string | null
}

export interface ErpManagedProductCommand {
  submit?: boolean | null
  productName?: string | null
  categoryId?: string | number | null
  brandId?: string | number | null
  productSpecification?: string | null
  unitCode?: string | null
  middleUnitCode?: string | null
  baseToMiddleRate?: number | null
  bigUnitCode?: string | null
  baseToBigRate?: number | null
  /** 默认统计单位层级：BASE/MIDDLE/BIG；空按基础单位。 */
  statisticsUnitLevel?: string | null
  minOrderQuantity?: number | null
  orderMultipleFlag?: boolean | null
  orderMultipleQuantity?: number | null
  saleTypeCode?: string | null
  shelfStatusCode?: string | null
  ordinal?: number | null
  tagCodes?: string[] | null
  limitQuantity?: number | null
  defaultWarehouseId?: string | number | null
  images?: ErpManagedProductImageCommand[] | null
  variants?: ErpManagedProductVariantCommand[] | null
  recommendProductIds?: Array<string | number> | null
  remark?: string | null
  revision?: number | null
}

const ERP_BASE_PATH = '/erp'

export function getErpManagedProducts(params: ErpManagedProductQuery) {
  return apiClient.get<ErpPage<ErpManagedProductSummary>>(`${ERP_BASE_PATH}/product-management/products`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getErpManagedProduct(id: string | number) {
  return apiClient.get<ErpManagedProductDetail>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}`,
    { stayOnUnauthorized: true },
  )
}

export function createErpManagedProduct(command: ErpManagedProductCommand) {
  return apiClient.post<ErpManagedProductDetail>(
    `${ERP_BASE_PATH}/product-management/products`,
    command,
    { stayOnUnauthorized: true },
  )
}

export function updateErpManagedProduct(id: string | number, command: ErpManagedProductCommand) {
  return apiClient.put<ErpManagedProductDetail>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}`,
    command,
    { stayOnUnauthorized: true },
  )
}

/** 列表就地切换上架状态；只改 shelfStatusCode，不触达商品其他字段。 */
export function updateErpProductShelfStatus(
  id: string | number,
  shelfStatusCode: string,
  revision: number,
) {
  return apiClient.put<ErpManagedProductDetail>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}/shelf-status`,
    { shelfStatusCode, revision },
    { stayOnUnauthorized: true },
  )
}

/** 列表就地修改排序值；只改 ordinal，不触达商品其他字段。 */
export function updateErpProductOrdinal(id: string | number, ordinal: number, revision: number) {
  return apiClient.put<ErpManagedProductDetail>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}/ordinal`,
    { ordinal, revision },
    { stayOnUnauthorized: true },
  )
}

export function deleteErpManagedProduct(id: string | number, revision: number) {
  return apiClient.delete<void>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}`,
    { params: { revision }, stayOnUnauthorized: true },
  )
}
