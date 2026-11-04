import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import type { PayrollRecord, PayrollCommissionReview } from '@/api/core/payroll'
import { buildCommissionReviewWorkbook } from '@/utils/payroll-commission-review-export'
import { clearBusinessDictionariesForTest, seedBusinessDictionaryForTest } from '@/utils/business-dictionary'

beforeEach(() => seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [{ code: 'SET', name: '套' }]))
afterEach(clearBusinessDictionariesForTest)

describe('历史提成只读试算导出', () => {
  const saved = { id: 'P', revision: 1, month: '2026-10', employeeCode: 'E', statusCode: 'REVIEW', calculation: { sourceFingerprint: 'saved' } } as PayrollRecord
  const review: PayrollCommissionReview = { payrollId: 'P', payrollRevision: 1, month: '2026-10', employeeCode: 'E', employeeName: '测试销售', sourceFingerprint: 'saved', savedCommission: null, previewCommission: 40, difference: null, resolvedSubtotal: 40, lines: [], issues: [] }
  it('原提成未核定不按零生成差额，已匹配小计与完整提成分开', async () => {
    const book = await buildCommissionReviewWorkbook([saved], [review])
    const sheet = book.worksheets[0]!
    expect(sheet.getCell('E2').value).toBe('-')
    expect(sheet.getCell('F2').value).toBe(40)
    expect(sheet.getCell('G2').value).toBe('-')
    expect(sheet.getCell('I2').value).toContain('未保存工资')
    const pending = await buildCommissionReviewWorkbook([saved], [{ ...review, previewCommission: null, issues: ['鹰眼缺标准'] }])
    expect(pending.worksheets[0]!.getCell('F2').value).toBe('-')
    expect(pending.worksheets[0]!.getCell('H2').value).toBe(40)
  })
  it('必须与所选工资的人员、版本、来源指纹完全一致', async () => {
    for (const bad of [{ ...review, sourceFingerprint: 'changed' }, { ...review, payrollRevision: 2 }, { ...review, employeeCode: 'OTHER' }])
      await expect(buildCommissionReviewWorkbook([saved], [bad])).rejects.toThrow('不一致')
    await expect(buildCommissionReviewWorkbook([saved], [review, review])).rejects.toThrow('不一致')
  })
})
