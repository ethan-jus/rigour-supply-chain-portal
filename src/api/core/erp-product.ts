import { apiClient } from './client'

/** ERP 商品主数据同步对象；页面不接收连接器或订货宝凭据。 */
export type ErpMasterDataObjectType =
  | 'PRODUCT_SPU'
  | 'CATEGORY'
  | 'BRAND'
  | 'SPECIFICATION'
  | 'TAG'

export interface ErpPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface ErpProductView {
  id: string
  sourceProductId: string | null
  sourceCategoryId: string | null
  sourceBrandId: string | null
  spuCode: string | null
  name: string
  brandName: string | null
  categoryName: string | null
  barcode: string | null
  unit: string | null
  sourcePutaway: string | null
  internalStatus: string
  ownershipState: string
  skuCount: number
  syncedAt: string | null
  model: string | null
  subtitle: string | null
  keywords: string | null
  goodsAllocation: string | null
  sourceMultiId: string | null
  orderPrice: number | null
  marketPrice: number | null
  purchasePrice: number | null
  price4: number | null
  middleUnit: string | null
  bigUnit: string | null
  middleBarcode: string | null
  bigBarcode: string | null
  conversionBarcode: string | null
  baseToMiddleRate: number | null
  baseToBigRate: number | null
  minimumOrder: number | null
  minimumOrderUnit: string | null
  inventoryLower: number | null
  inventoryUpper: number | null
  safetyInventory: number | null
  middleOrderPrice: number | null
  bigOrderPrice: number | null
  images: ErpProductImageView[]
  skus: ErpSkuView[]
  customFields: Record<string, string>
  priceItems: ErpProductPriceView[]
  quantityItems: ErpProductQuantityView[]
}

export interface ErpProductPriceView {
  priceType: string
  unitLevel: string
  amount: number
  unitName: string | null
  displayLabel: string
  displayValue: string
}

export interface ErpProductQuantityView {
  quantityType: string
  amount: number
  unitName: string | null
  displayLabel: string
  displayValue: string
}

export interface ErpProductImageView {
  id: string
  sourceResourceId: string | null
  sourceGoodsId: string | null
  originalName: string | null
  sourceFileName: string | null
  url: string | null
  sortOrder: number
  primary: boolean
}

export interface ErpSkuView {
  id: string
  sourceSkuId: string | null
  skuCode: string
  spuCode: string
  productName: string
  barcode: string | null
  unit: string | null
  specificationSummary: string | null
  sourcePutaway: string | null
  internalStatus: string
  ownershipState: string
  syncedAt: string | null
  optionsId: string | null
  firstSpecificationValueSourceId: string | null
  secondSpecificationValueSourceId: string | null
  middleBarcode: string | null
  bigBarcode: string | null
  orderPrice: number | null
  marketPrice: number | null
  purchasePrice: number | null
  middleOrderPrice: number | null
  bigOrderPrice: number | null
  priceItems: ErpProductPriceView[]
}

export interface ErpCategoryView {
  id: string
  sourceCategoryId: string | null
  externalReferenceId: string | null
  categoryCode: string | null
  name: string
  parentId: string | null
  categoryLevel: number
  sourceParentId: string | null
  sourceCategoryNumber: string | null
  sourceDefaultFlag: boolean | null
  status: string
  ownershipState: string
  syncedAt: string | null
}

export interface ErpBrandView {
  id: string
  sourceBrandId: string | null
  externalReferenceId: string | null
  brandCode: string | null
  name: string
  sourceBrandNumber: string | null
  sourceSortOrder: number | null
  sourceDescription: string | null
  status: string
  ownershipState: string
  syncedAt: string | null
}

export interface ErpSpecificationView {
  id: string
  sourceSpecificationId: string | null
  specificationCode: string | null
  name: string
  sourceParentId: string | null
  valueCount: number
  values: ErpSpecificationValueView[]
  status: string
  ownershipState: string
  syncedAt: string | null
}

export interface ErpSpecificationValueView {
  id: string
  sourceSpecificationValueId: string | null
  sourceParentId: string | null
  valueCode: string | null
  valueName: string
  sortOrder: number | null
  status: string
  ownershipState: string
}

export interface ErpTagView {
  id: string
  sourceTagId: string | null
  tagCode: string | null
  name: string
  sourceGroupId: string | null
  sourceGroupName: string | null
  sourceSortOrder: number | null
  sourceRelationCount: number | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  color: string | null
  status: string
  ownershipState: string
  syncedAt: string | null
}

export interface ErpMasterDataQuery {
  begin: number
  step: number
  q?: string
  status?: string
}

export interface ErpProductQuery extends ErpMasterDataQuery {
  internalStatus?: string
  sourcePutaway?: string
}

const ERP_BASE_PATH = '/erp'

/** 只查询 ERP 本地商品模型，不会由 Portal 穿透访问 Integration。 */
export function getErpProducts(params: ErpProductQuery) {
  return apiClient.get<ErpPage<ErpProductView>>(`${ERP_BASE_PATH}/products`, {
    params,
    stayOnUnauthorized: true,
  })
}

/** SKU 由 getGoodsList.multi 随 SPU 一并落库，此处仅查 ERP 本地表。 */
export function getErpSkus(params: ErpProductQuery) {
  return apiClient.get<ErpPage<ErpSkuView>>(`${ERP_BASE_PATH}/skus`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getErpCategories(params: ErpMasterDataQuery) {
  return apiClient.get<ErpPage<ErpCategoryView>>(`${ERP_BASE_PATH}/categories`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getErpBrands(params: ErpMasterDataQuery) {
  return apiClient.get<ErpPage<ErpBrandView>>(`${ERP_BASE_PATH}/brands`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getErpSpecifications(params: ErpMasterDataQuery) {
  return apiClient.get<ErpPage<ErpSpecificationView>>(`${ERP_BASE_PATH}/specifications`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getErpTags(params: ErpMasterDataQuery) {
  return apiClient.get<ErpPage<ErpTagView>>(`${ERP_BASE_PATH}/tags`, {
    params,
    stayOnUnauthorized: true,
  })
}
