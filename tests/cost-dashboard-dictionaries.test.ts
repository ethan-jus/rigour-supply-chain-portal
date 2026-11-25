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
  ['leg', 'COST_TRANSPORT_PURPOSE', 'TRANSFER', '仓间调拨'],
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

it('导出文件区分单据与分摊行，保留发生日、所属月和筛选说明', async () => {
  seedBusinessDictionaryForTest('', 'COST_TRANSPORT_KIND', [{ code: 'RAIL', name: '铁路' }])
  const csv = [
    '明细行数,2,匹配单据数,1,已确认金额,80.00',
    "部门筛选,'+测试部门",
    '分析维度,运输渠道,维度选项,dict:COST_TRANSPORT_KIND:RAIL',
    '单据号,事项,费用类别,城市,费用日期,金额（元）,确认状态,付款状态,费用所属月',
    '000123,快递报销,物流运输费用,武汉,2026-09-30,30.00,已确认,已付款,2026-10',
    '000123,采购运费,采购成本,武汉,2026-09-30,50.00,已完善,部分付款,2026-10',
  ].join('\r\n')
  const workbook = await buildCostDashboardWorkbook(csv)
  const restored = new Workbook()
  await restored.xlsx.load(await workbook.xlsx.writeBuffer())
  const sheet = restored.getWorksheet('支出明细')!
  expect(sheet.getCell('E2').value).toEqual(new Date('2026-09-30T00:00:00Z'))
  expect(sheet.getCell('F2').value).toEqual(new Date('2026-10-01T00:00:00Z'))
  expect(sheet.getCell('F2').numFmt).toBe('yyyy-mm')
  expect(sheet.getCell('H2').value).toBe('已确认')
  expect(sheet.getCell('H3').value).toBe('已完善')
  const notes = restored.getWorksheet('导出说明')!
  const entries = new Map()
  notes.eachRow((row) => entries.set(row.getCell(1).value, row.getCell(2).value))
  expect(entries.get('匹配单据数')).toBe('1 笔')
  expect(entries.get('明细行数')).toBe('2 行')
  expect(entries.get('部门筛选')).toBe('+测试部门')
  expect(entries.get('分析维度')).toBe('运输渠道')
  expect(entries.get('维度选项')).toBe('铁路')
  expect(entries.get('统计金额')).toBe('80.00 元')
})

it('配送维度使用订单配送名称，分析和明细保留原分组键', () => {
  seedBusinessDictionaryForTest('', 'COST_TRANSPORT_PURPOSE', [
    { code: 'DELIVERY', name: '销售订单配送' },
  ])
  const key = 'dict:COST_TRANSPORT_PURPOSE:DELIVERY'
  const raw = {
    category: 'freight',
    dimension: 'leg',
    objects: [{ key, label: 'DELIVERY', current: '123.45' }],
  } as CostReport
  expect(resolveObjectLabels(raw).objects[0]).toMatchObject({
    key,
    label: '订单配送',
    current: '123.45',
  })
  expect(detailDimensionValue({ source: 'ORDER', category: 'freight' }, '费用项目', key)).toBe(
    '订单配送',
  )
  expect(recordItem({ itemKey: key, itemName: 'DELIVERY' })).toBe('订单配送')
  const historicalKey = 'dict:COST_LOGISTICS_LEG:DELIVERY'
  expect(dictionaryValue(historicalKey)).toBe('城市仓到客户')
  seedBusinessDictionaryForTest('', 'COST_LOGISTICS_LEG', [
    { code: 'DELIVERY', name: '城市仓配送环节' },
  ])
  expect(dictionaryValue(historicalKey)).toBe('城市仓配送环节')
})

it.each([
  ['COST_LOGISTICS_FEE_TYPE', 'LIFTING_NEW', '吊装费', '吊装费'],
  ['COST_TRANSPORT_PURPOSE', 'DELIVERY', '销售订单配送', '订单配送'],
])(
  'downloaded workbook resolves %s:%s and preserves exact amount and identifiers',
  async (dictionary, code, name, expected) => {
    seedBusinessDictionaryForTest('', dictionary, [{ code, name }])
    const csv = `匹配笔数,1,已确认金额,123.45\r\n单据号,事项,费用类别,城市,费用日期,金额（元）,确认状态,付款状态,费用所属月,费用项目,原始单号\r\n000123,运费,物流运输费用,武汉,2026-11-01,123.45,已确认,未付款,2026-11,dict:${dictionary}:${code},00123456789012345678\r\n`
    const workbook = await buildCostDashboardWorkbook(csv)
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = restored.getWorksheet('支出明细')!
    expect(sheet.columnCount).toBe(11)
    expect(sheet.getCell('A2').value).toBe('000123')
    expect(sheet.getCell('G2').value).toBe(123.45)
    expect(sheet.getCell('J2').value).toBe(expected)
    expect(sheet.getCell('K2').value).toBe('00123456789012345678')
    expect(JSON.stringify(restored.model)).not.toContain('dict:')
  },
)
