import { describe, expect, it } from 'vitest'
import { buildCostWorkbook } from '@/views/supply-chain/cost/cost-export'
import { Workbook } from 'exceljs'
import {
  costSnapshotFields,
  costExportHeaders,
  costExportFields,
} from '@/views/supply-chain/cost/cost-audit'
import type { CostRecord } from '@/api/core/cost'
import {
  buildCostDashboardWorkbook,
  parseCostCsv,
} from '@/views/supply-chain/bi/cost/cost-report-export'
describe('cost Excel export', () => {
  it('exports a readable trip purpose separately from its reference number', () => {
    const fields = costSnapshotFields({
      data: {
        typeCode: 'TRAVEL',
        expense: { purpose: '赴武汉门店培训与经营巡检', tripReference: 'TEST-TRIP-20261017-WH' },
      },
    })
    expect(fields).toContainEqual({ label: '出差事项', value: '赴武汉门店培训与经营巡检' })
    expect(fields).toContainEqual({ label: '出差事项编号', value: 'TEST-TRIP-20261017-WH' })
    const headers = costExportHeaders('expenses')
    const exported = costExportFields({
      ownerEmployeeName: '王明',
      data: {
        typeCode: 'TRAVEL',
        expense: {
          purpose: '赴武汉门店培训与经营巡检',
          tripReference: 'TEST-TRIP-20261017-WH',
        },
      },
    } as unknown as CostRecord)
    expect(headers).toContain('费用用途／出差事由')
    expect(exported).toContainEqual({
      label: '费用用途／出差事由',
      value: '赴武汉门店培训与经营巡检',
    })
    expect(exported).toContainEqual({ label: '报销员工', value: '王明' })
    expect(headers).not.toEqual(
      expect.arrayContaining(['记录ID', '版本', '出差事项编号', '录入人', '修改人']),
    )
  })
  it('快递导出和查看保留可读业务要素及前导零运单', async () => {
    const row = {
      data: {
        typeCode: 'COURIER',
        amount: 18,
        expense: {
          costCategory: 'expense',
          purpose: '寄合作合同',
          courier: {
            contents: '双方盖章合同',
            recipientName: '合作门店',
            companyName: '顺丰速运',
            trackingNo: '00001234',
          },
        },
      },
    } as unknown as CostRecord
    const fields = costExportFields(row)
    const headers = costExportHeaders('expenses')
    for (const label of ['寄送内容', '收件客户 / 合作方', '快递公司', '运单号'])
      expect(headers).toContain(label)
    expect(fields).toContainEqual({ label: '寄送内容', value: '双方盖章合同' })
    expect(fields).toContainEqual({ label: '运单号', value: '00001234' })
    const book = await buildCostWorkbook('报销费用', headers, [
      headers.map((header) => fields.find((field) => field.label === header)?.value || ''),
    ])
    expect(book.worksheets[0]!.getCell(2, headers.indexOf('运单号') + 1).value).toBe('00001234')
  })
  it('round trips leading-zero documents, literal formula text, zero and missing amounts', async () => {
    const workbook = await buildCostWorkbook(
      '运费',
      ['原始单号', '金额', '来源'],
      [
        ['0000123', 0, '订货宝'],
        ['=1+1', null, '手工补录'],
        ['0000124', 12.34, '本系统'],
      ],
    )
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = restored.worksheets[0]!
    expect(sheet.getCell('A2').value).toBe('0000123')
    expect(sheet.getCell('B2').value).toBe(0)
    expect(sheet.getCell('A3').value).toBe('=1+1')
    expect(sheet.getCell('B3').value).toBeNull()
    expect(sheet.getCell('B4').value).toBe(12.34)
    expect(sheet.rowCount).toBe(4)
    expect(sheet.getColumn(2).numFmt).toBe('#,##0.00')
    expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF305786' } })
    expect(sheet.autoFilter).toBe('A1:C4')
  })
  it('keeps dates sortable with explicit calendar formats and preserves missing amounts', async () => {
    const workbook = await buildCostWorkbook(
      '报销费用',
      ['费用日期', '费用月份', '录入时间', '进货单价', '金额'],
      [['2026-09-30', '2026-10', '2026-10-22 10:07:45', '4.500001', '待补金额']],
    )
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = restored.worksheets[0]!
    expect(sheet.getCell('A2').value).toEqual(new Date('2026-09-30T00:00:00Z'))
    expect(sheet.getCell('B2').numFmt).toBe('yyyy-mm')
    expect(sheet.getCell('C2').numFmt).toBe('yyyy-mm-dd hh:mm:ss')
    expect(sheet.getCell('D2').value).toBe(4.500001)
    expect(sheet.getCell('E2').value).toBe('待补金额')
  })
  const csv = (records: string[][]) =>
    '\uFEFF' +
    records
      .map((row) => row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(','))
      .join('\r\n') +
    '\r\n'
  const data = [
    ['指标口径', 'cost-v8', '快照', 'internal-snapshot', '更新时间', '2026-10-22T02:07:45.587201Z'],
    ['本期', '2026-10-01 至 2026-10-22', '可比期', '2026-09-01 至 2026-09-22'],
    [
      '筛选范围',
      '经营费用',
      '城市',
      '全部授权城市',
      '类别',
      '全部',
      '维度',
      '全部',
      '对象',
      '全部',
      '状态',
      '已确认',
      '付款',
      '全部',
      '期间',
      '本期',
      '搜索',
      '',
    ],
    ['匹配笔数', '3', '已确认金额', '60.10', '待确认已填金额', '0'],
    [
      '来源服务',
      '源ID',
      '单据号',
      '事项',
      '费用类别',
      '城市',
      '费用日期',
      '金额（元）',
      '确认状态',
      '付款状态',
      '原始来源',
      '费用所属月',
      '成本处理',
      '计入成本金额（元）',
    ],
    [
      'ORDER',
      'internal-source-1',
      '0000123',
      '运输,含"装卸"\n送达',
      '运费',
      '武汉',
      '2026-10-21',
      '60.10',
      '已确认',
      '未付款',
      'NONE',
      '2026-10',
      'DIRECT',
      '60.10',
    ],
    [
      'HR',
      'internal-source-2',
      'EXP1',
      "'=1+1",
      '运费',
      '武汉',
      '2026-10-21',
      '60.10',
      '已确认',
      '未付款',
      '',
      '2026-10',
      'LINKED',
      '0.00',
    ],
    [
      'HR',
      'internal-source-3',
      'EXP2',
      '待补记录',
      '员工报销',
      '武汉',
      '2026-10-21',
      '',
      '待确认',
      '未付款',
      '',
      '2026-10',
      'REVIEW',
      '0.00',
    ],
  ]
  it('exports only business columns and keeps amounts without exposing processing metadata', async () => {
    const workbook = await buildCostDashboardWorkbook(
      csv(data),
      '2026年10月 / 本期 / 武汉市 / 经营费用 / 未付款',
    )
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = restored.getWorksheet('支出明细')!
    expect(sheet.getCell('A2').value).toBe('0000123')
    expect(sheet.getCell('B2').value).toBe('运输,含"装卸"\n送达')
    expect(sheet.getCell('B3').value).toBe('=1+1')
    expect(sheet.getCell('G2').value).toBe(60.1)
    expect(sheet.getCell('H3').value).toBe('已确认')
    expect(sheet.getCell('I3').value).toBe('未付款')
    expect(sheet.getCell('G4').value).toBeNull()
    expect(sheet.columnCount).toBe(9)
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      '单据号',
      '事项',
      '费用类别',
      '费用归属',
      '费用日期',
      '费用所属月份',
      '单据金额（元）',
      '确认状态',
      '付款状态',
    ])
    expect(restored.worksheets).toHaveLength(2)
    const note = restored.getWorksheet('导出说明')!
    expect(note.getCell('B2').value).toBe('2026年10月 / 本期 / 武汉市 / 经营费用 / 未付款')
    expect(note.getCell('B3').value).toBe('2026-10-01 至 2026-10-22')
    expect(note.getCell('B5').value).toBe('3 笔')
    expect(note.getCell('B6').value).toBe('60.10 元')
    expect(JSON.stringify(restored.model)).not.toMatch(
      /internal-source|internal-snapshot|DIRECT|LINKED|REVIEW|587201Z|统计处理|成本处理|计入成本金额/,
    )
    expect(sheet.getRow(1).values).not.toEqual(
      expect.arrayContaining(['业务来源', '来源方式', '更新时间']),
    )
  })
  it('accepts the current business-only server export as well as historical CSV responses', async () => {
    const headers = [
      '单据号',
      '事项',
      '费用类别',
      '城市',
      '费用日期',
      '金额（元）',
      '确认状态',
      '付款状态',
      '费用所属月',
    ]
    const originalHeaders = data[4]!
    const content = csv([
      ['匹配笔数', '3'],
      headers,
      ...data.slice(5).map((row) => headers.map((header) => row[originalHeaders.indexOf(header)]!)),
    ])
    const workbook = await buildCostDashboardWorkbook(content)
    expect(workbook.getWorksheet('支出明细')!.columnCount).toBe(9)
    expect(workbook.getWorksheet('支出明细')!.getCell('G2').value).toBe(60.1)
  })
  it('rejects incomplete or mismatched exports instead of downloading a partial report', async () => {
    expect(() => parseCostCsv('"broken')).toThrow('不完整')
    await expect(buildCostDashboardWorkbook(csv(data.slice(0, -1)))).rejects.toThrow('笔数')
    await expect(
      buildCostDashboardWorkbook(csv(data.map((row, i) => (i === 5 ? row.slice(0, -1) : row)))),
    ).rejects.toThrow('明细')
  })
})
