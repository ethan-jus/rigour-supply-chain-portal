export interface DimensionScope {
  regionCode?: string | null
  ownerStaffCode?: string | null
}

export function supportsCategoryFilter(section: string): boolean {
  return ['product-sales', 'gross-profit', 'product-inventory', 'inventory-risk'].includes(section)
}

export function concreteDimension(value?: string | null): string | undefined {
  const code = value?.trim()
  return code && !['UNKNOWN', 'MULTI'].includes(code.toUpperCase()) ? code : undefined
}

// Aggregate labels are not query IDs; an unassigned row must never broaden to all records.
export function drillScope(
  row: DimensionScope & { kind?: string; code?: string; key?: string },
  current: DimensionScope,
): DimensionScope | null {
  const identity =
    row.kind === 'city'
      ? row.regionCode || row.code || row.key
      : row.kind === 'sales'
        ? row.ownerStaffCode || row.code || row.key
        : undefined
  if (['city', 'sales'].includes(row.kind || '') && !concreteDimension(identity)) return null
  return {
    regionCode:
      concreteDimension(row.kind === 'city' ? identity : row.regionCode) ||
      concreteDimension(current.regionCode),
    ownerStaffCode:
      concreteDimension(row.kind === 'sales' ? identity : row.ownerStaffCode) ||
      concreteDimension(current.ownerStaffCode),
  }
}
