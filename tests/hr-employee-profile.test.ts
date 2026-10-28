import { describe, it, expect } from 'vitest'
import {
  identityDetails,
  serviceLength,
  insuranceOptions,
  validateEmployeeProfile,
  probationMonthsValue,
  probationPeriodLabel,
  employeeEmploymentStatusValue,
  employeeEmploymentStatusLabel,
} from '@/utils/hr-employee-profile'
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

describe('员工档案整表校验', () => {
  const form = () => ({
    employeeName: '测试员工',
    remark: null,
    departmentId: 1,
    positionCode: 'SALES',
    mobile: '13800000000',
    email: null,
    entryDate: null,
    leaveDate: null,
    regularized: false,
    payrollCategory: 'SALES',
    employmentStatus: 'ACTIVE',
    revision: 0,
  })
  const profile = () => ({
    idNumber: '11010519491231002X',
    contractEndDate: null,
    education: null,
    registeredAddress: null,
    householdType: null,
    residentialAddress: null,
    bankAccount: null,
    bankName: null,
    socialInsurance: null,
    emergencyContact: null,
    emergencyPhone: null,
  })
  it('基础资料完整即可保存，选填资料不强制，性别由身份证得到', () => {
    expect(validateEmployeeProfile(form(), profile(), '2026-01-01', '', '2026-10-27')).toEqual({})
    expect(identityDetails(profile().idNumber).gender).toBe('女')
  })
  it('员工在职状态只允许在职与离职，旧来源状态需重新选择', () => {
    for (const status of ['INACTIVE', 'PENDING', 'UNKNOWN']) {
      expect(employeeEmploymentStatusValue(status)).toBe('')
      expect(employeeEmploymentStatusLabel(status)).toBe('—')
      expect(
        validateEmployeeProfile(
          { ...form(), employmentStatus: status },
          profile(),
          '2026-01-01',
          '',
        ).employmentStatus,
      ).toBe('请选择在职或离职')
    }
    expect(employeeEmploymentStatusLabel('ACTIVE')).toBe('在职')
    expect(employeeEmploymentStatusLabel('LEFT')).toBe('离职')
  })
  it('手机号、身份证、邮箱和选填银行卡等错误在同一轮全部返回', () => {
    const errors = validateEmployeeProfile(
      {
        ...form(),
        mobile: '123',
        email: 'invalid',
        regularized: true,
        regularizationDate: '2025-01-01',
      },
      { ...profile(), idNumber: '110105194912310020', bankAccount: 'ABC', emergencyPhone: '123' },
      '2026-01-01',
      '',
      '2026-10-27',
    )
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        'mobile',
        'email',
        'profile.idNumber',
        'profile.bankAccount',
        'profile.emergencyPhone',
        'regularizationDate',
      ]),
    )
  })
  it('离职和转正日期按状态校验，实际转正不能晚于今天', () => {
    expect(
      validateEmployeeProfile(
        { ...form(), employmentStatus: 'LEFT' },
        profile(),
        '2026-01-01',
        '',
        '2026-10-27',
      ),
    ).toHaveProperty('leaveDate')
    expect(
      validateEmployeeProfile(
        { ...form(), regularized: true, regularizationDate: '2026-12-01' },
        profile(),
        '2026-01-01',
        '',
        '2026-10-27',
      ).regularizationDate,
    ).toContain('晚于今天')
    expect(
      validateEmployeeProfile(form(), profile(), '2026-02-30', '', '2026-10-27').entryDate,
    ).toContain('格式无效')
  })
})

it('试用期数字月数兼容旧文字，详情单位只显示一次', () => {
  expect(probationMonthsValue('3个月')).toBe(3)
  expect(probationMonthsValue('3')).toBe(3)
  expect(probationMonthsValue('0')).toBe(0)
  expect(probationMonthsValue('三个月')).toBeUndefined()
  expect(probationPeriodLabel('3')).toBe('3个月')
  expect(probationPeriodLabel('3个月')).toBe('3个月')
  expect(probationPeriodLabel(null)).toBe('—')
})
