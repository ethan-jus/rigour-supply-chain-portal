/** 仅用于隔离页面验收，所有 HTTP 均拦截，不连接真实业务服务。 */
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import Rules from '@/views/supply-chain/hr/HrAttendanceRuleView.vue'
import Attendance from '@/views/supply-chain/hr/HrAttendanceView.vue'
import { apiClient } from '@/api/core/client'
import { useAuthStore } from '@/stores/auth'
import type {
  AttendanceRecordCommand,
  AttendanceRow,
  AttendanceRule,
  AttendanceRuleCommand,
  AttendanceView,
} from '@/api/core/hr-attendance'

const rules = new Map<string, AttendanceRule>()
const confirmations = new Map<string, AttendanceRow>()
let currentRows: AttendanceRow[] = []
const notes = new Map<string, AttendanceRecordCommand>()
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
function previewRule(month: string, departmentId: number | null = null): AttendanceRule {
  const company = rules.get(`${month}:0`)
  const own = rules.get(`${month}:${departmentId ?? 0}`)
  return {
    month,
    departmentId,
    expectedDays: own?.expectedDays ?? null,
    revision: own?.revision ?? 0,
    companyExpectedDays: company?.expectedDays ?? null,
    locked: [...confirmations.entries()].some(
      ([key, row]) =>
        key.startsWith(`${month}:`) &&
        (departmentId == null
          ? row.ruleSource === 'COMPANY'
          : row.employeeCode === 'PREVIEW-1'
            ? departmentId === 2
            : departmentId === 3),
    ),
  }
}
const previewMonth = today.slice(0, 7)
for (const [id, days] of [
  [0, 26],
  [2, 24],
] as const) {
  rules.set(`${previewMonth}:${id}`, {
    month: previewMonth,
    departmentId: id || null,
    expectedDays: days,
    revision: 1,
    companyExpectedDays: 26,
    locked: false,
  })
}
apiClient.defaults.adapter = async (config) => {
  const url = config.url ?? ''
  let body: unknown
  if (url.endsWith('/business-settings/dictionaries/resolve')) {
    body = {
      dictionary: { dictionaryCode: config.params.dictionaryCode },
      items: (config.params.dictionaryCode === 'ATTENDANCE_STATUS'
        ? [
            ['PENDING', '待确认'],
            ['CONFIRMED', '已确认'],
          ]
        : [
            ['NONE', '无'],
            ['COMP_TIME', '调休'],
            ['PERSONAL', '事假'],
            ['SICK', '病假'],
          ]
      ).map(([code, name], index) => ({
        id: `preview-${index}`,
        dictionaryCode: config.params.dictionaryCode,
        dictionaryItemCode: code,
        dictionaryItemName: name,
        dictionaryItemLevel: 1,
        parentDictionaryItemCode: null,
        ordinal: index,
        revision: 1,
        enabled: true,
      })),
    }
  } else if (url.endsWith('/attendance/departments')) {
    body = [
      { id: 1, parentId: null, departmentName: '销售部', sortOrder: 0 },
      { id: 2, parentId: 1, departmentName: '销售一部', sortOrder: 0 },
      { id: 3, parentId: 1, departmentName: '销售二部', sortOrder: 1 },
    ]
  } else if (url.endsWith('/attendance/rules')) {
    const month = config.params.month as string
    const all = [...rules.values()]
      .filter((r) => r.month === month && r.expectedDays != null)
      .sort((a, b) => (a.departmentId ?? 0) - (b.departmentId ?? 0))
      .map((r) => ({
        ...r,
        locked: previewRule(month, r.departmentId).locked,
        departmentName:
          r.departmentId === 2
            ? '销售一部'
            : r.departmentId === 3
              ? '销售二部'
              : r.departmentId === 1
                ? '销售部'
                : '公司默认',
        updatedTime: new Date().toISOString(),
      }))
    const rows = all.filter(
      (r) =>
        (config.params.departmentId == null ||
          (r.departmentId ?? 0) === config.params.departmentId) &&
        (!config.params.status || r.locked === (config.params.status === 'LOCKED')),
    )
    body = {
      month,
      companyExpectedDays: previewRule(month).expectedDays,
      configuredDepartmentIds: all.map((r) => r.departmentId ?? 0),
      lockedDepartmentIds: [0, 1, 2, 3].filter((id) => previewRule(month, id || null).locked),
      page: {
        total: rows.length,
        begin: config.params.begin,
        step: config.params.step,
        items: rows.slice(config.params.begin, config.params.begin + config.params.step),
      },
    }
  } else if (url.endsWith('/attendance/rule')) {
    if (config.method === 'put') {
      const command = JSON.parse(config.data as string) as AttendanceRuleCommand
      if (previewRule(command.month, command.departmentId).locked) throw new Error('对应规则已锁定')
      if (previewRule(command.month, command.departmentId).revision !== command.revision)
        throw new Error('考勤规则已变更')
      const value = {
        ...previewRule(command.month, command.departmentId),
        ...command,
        revision: command.revision + 1,
      }
      rules.set(`${command.month}:${command.departmentId ?? 0}`, value)
      body = previewRule(command.month, command.departmentId)
    } else body = previewRule(config.params.month, config.params.departmentId ?? null)
  } else if (url.endsWith('/confirm') && config.method === 'post') {
    const command = JSON.parse(config.data as string) as AttendanceRecordCommand
    const [month, employeeCode] = url.split('/').slice(-3, -1)
    const key = `${month}:${employeeCode}`
    if (confirmations.has(key)) throw new Error('考勤已确认')
    const row = currentRows.find((item) => item.employeeCode === employeeCode)!
    const provisional = month! >= today.slice(0, 7)
    const actualDays = command.actualDaysOverride ?? row.punchDays
    const absentDays =
      command.absentDaysOverride ??
      (provisional || actualDays == null || row.expectedDays == null
        ? null
        : Math.max(0, row.expectedDays - actualDays))
    confirmations.set(key, {
      ...row,
      ...command,
      actualDays,
      absentDays,
      attendanceStatus: 'CONFIRMED',
      revision: command.revision + 1,
    })
    body = null
  } else if (url.endsWith('/attendance')) {
    const month = config.params.month as string
    const provisional = month >= today.slice(0, 7)
    const companyRule = previewRule(month)
    const items = ['林晓', '陈晨', '周宁']
      .map((employeeName, index) => {
        const departmentId = index ? 3 : 2
        const ownRule = previewRule(month, departmentId)
        const expectedDays = ownRule.expectedDays ?? companyRule.expectedDays
        const employeeCode = `PREVIEW-${index + 1}`
        const confirmed = confirmations.get(`${month}:${employeeCode}`)
        if (confirmed) return { ...confirmed, departmentId }
        const note = notes.get(`${month}:${employeeCode}`) ?? {
          reason: index === 1 ? '月中入职，缺卡情况待核实' : '',
          actualDaysOverride: null,
          absentDaysOverride: null,
          leaveTypeCode: 'NONE',
          revision: 0,
        }
        const dates =
          index === 2
            ? []
            : Array.from(
                { length: index ? 5 : 8 },
                (_, day) => `${month}-${String(day + 1).padStart(2, '0')}`,
              ).filter((day) => day <= today)
        return {
          employeeCode,
          employeeName,
          departmentName: index ? '销售二部' : '销售一部',
          departmentId,
          ruleSource: ownRule.expectedDays == null ? ('COMPANY' as const) : ('DEPARTMENT' as const),
          expectedDays,
          punchDays: index === 2 ? null : dates.length,
          actualDays: note.actualDaysOverride ?? (index === 2 ? null : dates.length),
          absentDays:
            note.absentDaysOverride ??
            (provisional || expectedDays == null || (index === 2 && note.actualDaysOverride == null)
              ? null
              : Math.max(0, expectedDays - (note.actualDaysOverride ?? dates.length))),
          attendanceStatus: 'PENDING' as const,
          sourceStatus: index === 2 ? ('UNLINKED' as const) : ('AVAILABLE' as const),
          dates,
          ...note,
        }
      })
      .filter(
        (row) =>
          (!config.params.attendanceStatus ||
            row.attendanceStatus === config.params.attendanceStatus) &&
          row.employeeName.includes(config.params.employeeName) &&
          row.employeeCode.includes(config.params.employeeCode) &&
          (!config.params.departmentId ||
            config.params.departmentId === 1 ||
            row.departmentId === config.params.departmentId),
      )
    currentRows = items
    body = {
      month,
      through: provisional
        ? today
        : `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`,
      provisional,
      rule: companyRule,
      sourceError: null,
      page: { total: items.length, begin: 0, step: 20, items },
    } satisfies AttendanceView
  } else throw new Error(`隔离预览阻止请求：${url}`)
  return { config, data: structuredClone(body), status: 200, statusText: 'OK', headers: {} }
}
const pinia = createPinia()
useAuthStore(pinia).user = {
  id: 'preview',
  principalScope: 'TENANT',
  username: 'preview',
  displayName: '测试人事',
  roles: [],
  permissions: [
    'hr:attendance:read',
    'hr:attendance:write',
    'hr:attendance-rule:read',
    'hr:attendance-rule:write',
  ],
  tenantId: 'preview',
  tenantName: '隔离预览',
}
// 切换预览页面时保留内存数据，便于验证确认后的规则锁定；整页刷新仍会清空。
const showRules = ref(new URLSearchParams(location.search).has('rules'))
document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    showRules.value = new URL(link.href).searchParams.has('rules')
    history.replaceState(null, '', link.href)
  })
})
createApp({ setup: () => () => h(showRules.value ? Rules : Attendance) })
  .use(pinia)
  .use(ElementPlus, { locale: zhCn })
  .mount('#app')
