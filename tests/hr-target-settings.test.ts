import { describe, it, expect } from 'vitest'
import {
  defaultTarget,
  targetCell,
  targetValueError,
  previousMonth,
  copyPreviousTargets,
} from '../src/views/supply-chain/hr/target-settings-model'
import { personalGoal } from '../src/views/supply-chain/bi/sales-dashboard-model'
import type { TargetSettings, TargetSubject } from '../src/api/core/bi-target-settings'
import type { SalesAnalysis } from '../src/api/core/bi-sales-dashboard'
const person: TargetSubject = {
  dimensionType: 'SALES_OWNER',
  code: 'E1',
  name: '示例销售',
  cityCode: 'BJ',
  cityName: '北京',
  departmentName: '销售部',
  employmentStatus: 'ACTIVE',
  writable: true,
}
const settings = (): TargetSettings => ({
  month: '2026-10',
  subjects: [person],
  overrides: [],
  defaults: [
    {
      dimensionType: 'SALES_OWNER',
      effectiveMonth: '2026-11',
      metric: 'SALES_AMOUNT',
      value: 60000,
      revision: 1,
    },
  ],
  defaultsWritable: true,
})
describe('月度指标的来源与复制语义', () => {
  it('future standards leave historical months unchanged and dimensions separate', () => {
    const d = settings()
    expect(defaultTarget(d, 'SALES_OWNER', 'SALES_AMOUNT')).toBe(40000)
    expect(defaultTarget(d, 'SALES_OWNER', 'SALES_AMOUNT', '2026-11')).toBe(60000)
    expect(defaultTarget(d, 'CITY', 'SALES_AMOUNT', '2026-11')).toBe(100000)
  })
  it('zero is explicit non-assessment, deleted overrides inherit while retaining revisions', () => {
    const d = settings()
    d.overrides = [
      {
        dimensionType: 'SALES_OWNER',
        code: 'E1',
        metric: 'SALES_AMOUNT',
        value: 0,
        revision: 3,
        deleted: false,
        updatedAt: null,
        updatedBy: null,
      },
    ]
    expect(targetCell(d, person, 'SALES_AMOUNT')).toMatchObject({
      value: 0,
      configured: true,
      revision: 3,
    })
    d.overrides[0]!.deleted = true
    expect(targetCell(d, person, 'SALES_AMOUNT')).toMatchObject({
      value: 40000,
      configured: false,
      revision: 3,
    })
  })
  it('copy only fills inherited metrics and preserves explicit zero, read-only people and current versions', () => {
    const current = settings(),
      prior = settings()
    prior.month = '2026-09'
    prior.overrides = [
      {
        dimensionType: 'SALES_OWNER',
        code: 'E1',
        metric: 'SALES_AMOUNT',
        value: 50000,
        revision: 2,
        deleted: false,
        updatedAt: null,
        updatedBy: null,
      },
    ]
    expect(copyPreviousTargets(current, prior, [person])).toEqual([
      {
        dimensionType: 'SALES_OWNER',
        code: 'E1',
        metric: 'SALES_AMOUNT',
        value: '50000',
        expectedRevision: 0,
      },
    ])
    expect(copyPreviousTargets(current, prior, [{ ...person, writable: false }])).toEqual([])
    current.overrides = [{ ...prior.overrides[0]!, value: 0, revision: 4 }]
    expect(copyPreviousTargets(current, prior, [person])).toEqual([])
    current.overrides[0]!.deleted = true
    expect(copyPreviousTargets(current, prior, [person])[0]?.expectedRevision).toBe(4)
  })
  it('rejects invalid decimals, negatives and fractional people without rounding', () => {
    for (const value of ['', '-1', '1.001', 'Infinity', '1000000000000', '1e3'])
      expect(targetValueError('SALES_AMOUNT', value)).toBeTruthy()
    expect(targetValueError('NEW_CUSTOMER', '1.5')).toBeTruthy()
    expect(targetValueError('NEW_CUSTOMER', '0')).toBeNull()
    expect(targetValueError('SALES_AMOUNT', '123.45')).toBeNull()
  })
  it('previous month crosses year boundary', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
  })
  it('sales dashboard consumes effective per-month defaults while explicit zero wins', () => {
    const d = {
      goals: [
        { code: '*', month: 10, metric: 'SALES_AMOUNT', target: 60000 },
        { code: '*', month: 11, metric: 'SALES_AMOUNT', target: 70000 },
        { code: 'E1', month: 10, metric: 'SALES_AMOUNT', target: 0 },
      ],
    } as SalesAnalysis
    expect(personalGoal(d, 'E1', 'SALES_AMOUNT', 10)).toMatchObject({ value: 0, defaults: 0 })
    expect(personalGoal(d, 'E2', 'SALES_AMOUNT', 10)).toMatchObject({ value: 60000, defaults: 1 })
    expect(personalGoal(d, 'E1', 'SALES_AMOUNT', null)).toMatchObject({
      value: 470000,
      defaults: 11,
    })
  })
})
