import { apiClient } from './client'

export interface ErpCustomerTypePriceView {
  id: string
  productId: string
  productCode: string
  productName: string
  productVariantId: string
  variantCode: string | null
  specificationSnapshot: string | null
  customerTypeCode: string
  salePrice: number | null
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  updatedTime: string
}

export interface ErpCustomerTypePriceItemCommand {
  customerTypeCode: string
  salePrice: number
  remark?: string | null
}

const ERP_BASE_PATH = '/erp'

/** productIds 为逗号分隔的商品ID，单次最多 200 个。 */
export function getErpCustomerTypePrices(productIds: string) {
  return apiClient.get<ErpCustomerTypePriceView[]>(`${ERP_BASE_PATH}/customer-type-prices`, {
    params: { productIds },
    stayOnUnauthorized: true,
  })
}

/** 整体保存语义：items 是该规格客户类型等级的完整集合，未提交的会被服务端清除。 */
export function syncErpCustomerTypePrices(
  productVariantId: string | number,
  items: ErpCustomerTypePriceItemCommand[],
) {
  return apiClient.put<ErpCustomerTypePriceView[]>(
    `${ERP_BASE_PATH}/customer-type-prices/variants/${encodeURIComponent(String(productVariantId))}`,
    { items },
    { stayOnUnauthorized: true },
  )
}

export interface ErpCustomerTypePriceImportItem {
  productVariantId: string | number
  customerTypeCode: string
  salePrice: number
  remark?: string | null
}

export interface ErpCustomerTypePriceImportResult {
  total: number
  created: number
  updated: number
}

/** 批量导入等级价：只写入提交的规格与客户类型，不影响其他等级价。单次最多 2000 条。 */
export function importErpCustomerTypePrices(items: ErpCustomerTypePriceImportItem[]) {
  return apiClient.post<ErpCustomerTypePriceImportResult>(
    `${ERP_BASE_PATH}/customer-type-prices/import`,
    { items },
    { stayOnUnauthorized: true },
  )
}
