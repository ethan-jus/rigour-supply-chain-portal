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
  categoryId: string | null
  categoryName: string | null
  brandId: string | null
  brandName: string | null
  unitCode: string | null
  saleTypeCode: string
  shelfStatusCode: string
  submitStatusCode: string
  defaultWarehouseId: string | null
  defaultWarehouseName: string | null
  defaultSalePrice: number | null
  mainImageKey: string | null
  mainImageUrl: string | null
  variantCount: number
  revision: number
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
  productSpecification: string | null
  minOrderQuantity: number | null
  orderMultipleFlag: boolean | null
  orderMultipleQuantity: number | null
  tagCodes: string[]
  limitQuantity: number | null
  images: ErpManagedProductImage[]
  variants: ErpManagedProductVariant[]
  recommendProductIds: string[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
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
  minOrderQuantity?: number | null
  orderMultipleFlag?: boolean | null
  orderMultipleQuantity?: number | null
  saleTypeCode?: string | null
  shelfStatusCode?: string | null
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

export function deleteErpManagedProduct(id: string | number, revision: number) {
  return apiClient.delete<void>(
    `${ERP_BASE_PATH}/product-management/products/${encodeURIComponent(String(id))}`,
    { params: { revision }, stayOnUnauthorized: true },
  )
}
