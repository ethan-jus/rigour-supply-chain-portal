import { expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import { buildMonthlyPerformanceWorkbook, performanceMonths } from '@/utils/monthly-performance-export'
import type { MonthlyPerformanceReport } from '@/api/core/order-register'
const report: MonthlyPerformanceReport = {
  monthFrom: '2026-04', monthTo: '2026-09', generatedAt: '2026-09-22T12:00:00Z', rows: [
    { month: '2026-04', regionCode: 'HZ', regionName: '杭州', employeeCode: 'E1', employeeName: '张三', transactionAmount: 100.10, receivedAmount: 60.10, unpaidAmount: 40 },
    { month: '2026-04', regionCode: 'HZ', regionName: '杭州', employeeCode: 'E2', employeeName: '李四', transactionAmount: 50.20, receivedAmount: 40.20, unpaidAmount: 10 },
    { month: '2026-05', regionCode: 'BJ', regionName: '北京', employeeCode: 'E1', employeeName: '张三', transactionAmount: 20, receivedAmount: 5, unpaidAmount: 15 },
  ],
}
it('双Sheet按月排列，销售前有城市，填齐无业务月份，合计为可计算公式', async () => {
  const workbook = await buildMonthlyPerformanceWorkbook(report)
  const city=workbook.worksheets[0]!, sales=workbook.worksheets[1]!
  expect(workbook.worksheets.map(s => s.name)).toEqual(['城市月业绩','销售月业绩'])
  expect(city.getCell('A2').value).toContain('实际到账月份')
  expect(city.getCell('E5').value).toBe('月末未回款额')
  expect(city.getCell('C6').numFmt).toContain('#,##0.00')
  expect(city.getCell('C8').alignment.horizontal).toBe('right')
  expect(city.getCell('C4').value).toBe('2026年4月')
  expect(city.getCell('R4').value).toBe('2026年9月')
  expect(sales.getCell('B4').value).toBe('城市')
  expect(sales.getCell('C4').value).toBe('销售')
  const hz=[6,7].find(row => city.getCell(row,2).value==='杭州')!
  expect(city.getCell(hz,3).value).toBe(150.30)
  expect(city.getCell(hz,4).value).toBe(100.30)
  expect(city.getCell(hz,5).value).toBe(50)
  expect(city.getCell(hz,18).value).toBe(0)
  expect(city.getCell('C8').value).toEqual({ formula: 'SUM(C6:C7)', result: 150.30 })
  expect(sales.getCell('D9').value).toEqual({ formula: 'SUM(D6:D8)', result: 150.30 })
  expect(sales.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 5 })
  const bytes=await workbook.xlsx.writeBuffer()
  const reopened=new Workbook(); await reopened.xlsx.load(bytes)
  expect(reopened.worksheets).toHaveLength(2)
  expect(reopened.worksheets[0]!.getCell(hz,3).value).toBe(150.30)
  expect(reopened.worksheets[0]!.getCell('C8').value).toEqual({ formula: 'SUM(C6:C7)', result: 150.30 })
})
it('空表依然有4至9月列，不产生循环合计，月份范围校验有效', async () => {
  const workbook=await buildMonthlyPerformanceWorkbook({ ...report, rows: [] })
  expect(workbook.worksheets[0]!.getCell('C6').value).toBe(0)
  expect(performanceMonths('2026-12','2027-02')).toEqual(['2026-12','2027-01','2027-02'])
  expect(() => performanceMonths('2026-09','2026-04')).toThrow()
  expect(() => performanceMonths('2026-13','2026-14')).toThrow()
})
