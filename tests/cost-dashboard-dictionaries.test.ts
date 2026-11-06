import { beforeEach, expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'
import {
  dictionaryValue,
  resolveObjectLabels,
  detailDimensionValue,
  recordItem,
} from '@/views/supply-chain/bi/cost/cost-presentation'
import { buildCostDashboardWorkbook } from '@/views/supply-chain/bi/cost/cost-report-export'
import type { CostReport } from '@/api/core/bi-cost-dashboard'

beforeEach(clearBusinessDictionariesForTest)

it.each([
  ['method', 'COST_TRANSPORT_KIND', 'RAIL_NEW', '铁路运输'],
  ['carrier', 'COST_CARRIER', 'REGIONAL_NEW', '区域承运商'],
  ['feeType', 'COST_LOGISTICS_FEE_TYPE', 'LIFTING_NEW', '吊装费'],
  ['feeType', 'COST_WAREHOUSE_FEE_TYPE', 'ASSEMBLY_NEW', '礼包组装费'],
  ['leg', 'COST_TRANSPORT_PURPOSE', 'DELIVERY', '销售订单配送'],
])(
  'arbitrary dictionary values resolve in %s groups and details without changing code',
  (dimension, dict, code, name) => {
    seedBusinessDictionaryForTest('', dict, [{ code, name }])
    const key = `dict:${dict}:${code}`
    const raw = {
      category: 'freight',
      dimension,
      objects: [{ key, label: code, current: '123.45' }],
    } as CostReport
    const labeled = resolveObjectLabels(raw)
    expect(labeled.objects[0]).toMatchObject({ key, label: name, current: '123.45' })
    expect(detailDimensionValue({ source: 'ORDER', category: 'freight' }, '费用项目', key)).toBe(
      name,
    )
    expect(recordItem({ itemKey: key, itemName: code })).toBe(name)
    seedBusinessDictionaryForTest('', dict, [{ code, name: name + '更新' }])
    expect(resolveObjectLabels(raw).objects[0]!.label).toBe(name + '更新')
    expect(dictionaryValue(`dict:${dict}:UNCONFIGURED`)).toBe('UNCONFIGURED')
    expect(raw.objects[0]!.label).toBe(code)
  },
)

it('downloaded workbook resolves a newly configured fee and preserves exact amount and identifiers', async () => {
  seedBusinessDictionaryForTest('', 'COST_LOGISTICS_FEE_TYPE', [
    { code: 'LIFTING_NEW', name: '吊装费' },
  ])
  const csv =
    '匹配笔数,1,已确认金额,123.45\r\n单据号,事项,费用类别,城市,费用日期,金额（元）,确认状态,付款状态,费用所属月,费用项目\r\n000123,运费,物流运输费用,武汉,2026-11-01,123.45,已确认,未付款,2026-11,dict:COST_LOGISTICS_FEE_TYPE:LIFTING_NEW\r\n'
  const workbook = await buildCostDashboardWorkbook(csv)
  const restored = new Workbook()
  await restored.xlsx.load(await workbook.xlsx.writeBuffer())
  const sheet = restored.getWorksheet('支出明细')!
  expect(sheet.columnCount).toBe(10)
  expect(sheet.getCell('A2').value).toBe('000123')
  expect(sheet.getCell('G2').value).toBe(123.45)
  expect(sheet.getCell('J2').value).toBe('吊装费')
  expect(JSON.stringify(restored.model)).not.toContain('dict:')
})
