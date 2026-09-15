import { describe, expect, it } from 'vitest'
import { cityContactFigure } from '@/views/supply-chain/bi/cockpit-city-contacts'
import { cockpitLayout } from '@/views/supply-chain/bi/cockpit-layout'
import type { CityContactAnalytics } from '@/api/core/bi-city-contacts'

describe('城市建联客户', () => {
  const data: CityContactAnalytics = {
    status: 'READY',
    syncedAt: '2026-09-15T00:00:00Z',
    from: '',
    to: '',
    cities: Array.from({ length: 17 }, (_, i) => ({
      regionCode: `C${i}`,
      cityName: `城市${i}`,
      contactedStores: i,
      approvedStores: 0,
      pendingStores: i,
      flaggedStores: 0,
      crmLinkedStores: 0,
      crmUnlinkedStores: i,
    })),
  }
  it('shows every returned city in the city overview with counts in households', () => {
    const figure = cityContactFigure(data, '')
    expect(figure.rows).toHaveLength(17)
    expect(figure.rows[0].cells.建联客户数).toBe('0')
    expect(figure.option.xAxis).toMatchObject({ name: '户' })
    expect(figure.note).toContain('不要求微信截图')
    expect(figure.rows[1].cells.已关联CRM门店).toBe('0')
    expect(figure.rows[1].cells.未关联CRM门店).toBe('1')
    expect(figure.note).toContain('未关联人员的拜访不计入个人统计')
    expect(cockpitLayout('city-operating', [figure]).main[0].id).toBe('city-contacts')
    expect(figure.rows.every((row) => !row.kind)).toBe(true)
  })
  it('does not reuse broad city totals when filters or employee mapping are unsupported', () => {
    expect(cityContactFigure(data, '筛选不支持').rows).toEqual([])
    const blocked = cityContactFigure({ ...data, status: 'OWNER_MAPPING_REQUIRED' }, '')
    expect(blocked.rows).toEqual([])
    expect(blocked.empty).toContain('员工编码关联尚未同步')
  })
  it('keeps unsynced and failed states distinct from measured zero', () => {
    expect(cityContactFigure({ ...data, status: 'NOT_READY' }, '').empty).toContain('尚未同步')
    expect(cityContactFigure(null, '接口读取失败').empty).toBe('接口读取失败')
    const pending = { ...data, cities: [{ ...data.cities[0], crmLinkedStores: null, crmUnlinkedStores: null }] }
    expect(cityContactFigure(pending, '').rows[0].cells.已关联CRM门店).toBe('待同步')
  })
})
