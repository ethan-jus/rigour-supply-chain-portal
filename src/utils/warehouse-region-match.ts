/**
 * 出库仓库和订单客户归属地区的匹配：
 * 只在订单地区明确且有同地区仓库时给出默认仓，匹配不到就让仓管人工选，
 * 避免客户订单默认落到外地仓。
 */
export interface RegionMatchableWarehouse {
  id: string | number
  warehouseName: string
  regionCode?: string | null
}

export function pickRegionMatchedWarehouse<T extends RegionMatchableWarehouse>(
  warehouses: T[],
  regionCode?: string | null,
): T | undefined {
  const region = regionCode?.trim()
  if (!region) return undefined
  return warehouses.find((item) => item.regionCode?.trim() === region)
}

export function warehouseOptionLabel(
  warehouse: RegionMatchableWarehouse,
  regionName?: string | null,
): string {
  const name = warehouse.warehouseName?.trim()
  if (!name) return ''
  const region = regionName?.trim()
  return !region || region === '-' ? name : `${name}（${region}）`
}
