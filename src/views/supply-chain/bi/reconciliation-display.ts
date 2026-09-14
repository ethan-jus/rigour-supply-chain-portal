import type { ReconciliationFact, ReconciliationRow } from '@/api/core/bi-reconciliation-review'
import { reportMoneyText, reportQuantityText } from './report-format'

export const reconciliationDimensions = [
  { key: 'financialStatus', label: '金额核对' },
  { key: 'quantityStatus', label: '数量 / 单位核对' },
  { key: 'associationStatus', label: '业务归属 / 商品关联' },
] as const

export function reconciliationStatusName(value?: string | null): string {
  if (!value) return '未单独评估'
  return (
    (
      {
        DIFF: '存在差异',
        UNVERIFIED: '待核验',
        STALE: '快照已过期',
        EXCLUDED_REFUND: '退款排除',
        SNAPSHOT_MATCH: '所选快照一致',
        NOT_APPLICABLE: '不适用（订单数量不汇总）',
      } as Record<string, string>
    )[value] || '待核验'
  )
}

export function unitEvidenceName(value?: string | null): string {
  return (
    (
      {
        EXPLICIT: '来源明确填写',
        COLUMN_INFERRED: '由数量列名推断',
        UNKNOWN: '单位依据不明',
        SYSTEM: '系统记录单位',
        OPERATOR_CONFIRMED: '业务已核实交易单位',
        MIXED: '多种单位依据混合',
      } as Record<string, string>
    )[value || ''] || '未提供单位依据'
  )
}

export function associationEvidenceName(value?: string | null): string {
  return (
    (
      {
        SOURCE_RECORD: '来源记录关联',
        SOURCE_CODE: '来源编码关联',
        EXACT_NAME_SPEC: '名称规格匹配（关联待确认）',
        UNLINKED: '尚未关联',
        SYSTEM: '系统记录关联',
        OPERATOR_CONFIRMED: '业务已确认商品关联',
        MIXED: '多种关联依据混合',
      } as Record<string, string>
    )[value || ''] || '未提供关联依据'
  )
}

export const reconciliationMoney = (value: unknown) =>
  value == null ? '未核实' : reportMoneyText(value)

export function originalQuantity(fact: ReconciliationFact | null): string {
  if (!fact) return '未提供'
  const quantity = fact.quantity == null ? '未提供数量' : reportQuantityText(fact.quantity)
  return `${quantity} ${originalUnit(fact)}`
}

export function originalUnit(fact: ReconciliationFact | null): string {
  if (!fact) return '未提供'
  if (!fact.rawUnit || fact.rawUnit === fact.unitCode) return fact.unit || '未标明单位'
  return fact.rawUnit
}

export function factWarnings(fact: ReconciliationFact | null): string[] {
  if (!fact) return []
  const warnings = [...(fact.uncertainties || [])]
  if (fact.kind === 'ORDER') return warnings
  if (fact.unitEvidence === 'COLUMN_INFERRED')
    warnings.push('单位仅由数量列名推断，实际交易单位待核验；未进行数量换算。')
  else if (fact.unitEvidence === 'MIXED')
    warnings.push('单位依据混合，数量可比性待核验；未进行数量换算。')
  else if (!['EXPLICIT', 'SYSTEM', 'OPERATOR_CONFIRMED'].includes(fact.unitEvidence || ''))
    warnings.push('单位依据不足，数量可比性待核验；未进行数量换算。')
  if (fact.associationEvidence === 'UNLINKED')
    warnings.push('商品尚未关联，不能据此认定订单漏录或缺少明细。')
  else if (fact.associationEvidence === 'EXACT_NAME_SPEC')
    warnings.push('名称规格匹配仅用于比较分组，稳定编码或来源记录关联尚待确认。')
  else if (fact.associationEvidence === 'MIXED')
    warnings.push('关联依据混合，需逐项核对商品及规格。')
  return [...new Set(warnings)]
}

export function reconciliationWarnings(row: ReconciliationRow): string[] {
  const warnings = [...row.issues]
  if (reconciliationDimensions.some(({ key }) => !row[key]))
    warnings.push('该复核记录未提供完整的分项结论；缺项未单独评估。')
  if (row.quantityStatus === 'UNVERIFIED')
    warnings.push('数量 / 单位待核验，不能据此认定数量短缺。')
  for (const [label, fact] of [
    ['来源', row.source],
    ['业务系统', row.business],
    ['BI 快照', row.bi],
  ] as const)
    warnings.push(...factWarnings(fact).map((warning) => `${label}：${warning}`))
  return [...new Set(warnings)]
}
