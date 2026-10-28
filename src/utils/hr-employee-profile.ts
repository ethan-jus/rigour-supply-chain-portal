import { auditActorLabel } from './audit-actor'
import { displayDateTime, businessDate } from './business-date'
import type { HrEmployeeCommand, HrEmployeeProfile } from '@/api/core/hr'
export function identityDetails(raw: string | null | undefined, today = new Date()) {
  const id = raw?.trim().toUpperCase() ?? ''
  if (!id) return { birthDate: '', gender: '', age: '', error: '' }
  const invalid = { birthDate: '', gender: '', age: '', error: '请输入有效的18位身份证号' }
  if (!/^[1-9]\d{16}[\dX]$/.test(id)) return invalid
  const year = Number(id.slice(6, 10)),
    month = Number(id.slice(10, 12)),
    day = Number(id.slice(12, 14))
  const birth = new Date(year, month - 1, day)
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    birth > today
  )
    return invalid
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  if ('10X98765432'[weights.reduce((sum, w, i) => sum + Number(id[i]) * w, 0) % 11] !== id[17])
    return invalid
  const age =
    today.getFullYear() -
    year -
    (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)
      ? 1
      : 0)
  return {
    birthDate: `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`,
    gender: Number(id[16]) % 2 ? '男' : '女',
    age: `${age} 岁`,
    error: '',
  }
}
export function dateOnly(value?: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function serviceLength(entry?: string | null, leave?: string | null, today = new Date()) {
  const start = dateOnly(entry),
    end = dateOnly(leave) || dateOnly(today.toISOString())
  if (!start || end < start) return '—'
  const a = new Date(`${start}T00:00:00`),
    b = new Date(`${end}T00:00:00`)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
  if (b.getDate() < a.getDate()) months--
  return months < 1 ? '不足1个月' : `${Math.floor(months / 12)}年${months % 12}个月`
}
export function auditActor(name?: string | null, id?: string | null) {
  return name || auditActorLabel(id)
}
export const auditTime = displayDateTime
export const educationOptions = [
  '小学',
  '初中',
  '高中',
  '中专',
  '大专',
  '本科',
  '硕士',
  '博士',
  '其他',
]
export const householdOptions = ['农业户口', '非农业户口', '居民户口', '其他']
export const insuranceOptions = ['五险一金', '五险', '公积金', '未参保']
export const employeeEmploymentStatuses = ['ACTIVE', 'LEFT'] as const
export function employeeEmploymentStatusValue(value?: string | null): string {
  return employeeEmploymentStatuses.includes(value as 'ACTIVE' | 'LEFT') ? value! : ''
}
export function employeeEmploymentStatusLabel(value?: string | null): string {
  return value === 'ACTIVE' ? '在职' : value === 'LEFT' ? '离职' : '—'
}

/** 新增和编辑共用的整表校验；身份证有效时自动得到出生日期及性别。 */
export function validateEmployeeProfile(
  form: HrEmployeeCommand,
  profile: HrEmployeeProfile,
  entry: string,
  leave: string,
  today = businessDate(new Date()),
): Record<string, string> {
  const errors: Record<string, string> = {}
  const value = (v: string | null | undefined) => v?.trim() || ''
  const required = (key: string, v: string | null | undefined, label: string, max: number) => {
    if (!value(v)) errors[key] = `请填写${label}`
    else if (value(v).length > max) errors[key] = `${label}长度不能超过${max}字`
  }
  const optional = (key: string, v: string | null | undefined, label: string, max: number) => {
    if (value(v).length > max) errors[key] = `${label}长度不能超过${max}字`
  }
  const validDate = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  required('employeeName', form.employeeName, '姓名', 128)
  if (!form.departmentId || !Number.isInteger(form.departmentId) || form.departmentId <= 0)
    errors.departmentId = '请选择有效部门'
  required('positionCode', form.positionCode, '岗位', 50)
  required('mobile', form.mobile, '手机号', 32)
  if (value(form.mobile) && !/^1[3-9]\d{9}$/.test(value(form.mobile)))
    errors.mobile = '请输入有效的11位手机号'
  required('profile.idNumber', profile.idNumber, '身份证号', 18)
  if (value(profile.idNumber)) {
    const identity = identityDetails(profile.idNumber, new Date(`${today}T23:59:59+08:00`))
    if (identity.error) errors['profile.idNumber'] = identity.error
    else if (entry && identity.birthDate > entry) errors.entryDate = '入职日期不能早于出生日期'
  }
  if (!entry) errors.entryDate = '请填写入职日期'
  else if (!validDate(entry)) errors.entryDate = '入职日期格式无效'
  if (!employeeEmploymentStatusValue(form.employmentStatus))
    errors.employmentStatus = '请选择在职或离职'
  if (!form.payrollCategory) errors.payrollCategory = '请选择薪酬类别'
  else if (!['SALES', 'HEADQUARTERS'].includes(form.payrollCategory))
    errors.payrollCategory = '薪酬类别无效'
  if (typeof form.regularized !== 'boolean') errors.regularized = '请选择是否转正'
  if (form.regularized) {
    const date = form.regularizationDate || ''
    if (!date) errors.regularizationDate = '请填写实际转正日期'
    else if (!validDate(date)) errors.regularizationDate = '转正日期格式无效'
    else if (entry && date < entry) errors.regularizationDate = '转正日期不能早于入职日期'
    else if (date > today) errors.regularizationDate = '实际转正日期不能晚于今天'
  }
  if (form.employmentStatus === 'LEFT') {
    if (!leave) errors.leaveDate = '离职员工必须填写离职日期'
    else if (!validDate(leave)) errors.leaveDate = '离职日期格式无效'
    else if (entry && leave < entry) errors.leaveDate = '离职日期不能早于入职日期'
  }
  optional('email', form.email, '邮箱', 128)
  if (value(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value(form.email)))
    errors.email = '邮箱格式不正确'
  optional('jobGrade', form.jobGrade, '职级', 32)
  optional('remark', form.remark, '备注', 500)
  const fields: [keyof HrEmployeeProfile, string, number][] = [
    ['education', '学历', 32],
    ['graduationSchool', '毕业院校', 128],
    ['major', '专业', 128],
    ['householdType', '户口性质', 32],
    ['registeredAddress', '户籍地址', 300],
    ['residentialAddress', '现居住地', 300],
    ['bankAccount', '银行卡号', 32],
    ['bankName', '开户行', 128],
    ['socialInsurance', '参保状态', 32],
    ['emergencyContact', '紧急联系人', 128],
    ['emergencyPhone', '紧急联系方式', 32],
    ['probationPeriod', '试用期', 32],
    ['regularSalary', '转正底薪', 64],
    ['probationSalary', '试用期底薪', 64],
  ]
  for (const [key, label, max] of fields) optional(`profile.${key}`, profile[key], label, max)
  if (value(profile.bankAccount) && !/^\d{10,32}$/.test(value(profile.bankAccount)))
    errors['profile.bankAccount'] = '银行卡号须为10至32位数字'
  if (
    value(profile.emergencyPhone) &&
    !/^(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8}(?:-\d{1,6})?|\+[1-9]\d{5,19})$/.test(
      value(profile.emergencyPhone),
    )
  )
    errors['profile.emergencyPhone'] = '紧急联系方式须为有效手机号、座机号或带区号的国际号码'
  if (
    profile.contractEndDate &&
    (!validDate(profile.contractEndDate) || (!!entry && profile.contractEndDate < entry))
  )
    errors['profile.contractEndDate'] = '合同截止日期须为不早于入职日期的有效日期'
  if (profile.socialInsurance && !insuranceOptions.includes(value(profile.socialInsurance)))
    errors['profile.socialInsurance'] = '参保状态选项无效'
  if (profile.education && !educationOptions.includes(value(profile.education)))
    errors['profile.education'] = '学历选项无效'
  if (profile.householdType && !householdOptions.includes(value(profile.householdType)))
    errors['profile.householdType'] = '户口性质选项无效'
  if (value(profile.probationPeriod) && probationMonthsValue(profile.probationPeriod) == null)
    errors['profile.probationPeriod'] = '试用期请填写不小于0的整数，单位为月'
  return errors
}

export function probationMonthsValue(raw?: string | null): number | undefined {
  const match = raw?.trim().match(/^(\d+)\s*(?:个?月)?$/)
  if (!match) return undefined
  const months = Number(match[1])
  return Number.isSafeInteger(months) ? months : undefined
}
export function probationPeriodLabel(raw?: string | null): string {
  if (!raw?.trim()) return '—'
  const months = probationMonthsValue(raw)
  return months == null ? raw : `${months}个月`
}
