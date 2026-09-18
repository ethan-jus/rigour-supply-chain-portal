import { describe, it, expect } from 'vitest'
import { identityDetails, serviceLength, insuranceOptions } from '@/utils/hr-employee-profile'
import { displayDateTime } from '@/utils/business-date'
describe('员工身份与业务日期', () => {
  it('身份证自动解析，校验失败不展示伪造的年龄和性别', () => {
    expect(
      identityDetails('11010519491231002x', new Date('2026-09-16T12:00:00+08:00')),
    ).toMatchObject({ birthDate: '1949-12-31', gender: '女', age: '76 岁', error: '' })
    expect(identityDetails('110105194912310020').birthDate).toBe('')
    expect(identityDetails('11010519490230002X').error).not.toBe('')
  })
  it('离职工龄停止累计，日期显示固定格式及北京时间', () => {
    expect(serviceLength('2020-01-15', '2023-03-14')).toBe('3年1个月')
    expect(serviceLength('2020-01-15', '2023-03-15')).toBe('3年2个月')
    expect(displayDateTime('2026-09-16T01:02:03Z')).toBe('2026-09-16 09:02:03')
    expect(displayDateTime('bad')).toBe('—')
    expect(insuranceOptions).toEqual(['五险一金', '五险', '公积金', '未参保'])
  })
})
