import { displayDateTime } from '@/utils/business-date'
import type { CityContactAnalytics } from '@/api/core/bi-city-contacts'
import type { Figure } from './cockpit-model'
import { bars, chartColors } from './cockpit-charts'

/** 城市建联按用户确认的 Sales 已提交拜访去重口径，展示完整城市列表。 */
export function cityContactFigure(data: CityContactAnalytics | null, unavailable: string): Figure {
  const rows = data?.status === 'READY' && !unavailable ? data.cities : []
  const reason =
    unavailable ||
    (data?.status === 'OWNER_MAPPING_REQUIRED'
      ? 'Sales 员工编码关联尚未同步，暂不能读取销售范围统计'
      : data?.status === 'NOT_READY'
        ? 'Sales 拜访数据尚未同步'
        : '当前范围没有城市建联记录')
  return {
    id: 'city-contacts',
    title: '城市建联客户（拜访去重）',
    span: 12,
    height: Math.max(280, rows.length * 30 + 80),
    option: bars(
      rows.map((row) => ({
        key: row.regionCode || `unmapped:${row.cityName || 'UNKNOWN'}`,
        name: row.cityName || '未填写城市',
        values: [row.contactedStores],
      })),
      [{ name: '建联客户', color: chartColors[0] }],
      { unit: '户', limit: Math.max(rows.length, 1) },
    ),
    rows: rows.map((row) => ({
      key: row.regionCode || `unmapped:${row.cityName || 'UNKNOWN'}`,
      name: row.cityName || '未填写城市',
      // 当前列表含尚未关联 CRM 的 Sales 门店，不跳转到不同总体的 CRM 客户列表。
      cells: {
        城市: row.cityName || '未填写城市',
        建联客户数: String(row.contactedStores),
        已审核: String(row.approvedStores),
        待审核: String(row.pendingStores),
        有异常标记: String(row.flaggedStores),
        已关联CRM门店: row.crmLinkedStores == null ? '待同步' : String(row.crmLinkedStores),
        未关联CRM门店: row.crmUnlinkedStores == null ? '待同步' : String(row.crmUnlinkedStores),
        城市关联: row.regionCode ? '已关联' : '待关联',
      },
    })),
    note: `所选期间内 Sales 已提交、未删除的拜访按门店去重；同店多次拜访只计1户，不要求微信截图。城市按门店当前归属；建联不等于审核通过。销售筛选按提交人已确认的 HR 员工编码，未关联人员的拜访不计入个人统计；CRM 关联情况不影响建联总数。${
      data?.syncedAt ? ` 快照 ${displayDateTime(data.syncedAt)}` : ''
    }`,
    empty: reason,
  }
}
