import { describe, expect, it } from 'vitest'
import { convertLine, statisticsUnit } from '@/utils/product-unit'

const noodle = {
  unitCode: 'BUCKET',
  middleUnitCode: 'BOX',
  baseToMiddleRate: 12,
  bigUnitCode: null,
  baseToBigRate: null,
  statisticsUnitLevel: 'MIDDLE',
}

describe('商品默认统计单位换算', () => {
  it('中单位设为统计单位时，数量按换算率折算、单价按金额回算', () => {
    const converted = convertLine(
      { unitCode: 'BUCKET', quantity: 24, unitPrice: 5, lineAmount: 120 },
      noodle,
    )
    expect(converted.converted).toBe(true)
    expect(converted.unitCode).toBe('BOX')
    expect(converted.quantity).toBe(2)
    expect(converted.unitPrice).toBe(60)
  })

  it('来源已经是统计单位时数值不变且不标记换算', () => {
    const converted = convertLine(
      { unitCode: 'BOX', quantity: 2, unitPrice: 60, lineAmount: 120 },
      noodle,
    )
    expect(converted.converted).toBe(false)
    expect(converted.quantity).toBe(2)
    expect(converted.unitPrice).toBe(60)
  })

  it('未配置默认单位时按基础单位展示，不做换算', () => {
    const converted = convertLine(
      { unitCode: 'BUCKET', quantity: 24, unitPrice: 5, lineAmount: 120 },
      { ...noodle, statisticsUnitLevel: null },
    )
    expect(converted.converted).toBe(false)
    expect(converted.quantity).toBe(24)
    expect(converted.unitPrice).toBe(5)
  })

  it('选了中单位但商品没有中单位配置时回退基础单位', () => {
    const unit = statisticsUnit({ ...noodle, middleUnitCode: null, baseToMiddleRate: null })
    expect(unit).toEqual({ level: 'BASE', unitCode: 'BUCKET', rate: 1 })
  })

  it('未知单位不参与换算，原样返回且不猜成基础单位', () => {
    const converted = convertLine(
      { unitCode: 'UNKNOWN', quantity: 12, unitPrice: 6.5, lineAmount: 78 },
      noodle,
    )
    expect(converted.converted).toBe(false)
    expect(converted.unitCode).toBe('UNKNOWN')
    expect(converted.quantity).toBe(12)
    expect(converted.unitPrice).toBe(6.5)
  })

  it('换算率缺失时同样不做换算', () => {
    const converted = convertLine(
      { unitCode: 'BOX', quantity: 2, unitPrice: 60, lineAmount: 120 },
      { ...noodle, baseToMiddleRate: null, statisticsUnitLevel: 'MIDDLE' },
    )
    expect(converted.converted).toBe(false)
    expect(converted.quantity).toBe(2)
  })

  it('大单位换算率参与折算', () => {
    const converted = convertLine(
      { unitCode: 'BUCKET', quantity: 24, unitPrice: 5, lineAmount: 120 },
      { ...noodle, bigUnitCode: 'CASE', baseToBigRate: 24, statisticsUnitLevel: 'BIG' },
    )
    expect(converted.unitCode).toBe('CASE')
    expect(converted.quantity).toBe(1)
    expect(converted.unitPrice).toBe(120)
  })
})
