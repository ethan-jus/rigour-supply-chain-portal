import { describe, expect, it } from 'vitest'
import { componentVersionState, visibleComponentVersions } from '@/utils/payroll-component-versions'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
const version = (id: string, number: number, start: string, end = '9999-12-31') =>
  ({
    id,
    ruleId: 'salary',
    ruleCode: 'PCR001',
    version: number,
    definition: { effectiveFrom: start, effectiveTo: end },
  }) as PayrollComponentVersionView
describe('薪资标准的有效版本展示', () => {
  it('未来调薪与当前标准同时展示，不提前替换本月金额', () => {
    const rows = [version('old', 1, '2026-09-01'), version('future', 2, '2026-11-01')]
    expect(componentVersionState(rows[0]!, rows, '2026-10-15')).toBe('当前生效')
    expect(componentVersionState(rows[1]!, rows, '2026-10-15')).toBe('待生效')
    expect(visibleComponentVersions(rows, '2026-10-15')).toHaveLength(2)
    expect(visibleComponentVersions(rows, '2026-11-01').map((r) => r.id)).toEqual(['future'])
  })
  it('新版本到期后旧的长期版本不会复活', () => {
    const rows = [version('old', 1, '2026-09-01'), version('ending', 2, '2026-10-01', '2026-10-31')]
    expect(componentVersionState(rows[0]!, rows, '2026-11-01')).toBe('历史版本')
    expect(componentVersionState(rows[1]!, rows, '2026-11-01')).toBe('已到期')
    expect(visibleComponentVersions(rows, '2026-11-01')).toHaveLength(1)
    expect(visibleComponentVersions(rows, '2026-11-01', true)).toHaveLength(2)
  })
  it('同月再次调整仅显示最后版本，历史可追溯', () => {
    const rows = [version('a', 1, '2026-11-01'), version('b', 2, '2026-11-01')]
    expect(visibleComponentVersions(rows, '2026-10-15').map((r) => r.id)).toEqual(['b'])
  })
})
