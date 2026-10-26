import { randomId } from '@/utils/random-id'
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import type { PayrollMetricDefinition } from '@/api/core/payroll-scheme/models/PayrollMetricDefinition'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { newStatutoryWorkCalendar } from './hr-work-calendar'
export const payrollRoles = [
  { value: 'SALES', label: '销售' },
  { value: 'CITY_MANAGER', label: '城市总' },
  { value: 'TRAINEE_MANAGER', label: '见习城市总' },
  { value: 'HEADQUARTERS', label: '总部人员' },
]
export const prorationOptions = [
  { value: 'NONE', label: '不折算' },
  { value: 'CALENDAR_DAYS', label: '按在职自然日' },
  { value: 'WORK_DAYS', label: '按在职工作日' },
  { value: 'CONFIRMED_ATTENDANCE', label: '按已确认出勤' },
]
export function managerCompletionSteps(): PayrollMetricStep[] {
  return [
    {
      lower: 0,
      upper: 1,
      lowerInclusive: true,
      upperInclusive: true,
      mode: 'LINEAR',
      coefficient: 1,
    },
    {
      lower: 1,
      upper: null,
      lowerInclusive: false,
      upperInclusive: false,
      mode: 'FIXED',
      coefficient: 1.2,
    },
  ]
}
export function newPayrollMetric(): PayrollMetricDefinition {
  return {
    code: randomId(),
    name: '',
    source: 'MANUAL_CONFIRMED',
    cityMetric: null,
    target: null,
    weight: null,
    scoringMode: 'TIERED',
    cap: null,
    steps: managerMetricScoringSteps(),
  }
}
export function managerMetricScoringSteps(): PayrollMetricStep[] {
  return [
    {
      lower: 0,
      upper: 1,
      lowerInclusive: true,
      upperInclusive: false,
      mode: 'LINEAR',
      coefficient: 1,
    },
    {
      lower: 1,
      upper: 1.5,
      lowerInclusive: true,
      upperInclusive: false,
      mode: 'FIXED',
      coefficient: 1,
    },
    {
      lower: 1.5,
      upper: 2,
      lowerInclusive: true,
      upperInclusive: false,
      mode: 'FIXED',
      coefficient: 1.2,
    },
    {
      lower: 2,
      upper: null,
      lowerInclusive: true,
      upperInclusive: false,
      mode: 'FIXED',
      coefficient: 1.5,
    },
  ]
}
export function newSchemeCommission(): PayrollSchemeCommissionRule {
  return {
    code: randomId(),
    name: '',
    recipientRole: 'SALES',
    categoryIds: [],
    excludedCategoryIds: [],
    variantIds: [],
    excludedVariantIds: [],
    method: 'PERCENT',
    value: null,
    unitCode: '',
    excluded: false,
  }
}
export function newPayrollScheme(): PayrollSchemeDefinition {
  const month = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  return {
    name: '',
    role: 'SALES',
    departmentIds: [],
    employeeCodes: [],
    effectiveFrom: `${month}-01`,
    effectiveTo: '9999-12-31',
    baseSalary: {
      mode: 'TIERS',
      fixedAmount: null,
      firstMonthTier: 'BRONZE',
      tiers: [
        {
          code: 'BRONZE',
          name: '铜牌',
          lower: 0,
          upper: 10000,
          lowerInclusive: true,
          upperInclusive: false,
          amount: null,
          performanceBase: null,
        },
        {
          code: 'SILVER',
          name: '银牌',
          lower: 10000,
          upper: 15000,
          lowerInclusive: true,
          upperInclusive: true,
          amount: null,
          performanceBase: null,
        },
        {
          code: 'GOLD',
          name: '金牌',
          lower: 15000,
          upper: null,
          lowerInclusive: false,
          upperInclusive: false,
          amount: null,
          performanceBase: null,
        },
      ],
    },
    performanceBase: null,
    performanceMode: 'SALES',
    sales: {
      checkinCountMode: 'UNIQUE_CUSTOMER',
      processPercent: 40,
      dailyCheckins: 7,
      checkinPenalty: 20,
      dailyVisits: 3,
      minimumSeconds: 600,
      visitPenalty: 30,
      firstMonthExempt: true,
      processProtectionDays: 10,
      resultCap: 1,
      targets: [
        { fromMonth: 2, toMonth: 2, target: 5000 },
        { fromMonth: 3, toMonth: null, target: 7000 },
      ],
    },
    manager: {
      metrics: [],
      protection: { unit: 'MONTHS', count: 1, assessUnprotectedOnly: true },
      calculationMode: 'ACTUAL_COMPLETION',
      cap: null,
      steps: [],
    },
    calendar: newStatutoryWorkCalendar(),
    proration: { base: 'NONE', performance: 'NONE', allowance: 'NONE' },
    allowances: [
      { code: 'VEHICLE', name: '交通补贴', amount: 500 },
      { code: 'PHONE', name: '话费补贴', amount: 150 },
      { code: 'COMPUTER', name: '电脑补贴', amount: 100 },
    ],
    commission: { managerAttribution: 'ORDER_DATE', standardDate: 'ORDER_DATE', rules: [] },
    remark: '',
  }
}
