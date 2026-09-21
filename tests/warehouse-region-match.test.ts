import { describe, expect, it } from 'vitest'
import { pickRegionMatchedWarehouse, warehouseOptionLabel } from '@/utils/warehouse-region-match'

const warehouses = [
  { id: '11', warehouseName: '北京仓', regionCode: 'CUSAREA-BEIJING' },
  { id: '13', warehouseName: '深圳仓', regionCode: 'CUSAREA-SHENZHEN' },
  { id: '14', warehouseName: '临时仓', regionCode: null },
]

describe('出库仓库按客户归属地区匹配', () => {
  it('订单地区命中时默认选中同地区仓库', () => {
    expect(pickRegionMatchedWarehouse(warehouses, 'CUSAREA-SHENZHEN')?.warehouseName).toBe('深圳仓')
  })

  it('订单没有归属地区或仓库没有地区时不默认选中', () => {
    expect(pickRegionMatchedWarehouse(warehouses, null)).toBeUndefined()
    expect(pickRegionMatchedWarehouse(warehouses, '')).toBeUndefined()
    expect(pickRegionMatchedWarehouse(warehouses, 'CUSAREA-CHENGDU')).toBeUndefined()
  })

  it('选项标签带出仓库归属地区，无地区时不拼后缀', () => {
    expect(warehouseOptionLabel(warehouses[1], '深圳市')).toBe('深圳仓（深圳市）')
    expect(warehouseOptionLabel(warehouses[2], '-')).toBe('临时仓')
    expect(warehouseOptionLabel(warehouses[2], null)).toBe('临时仓')
  })
})
