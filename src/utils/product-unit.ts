/** 商品三级单位与默认统计单位的换算口径。 */

export type UnitLevel = 'BASE' | 'MIDDLE' | 'BIG'

export interface ProductUnitConfig {
  unitCode: string | null
  middleUnitCode: string | null
  baseToMiddleRate: number | null
  bigUnitCode: string | null
  baseToBigRate: number | null
  /** BASE/MIDDLE/BIG；空按基础单位。 */
  statisticsUnitLevel: string | null
}

export interface StatisticsUnit {
  level: UnitLevel
  /** 统计单位编码；配置缺失时可能为空。 */
  unitCode: string | null
  /** 1 个统计单位 = rate 个基础单位。 */
  rate: number
}

function positiveRate(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function normalizeLevel(value: string | null | undefined): UnitLevel {
  const normalized = value?.trim().toUpperCase()
  return normalized === 'MIDDLE' || normalized === 'BIG' ? normalized : 'BASE'
}

/** 解析商品的默认统计单位；配置不完整时回退到基础单位。 */
export function statisticsUnit(config: ProductUnitConfig | null | undefined): StatisticsUnit | null {
  if (!config) return null
  const level = normalizeLevel(config.statisticsUnitLevel)
  if (level === 'MIDDLE' && config.middleUnitCode) {
    const rate = positiveRate(config.baseToMiddleRate)
    if (rate) return { level, unitCode: config.middleUnitCode, rate }
  }
  if (level === 'BIG' && config.bigUnitCode) {
    const rate = positiveRate(config.baseToBigRate)
    if (rate) return { level, unitCode: config.bigUnitCode, rate }
  }
  return { level: 'BASE', unitCode: config.unitCode, rate: 1 }
}

/**
 * 明细行单位对应的层级换算率：1 行单位 = rate 个基础单位。
 * 只认基础/中包装/大包装三个明确单位；未知单位返回 null，表示不可换算。
 */
function lineUnitRate(
  config: ProductUnitConfig,
  unitCode: string | null | undefined,
): number | null {
  const unit = unitCode?.trim()
  if (!unit) return null
  if (unit === config.unitCode?.trim()) return 1
  if (config.middleUnitCode && unit === config.middleUnitCode) {
    return positiveRate(config.baseToMiddleRate)
  }
  if (config.bigUnitCode && unit === config.bigUnitCode) {
    return positiveRate(config.baseToBigRate)
  }
  return null
}

export interface ConvertedLineQuantity {
  quantity: number
  unitPrice: number
  unitCode: string | null
  /** true 表示已按统计单位换算。 */
  converted: boolean
}

/**
 * 把明细行的数量与单价换算到商品默认统计单位。
 *
 * <p>金额口径不变：明细金额 = 数量 × 单价；换算后 数量=基础数量/统计单位换算率，单价=明细金额/换算后数量。
 * 商品缺失或换算率不合法时原样返回，页面继续展示来源单位。</p>
 */
export function convertLine(
  line: {
    unitCode: string | null
    quantity: number
    unitPrice: number
    lineAmount: number | null
  },
  config: ProductUnitConfig | null | undefined,
): ConvertedLineQuantity {
  const raw: ConvertedLineQuantity = {
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCode: line.unitCode,
    converted: false,
  }
  const target = statisticsUnit(config)
  if (!config || !target || !target.unitCode) return raw
  const sourceRate = lineUnitRate(config, line.unitCode)
  // 未知单位或换算率缺失时按注释约定原样返回，绝不猜成基础单位。
  if (!sourceRate || !target.rate) return raw
  const amount = line.lineAmount ?? line.unitPrice * line.quantity
  const quantity = (line.quantity * sourceRate) / target.rate
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(amount)) return raw
  return {
    quantity,
    unitPrice: amount / quantity,
    unitCode: target.unitCode,
    // 来源单位与统计单位一致时不标记换算，界面不出现来源提示。
    converted: target.unitCode !== line.unitCode,
  }
}
