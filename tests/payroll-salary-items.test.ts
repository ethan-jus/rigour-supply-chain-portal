import { describe, expect, it } from 'vitest'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollSalaryItems } from '@/utils/payroll-salary-items'

function record(): PayrollRecord {
  return {
    payments: [],
    calculation: {
      baseSalary: 3000,
      performance: 598.8,
      allowance: 750,
      commission: 304.07,
      correctionAmount: 0,
      corrections: [],
      deduction: 0,
      grossPay: 4652.87,
      netPay: 4652.87,
      input: {},
      performanceDetail: {
        processBudget: 400,
        processDeduction: 400,
        processPay: 0,
        collectionBudget: 600,
        collectionTarget: 7000,
        collections: 6986,
        collectionPay: 598.8,
      },
      scheme: {
        salaryTier: 'BRONZE',
        performanceBase: 1000,
        scheme: {
          definition: {
            role: 'SALES',
            baseSalary: { tiers: [{ code: 'BRONZE', name: '铜牌', amount: 3000 }] },
            allowances: [
              { name: '交通', amount: 500 },
              { name: '话费', amount: 150 },
              { name: '电脑', amount: 100 },
            ],
          },
        },
      },
    },
  } as unknown as PayrollRecord
}

describe('工资组成展示与核算快照对账', () => {
  it('分开两项绩效和三项补贴，不重复从应付扣绩效缺额', () => {
    const rows = payrollSalaryItems(record())
    expect(rows.map((r) => r.name)).toEqual([
      '底薪',
      '打卡与有效拜访绩效',
      '回款达标绩效',
      '交通',
      '话费',
      '电脑',
      '商品提成',
      '补发补扣',
      '应发工资',
      '其他扣款',
      '应付工资',
      '实际发放',
    ])
    expect(rows[1]).toMatchObject({ standard: 400, change: -400, amount: 0 })
    expect(rows[2]).toMatchObject({ change: -1.2, amount: 598.8 })
    expect(rows.slice(0, 8).reduce((s, r) => s + (r.amount ?? 0), 0)).toBeCloseTo(4652.87, 2)
    expect(rows.find((r) => r.name === '应付工资')?.amount).toBe(4652.87)
  })
  it('折算或人工核定差额单列，分项始终与最终工资快照一致', () => {
    const data = record()
    data.calculation.performance = 500
    data.calculation.allowance = 375
    const rows = payrollSalaryItems(data)
    expect(rows.find((r) => r.name === '绩效折算 / 核定差额')?.amount).toBe(-98.8)
    expect(rows.find((r) => r.name === '补贴折算 / 核定差额')?.amount).toBe(-375)
    expect(
      rows.filter((r) => r.name.includes('绩效')).reduce((s, r) => s + (r.amount ?? 0), 0),
    ).toBeCloseTo(500, 2)
  })
  it('缺失金额保留未知，不能把来源失败显示成无扣减或零工资', () => {
    const data = record()
    data.calculation.performance = null
    data.calculation.netPay = null
    const rows = payrollSalaryItems(data)
    expect(rows.find((r) => r.name === '绩效折算 / 核定差额')?.amount).toBeNull()
    expect(rows.find((r) => r.name === '应付工资')?.amount).toBeNull()
  })
  it('城市总只展示一项绩效并使用登记的实际发放', () => {
    const data = record()
    data.calculation.performanceDetail = null
    data.calculation.scheme!.scheme.definition.role = 'CITY_MANAGER'
    data.payments = [{ amount: 1000 }, { amount: 500 }] as PayrollRecord['payments']
    const rows = payrollSalaryItems(data)
    expect(rows.some((r) => r.name === '打卡与有效拜访绩效')).toBe(false)
    expect(rows.find((r) => r.name === '城市总绩效')?.amount).toBe(598.8)
    expect(rows.find((r) => r.name === '实际发放')?.amount).toBe(1500)
  })
})
