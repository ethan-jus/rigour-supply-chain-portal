import { describe, expect, it } from 'vitest'
import {
  componentVersionPeriod,
  componentVersionState,
  visibleComponentVersions,
} from '@/utils/payroll-component-versions'
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
    expect(componentVersionState(rows[0]!, rows, '2026-10-15')).toBe('使用中')
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
  it('停用从操作月份生效，不改历史月份；重新启用可恢复本月使用', () => {
    const row = version('current', 1, '2026-09-01')
    row.stateChanges = [
      {
        revision: 1,
        effectiveMonth: '2026-10',
        enabled: false,
        reason: '调整',
        actor: 'HR',
        time: '2026-10-20',
      },
    ]
    expect(componentVersionState(row, [row], '2026-09-30')).toBe('使用中')
    expect(componentVersionState(row, [row], '2026-10-20')).toBe('已停用')
    row.stateChanges.push({
      revision: 2,
      effectiveMonth: '2026-10',
      enabled: true,
      reason: '恢复',
      actor: 'HR',
      time: '2026-10-21',
    })
    expect(componentVersionState(row, [row], '2026-10-21')).toBe('使用中')
  })
  it('删除未生效版本后，保留当前正在使用的版本', () => {
    const rows = [
      version('current', 1, '2026-09-01'),
      { ...version('deleted', 2, '2026-11-01'), deleted: true },
    ]
    expect(visibleComponentVersions(rows, '2026-12-01', true).map((row) => row.id)).toEqual([
      'current',
    ])
    expect(componentVersionState(rows[0]!, rows, '2026-12-01')).toBe('使用中')
  })
  it('停用期间显示实际操作的北京时间，重新启用后恢复原截止日期，保留原定义', () => {
    for (const end of ['9999-12-31', '2026-12-31']) {
      const row = version('current', 1, '2026-04-01', end)
      row.stateChanges = [
        {
          revision: 1,
          effectiveMonth: '2026-10',
          enabled: false,
          reason: '调整',
          actor: 'HR',
          time: '2026-10-25T17:06:37Z',
        },
      ]
      const configured = `2026-04-01 至 ${end === '9999-12-31' ? '长期有效' : end}`
      expect(componentVersionPeriod(row, [row], '2026-09-30')).toBe(configured)
      expect(componentVersionPeriod(row, [row], '2026-10-26')).toBe('2026-04-01 至 2026-10-26')
      row.stateChanges.push({ ...row.stateChanges[0]!, revision: 2, enabled: true })
      expect(componentVersionPeriod(row, [row], '2026-10-26')).toBe(configured)
      row.stateChanges.push({
        ...row.stateChanges[0]!,
        revision: 3,
        time: '2026-11-04T08:00:00Z',
        effectiveMonth: '2026-11',
      })
      expect(componentVersionPeriod(row, [row], '2026-11-05')).toBe('2026-04-01 至 2026-11-04')
      expect(row.definition.effectiveTo).toBe(end)
    }
  })
  it('停用后另存的版本未启用时，不显示倒置的生效期间', () => {
    const row = version('revision', 2, '2026-10-01')
    row.stateChanges = [
      {
        revision: 1,
        effectiveMonth: '2026-09',
        enabled: false,
        reason: '调整',
        actor: 'HR',
        time: '2026-09-20T08:00:00Z',
      },
    ]
    expect(componentVersionPeriod(row, [row], '2026-10-26')).toBe('尚未启用（2026-09-20 已停用）')
    row.stateChanges[0]!.time = ''
    expect(componentVersionPeriod(row, [row], '2026-10-26')).toBe(
      '2026-10-01 至 已停用（日期待核对）',
    )
  })
})

it('已被新考勤规则替代的旧规则显示废弃，保留原停用日期与历史', () => {
  const row = version('old-calendar', 1, '2026-09-01')
  row.stateChanges = [
    {
      revision: 1,
      effectiveMonth: '2026-10',
      enabled: false,
      actor: 'HR',
      reason: '停用',
      time: '2026-10-26T10:00:00Z',
    },
    {
      revision: 2,
      effectiveMonth: '2026-09',
      enabled: false,
      retired: true,
      replacedDepartmentIds: [1],
      actor: 'HR',
      reason: '替代',
      time: '2026-10-27T10:00:00Z',
    },
  ]
  expect(componentVersionState(row, [row], '2026-10-27')).toBe('已废弃')
  expect(componentVersionPeriod(row, [row], '2026-10-27')).toBe('2026-09-01 至 2026-10-26')
})
