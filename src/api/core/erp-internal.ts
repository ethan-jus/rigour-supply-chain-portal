import { apiClient } from './client'

export interface ErpInternalPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface ErpProductCategoryView {
  id: string
  categoryCode: string
  categoryName: string
  parentId: string | null
  categoryLevel: number | null
  ordinal: number | null
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpProductCategoryCommand {
  parentId?: string | number | null
  categoryName: string
  ordinal?: number | null
  remark?: string | null
  revision?: number | null
}

export interface ErpProductBrandView {
  id: string
  brandCode: string
  brandName: string
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpProductBrandCommand {
  brandName: string
  remark?: string | null
  revision?: number | null
}

export interface ErpProductTagView {
  id: string
  tagCode: string
  tagName: string
  tagTypeCode: string | null
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpProductTagCommand {
  tagName: string
  tagTypeCode?: string | null
  remark?: string | null
  revision?: number | null
}

export interface ErpProductSpecificationValueView {
  id: string
  valueCode: string
  valueName: string
  ordinal: number | null
  statusCode: string
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpProductSpecificationView {
  id: string
  specificationCode: string
  specificationName: string
  statusCode: string
  valueCount: number
  values: ErpProductSpecificationValueView[]
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpProductSpecificationValueCommand {
  id?: string | number | null
  valueCode?: string | null
  valueName: string
  ordinal?: number | null
  statusCode?: string | null
}

export interface ErpProductSpecificationCommand {
  specificationCode: string
  specificationName: string
  statusCode?: string | null
  values: ErpProductSpecificationValueCommand[]
  revision?: number | null
}

export interface ErpInternalWarehouseView {
  id: string
  warehouseCode: string
  warehouseName: string
  regionCode: string | null
  warehouseTypeCode: string | null
  defaultFlag: boolean
  address: string | null
  contactName: string | null
  contactPhone: string | null
  statusCode: string
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpStockBalanceView {
  id: string
  warehouseId: string
  warehouseCode: string | null
  warehouseName: string | null
  productId: string
  productCode: string | null
  productName: string | null
  productVariantId: string
  variantCode: string | null
  specificationSnapshot: string | null
  unitCode: string | null
  availableQuantity: number
  lockedQuantity: number
  inTransitQuantity: number
  revision: number
  updatedTime: string
}

export interface ErpInternalWarehouseCommand {
  warehouseName: string
  regionCode?: string | null
  warehouseTypeCode?: string | null
  defaultFlag?: boolean | null
  address?: string | null
  contactName?: string | null
  contactPhone?: string | null
  statusCode?: string | null
  remark?: string | null
  revision?: number | null
}

export interface ErpSupplierProfileView {
  id: string
  supplierCode: string
  supplierName: string
  contactName: string | null
  contactPhone: string | null
  address: string | null
  bankName: string | null
  bankAccountNo: string | null
  statusCode: string
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpSupplierProfileCommand {
  supplierName: string
  contactName?: string | null
  contactPhone?: string | null
  address?: string | null
  bankName?: string | null
  bankAccountNo?: string | null
  statusCode?: string | null
  remark?: string | null
  revision?: number | null
}

export interface ErpProductCategoryQuery {
  begin: number
  step: number
  categoryCode?: string
  categoryName?: string
  parentId?: string | number
}

export interface ErpProductBrandQuery {
  begin: number
  step: number
  brandCode?: string
  brandName?: string
}

export interface ErpProductTagQuery {
  begin: number
  step: number
  tagCode?: string
  tagName?: string
  tagTypeCode?: string
}

export interface ErpProductSpecificationQuery {
  begin: number
  step: number
  specificationCode?: string
  specificationName?: string
  statusCode?: string
}

export interface ErpInternalWarehouseQuery {
  begin: number
  step: number
  warehouseCode?: string
  warehouseName?: string
  regionCode?: string
  defaultFlag?: boolean
  statusCode?: string
}

export interface ErpStockBalanceQuery {
  begin: number
  step: number
  productCode?: string
  productName?: string
  warehouseId?: string | number
  warehouseName?: string
}

export interface ErpSupplierProfileQuery {
  begin: number
  step: number
  supplierCode?: string
  supplierName?: string
  contactPhone?: string
  statusCode?: string
}

const ERP_BASE_PATH = '/erp'
const options = { stayOnUnauthorized: true }

export const getErpProductCategories = (params: ErpProductCategoryQuery) =>
  apiClient.get<ErpInternalPage<ErpProductCategoryView>>(`${ERP_BASE_PATH}/product-categories`, { params, ...options })
export const getErpProductCategory = (id: string | number) =>
  apiClient.get<ErpProductCategoryView>(`${ERP_BASE_PATH}/product-categories/${encodeURIComponent(String(id))}`, options)
export const createErpProductCategory = (command: ErpProductCategoryCommand) =>
  apiClient.post<ErpProductCategoryView>(`${ERP_BASE_PATH}/product-categories`, command, options)
export const updateErpProductCategory = (id: string | number, command: ErpProductCategoryCommand) =>
  apiClient.put<ErpProductCategoryView>(`${ERP_BASE_PATH}/product-categories/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpProductCategory = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/product-categories/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getErpProductBrands = (params: ErpProductBrandQuery) =>
  apiClient.get<ErpInternalPage<ErpProductBrandView>>(`${ERP_BASE_PATH}/product-brands`, { params, ...options })
export const getErpProductBrand = (id: string | number) =>
  apiClient.get<ErpProductBrandView>(`${ERP_BASE_PATH}/product-brands/${encodeURIComponent(String(id))}`, options)
export const createErpProductBrand = (command: ErpProductBrandCommand) =>
  apiClient.post<ErpProductBrandView>(`${ERP_BASE_PATH}/product-brands`, command, options)
export const updateErpProductBrand = (id: string | number, command: ErpProductBrandCommand) =>
  apiClient.put<ErpProductBrandView>(`${ERP_BASE_PATH}/product-brands/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpProductBrand = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/product-brands/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getErpProductTags = (params: ErpProductTagQuery) =>
  apiClient.get<ErpInternalPage<ErpProductTagView>>(`${ERP_BASE_PATH}/product-tags`, { params, ...options })
export const getErpProductTag = (id: string | number) =>
  apiClient.get<ErpProductTagView>(`${ERP_BASE_PATH}/product-tags/${encodeURIComponent(String(id))}`, options)
export const createErpProductTag = (command: ErpProductTagCommand) =>
  apiClient.post<ErpProductTagView>(`${ERP_BASE_PATH}/product-tags`, command, options)
export const updateErpProductTag = (id: string | number, command: ErpProductTagCommand) =>
  apiClient.put<ErpProductTagView>(`${ERP_BASE_PATH}/product-tags/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpProductTag = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/product-tags/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getErpProductSpecifications = (params: ErpProductSpecificationQuery) =>
  apiClient.get<ErpInternalPage<ErpProductSpecificationView>>(`${ERP_BASE_PATH}/product-specifications`, { params, ...options })
export const getErpProductSpecification = (id: string | number) =>
  apiClient.get<ErpProductSpecificationView>(`${ERP_BASE_PATH}/product-specifications/${encodeURIComponent(String(id))}`, options)
export const createErpProductSpecification = (command: ErpProductSpecificationCommand) =>
  apiClient.post<ErpProductSpecificationView>(`${ERP_BASE_PATH}/product-specifications`, command, options)
export const updateErpProductSpecification = (id: string | number, command: ErpProductSpecificationCommand) =>
  apiClient.put<ErpProductSpecificationView>(`${ERP_BASE_PATH}/product-specifications/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpProductSpecification = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/product-specifications/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getErpInventoryWarehouses = (params: ErpInternalWarehouseQuery) =>
  apiClient.get<ErpInternalPage<ErpInternalWarehouseView>>(`${ERP_BASE_PATH}/inventory-warehouses`, { params, ...options })
export const getErpInventoryWarehouse = (id: string | number) =>
  apiClient.get<ErpInternalWarehouseView>(`${ERP_BASE_PATH}/inventory-warehouses/${encodeURIComponent(String(id))}`, options)
export const createErpInventoryWarehouse = (command: ErpInternalWarehouseCommand) =>
  apiClient.post<ErpInternalWarehouseView>(`${ERP_BASE_PATH}/inventory-warehouses`, command, options)
export const updateErpInventoryWarehouse = (id: string | number, command: ErpInternalWarehouseCommand) =>
  apiClient.put<ErpInternalWarehouseView>(`${ERP_BASE_PATH}/inventory-warehouses/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpInventoryWarehouse = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/inventory-warehouses/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getErpStockBalances = (params: ErpStockBalanceQuery) =>
  apiClient.get<ErpInternalPage<ErpStockBalanceView>>(`${ERP_BASE_PATH}/stock-balances`, { params, ...options })

export const getErpSupplierProfiles = (params: ErpSupplierProfileQuery) =>
  apiClient.get<ErpInternalPage<ErpSupplierProfileView>>(`${ERP_BASE_PATH}/supplier-profiles`, { params, ...options })
export const getErpSupplierProfile = (id: string | number) =>
  apiClient.get<ErpSupplierProfileView>(`${ERP_BASE_PATH}/supplier-profiles/${encodeURIComponent(String(id))}`, options)
export const createErpSupplierProfile = (command: ErpSupplierProfileCommand) =>
  apiClient.post<ErpSupplierProfileView>(`${ERP_BASE_PATH}/supplier-profiles`, command, options)
export const updateErpSupplierProfile = (id: string | number, command: ErpSupplierProfileCommand) =>
  apiClient.put<ErpSupplierProfileView>(`${ERP_BASE_PATH}/supplier-profiles/${encodeURIComponent(String(id))}`, command, options)
export const deleteErpSupplierProfile = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/supplier-profiles/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })
