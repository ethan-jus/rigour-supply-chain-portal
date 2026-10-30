import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import Attendance from '@/views/supply-chain/hr/HrAttendanceView.vue'
import * as api from '@/api/core/hr-attendance'
import * as ruleApi from '@/api/core/payroll-scheme/components'
import {
  seedBusinessDictionaryForTest,
  clearBusinessDictionariesForTest,
} from '@/utils/business-dictionary'
import { constantRoutes } from '@/router/routes'

const permissions = vi.hoisted(() => ({ write: true, read: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({
    can: (permission: string) =>
      permission === 'hr:attendance:read' ? permissions.read : permissions.write,
  }),
}))
vi.mock('@/api/core/hr-attendance', () => ({
  attendanceMonth: () => '2026-09',
  getAttendance: vi.fn(),
  getAttendanceDepartments: vi.fn(),
  getAttendanceRule: vi.fn(),
  saveAttendanceRule: vi.fn(),
  confirmAttendanceRecord: vi.fn(),
  previewAttendanceRecord: vi.fn(),
  reopenAttendanceRecord: vi.fn(),
}))
vi.mock('@/api/core/payroll-scheme/components', () => ({
  getPayrollRuleReviews: vi.fn().mockResolvedValue([]),
  resolvePayrollRuleReview: vi.fn(),
}))
const result = (): api.AttendanceView => ({
  month: '2026-09',
  through: '2026-09-30',
  provisional: false,
  sourceError: null,
  rule: {
    month: '2026-09',
    departmentId: null,
    expectedDays: 26,
    revision: 1,
    companyExpectedDays: 26,
    locked: false,
  },
  page: {
    total: 2,
    begin: 0,
    step: 20,
    items: [
      {
        employeeCode: 'E1',
        employeeName: '测试员工甲',
        departmentName: '销售一部',
        expectedDays: 26,
        ruleSource: 'COMPANY',
        punchDays: 2,
        actualDaysOverride: null,
        absentDaysOverride: null,
        leaveTypeCode: 'NONE',
        actualDays: 2,
        absentDays: 24,
        attendanceStatus: 'PENDING',
        sourceStatus: 'AVAILABLE',
        dates: ['2026-09-01', '2026-09-02'],
        reason: '',
        revision: 0,
      },
      {
        employeeCode: 'E2',
        employeeName: '测试员工乙',
        departmentName: '销售二部',
        expectedDays: 26,
        ruleSource: 'COMPANY',
        punchDays: null,
        actualDaysOverride: null,
        absentDaysOverride: null,
        leaveTypeCode: 'NONE',
        actualDays: null,
        absentDays: null,
        attendanceStatus: 'PENDING',
        sourceStatus: 'UNLINKED',
        dates: [],
        reason: '',
        revision: 0,
      },
    ],
  },
})
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ruleApi.getPayrollRuleReviews).mockResolvedValue([])
  permissions.write = true
  permissions.read = true
  clearBusinessDictionariesForTest()
  seedBusinessDictionaryForTest('HR', 'ATTENDANCE_STATUS', [
    { code: 'PENDING', name: '待确认' },
    { code: 'CONFIRMED', name: '已确认' },
  ])
  seedBusinessDictionaryForTest('HR', 'ATTENDANCE_LEAVE_TYPE', [
    { code: 'NONE', name: '无' },
    { code: 'COMP_TIME', name: '调休' },
    { code: 'PERSONAL', name: '事假' },
    { code: 'SICK', name: '病假' },
    { code: 'ANNUAL', name: '年假（字典扩展）' },
  ])
  vi.mocked(api.getAttendanceDepartments).mockResolvedValue([
    { id: 1, parentId: null, departmentName: '销售部', sortOrder: 0 },
    { id: 2, parentId: 1, departmentName: '销售一部', sortOrder: 0 },
    { id: 3, parentId: 1, departmentName: '销售二部', sortOrder: 1 },
  ])
  vi.mocked(api.getAttendance).mockResolvedValue(result())
  vi.mocked(api.getAttendanceRule).mockResolvedValue({
    month: '2026-09',
    departmentId: null,
    companyExpectedDays: 26,
    locked: false,
    expectedDays: 26,
    revision: 1,
  })
})
afterEach(() => {
  ElMessageBox.close()
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})
async function open(component = Attendance) {
  wrapper = mount(component, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}
async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  )!
  button.click()
  await flushPromises()
}
describe('一期考勤', () => {
  it('展示实际缺卡和缺拜访次数及每日明细，来源缺失不当零', async () => {
    const data = result()
    data.page.items[0]!.assessment = {
      status: 'AVAILABLE',
      through: '2026-09-30',
      missingCheckins: 4,
      missingVisits: 2,
      message: '已按请假时间免考核',
      days: [
        {
          date: '2026-09-08',
          checkins: 3,
          effectiveVisits: 1,
          missingCheckins: 4,
          missingVisits: 2,
          deduction: 140,
          evidenceComplete: true,
        },
      ],
    }
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    await open()
    const rows = wrapper!.findAll('tr')
    expect(rows.find((row) => row.text().includes('测试员工甲'))!.text()).toContain('42')
    expect(rows.find((row) => row.text().includes('测试员工乙'))!.text()).toContain('待核对')
    await wrapper!.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    expect(wrapper!.get('.attendance-metrics').text().replace(/\s/g, '')).toContain('系统缺卡4次')
    expect(wrapper!.get('.attendance-metrics').text().replace(/\s/g, '')).toContain('系统缺拜访2次')
    expect(document.body.textContent).toContain('查看每日缺卡、缺拜访明细')
  })

  it('allows HR to reopen a reviewed confirmation and retains registered exception periods', async () => {
    const confirmed = result()
    const row = confirmed.page.items[0]!
    row.attendanceStatus = 'CONFIRMED'
    row.revision = 3
    row.exceptions = [
      {
        start: '2026-09-03T09:00:00',
        end: '2026-09-03T18:00:00',
        kind: 'ACTIVITY',
        reason: '客户活动报备',
      },
    ]
    const reopened = result()
    reopened.page.items[0]!.exceptions = row.exceptions
    vi.mocked(api.getAttendance).mockResolvedValueOnce(confirmed).mockResolvedValue(reopened)
    vi.mocked(ruleApi.getPayrollRuleReviews).mockResolvedValue([
      {
        id: 'R1',
        subject: 'ATTENDANCE',
        subjectId: '2026-09:E1',
        employeeCode: 'E1',
        employeeName: '测试员工甲',
        month: '2026-09',
        ruleName: '销售考勤规则',
        action: 'DISABLE',
        reason: '工作日历需要复核',
        time: '2026-09-20T10:00:00Z',
      },
    ])
    const page = await open()
    expect(page.text()).toContain('规则变更待复核')
    await click('撤销确认')
    const prompt = new DOMWrapper(document.body.querySelector('.el-message-box')!)
    await prompt.get('textarea').setValue('按调整后的考勤日历重新核定')
    await prompt.get('button.el-button--primary').trigger('click')
    await flushPromises()
    expect(api.reopenAttendanceRecord).toHaveBeenCalledWith(
      '2026-09',
      expect.objectContaining({ employeeCode: 'E1', revision: 3 }),
      '按调整后的考勤日历重新核定',
    )
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('客户活动报备')
  })
  it('keeps the requested page while the next page is loading', async () => {
    const first = result()
    first.page.total = 45
    vi.mocked(api.getAttendance).mockResolvedValueOnce(first)
    const page = await open()
    let finish!: (value: api.AttendanceView) => void
    vi.mocked(api.getAttendance).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(api.getAttendance).toHaveBeenCalledTimes(2)
    expect(api.getAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ begin: 20 }))
    expect(page.get('.el-pagination .is-active').text()).toBe('2')
    finish({ ...first, page: { ...first.page, begin: 20 } })
    await flushPromises()
    expect(page.get('.el-pagination .is-active').text()).toBe('2')
  })
  it('submits separate fields and a selectable parent department, then resets them', async () => {
    const page = await open()
    await page.get('input[aria-label="员工姓名"]').setValue(' 员工甲 ')
    await page.get('input[aria-label="员工编号"]').setValue(' E1 ')
    await page.getComponent({ name: 'ElTreeSelect' }).find('input').trigger('click')
    await flushPromises()
    const parent = [...document.querySelectorAll('.el-tree .el-select-dropdown__item')].find(
      (node) => node.textContent === '销售部',
    )!
    ;(parent as HTMLElement).click()
    await flushPromises()
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(api.getAttendance).toHaveBeenLastCalledWith({
      month: '2026-09',
      employeeName: '员工甲',
      employeeCode: 'E1',
      departmentId: 1,
      attendanceStatus: '',
      begin: 0,
      step: 20,
    })
    await click('重置')
    expect(api.getAttendance).toHaveBeenLastCalledWith({
      month: '2026-09',
      employeeName: '',
      employeeCode: '',
      departmentId: undefined,
      attendanceStatus: '',
      begin: 0,
      step: 20,
    })
    expect((page.get('input[aria-label="员工姓名"]').element as HTMLInputElement).value).toBe('')
    expect((page.get('input[aria-label="员工编号"]').element as HTMLInputElement).value).toBe('')
  })
  it('paginates only applied filters and queries once when returning to page one', async () => {
    const data = result()
    data.page.total = 45
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    await page.get('input[aria-label="员工姓名"]').setValue('尚未查询')
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(api.getAttendance).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeName: '', begin: 20 }),
    )
    vi.mocked(api.getAttendance).mockClear()
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(api.getAttendance).toHaveBeenCalledTimes(1)
    expect(api.getAttendance).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeName: '尚未查询', begin: 0 }),
    )
    expect(page.get('.el-pagination .is-active').text()).toBe('1')
  })
  it('allows retrying a failed department lookup without losing the attendance list', async () => {
    vi.mocked(api.getAttendanceDepartments).mockRejectedValueOnce(new Error('部门暂不可用'))
    const page = await open()
    expect(page.text()).toContain('部门暂不可用')
    expect(page.text()).toContain('测试员工甲')
    await click('重试')
    expect(api.getAttendanceDepartments).toHaveBeenCalledTimes(2)
    expect(page.text()).not.toContain('部门暂不可用')
  })
  it('shows real days and keeps an unlinked employee unknown', async () => {
    const page = await open()
    expect(page.text()).toContain('待关联打卡账号')
    await page.get('button[aria-label="查看测试员工甲打卡日期"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('2026-09-01')
    expect(document.body.textContent).toContain('2026-09-02')
  })
  it('saves the record and its employee/month revision, preserving text on conflict', async () => {
    vi.mocked(api.confirmAttendanceRecord).mockRejectedValueOnce(new Error('资料已变更'))
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const textarea = document.querySelector(
      'textarea[aria-label="考勤核定说明"]',
    ) as HTMLTextAreaElement
    textarea.value = '9月3日忘记打卡'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenCalledWith('2026-09', 'E1', {
      exceptions: [],
      actualDaysOverride: null,
      absentDaysOverride: null,
      leaveTypeCode: 'NONE',
      reason: '9月3日忘记打卡',
      revision: 0,
    })
    expect(document.body.textContent).toContain('资料已变更')
    expect(textarea.value).toBe('9月3日忘记打卡')
    vi.mocked(api.confirmAttendanceRecord).mockResolvedValueOnce(undefined)
    await click('确认考勤')
    expect(api.getAttendance).toHaveBeenCalledTimes(2)
  })
  it('saves independent half-days and a single dictionary option for unlinked employees', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工乙考勤"]').trigger('click')
    await flushPromises()
    for (const [label, value] of [
      ['实际出勤天数', '20.5'],
      ['缺勤天数', '0.5'],
    ]) {
      const input = page.get(`input[aria-label="${label}"]`)
      await input.setValue(value)
      await input.trigger('change')
    }
    const select = page
      .findAllComponents({ name: 'ElSelect' })
      .find((component) => component.props('ariaLabel') === '请假类型')!
    select.vm.$emit('update:modelValue', 'ANNUAL')
    await flushPromises()
    await page.get('textarea[aria-label="考勤核定说明"]').setValue('年假半天，已核对')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith('2026-09', 'E2', {
      exceptions: [],
      actualDaysOverride: 20.5,
      absentDaysOverride: 0.5,
      leaveTypeCode: 'ANNUAL',
      reason: '年假半天，已核对',
      revision: 0,
    })
  })
  it('submits the exact start and end times entered for each exception date', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    await page
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === '请假与异常时段')!
      .trigger('click')
    await click('登记缺卡或活动报备')
    const editor = page.getComponent({ name: 'AttendanceExceptionEditor' })
    editor.getComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', '2026-09-08')
    editor.getComponent({ name: 'ElTimePicker' }).vm.$emit('update:modelValue', ['09:15', '12:30'])
    await editor.get('input[aria-label="异常说明"]').setValue('上午活动报备已核对')
    await click('添加异常记录')
    for (const [label, value] of [
      ['实际出勤天数', '25.5'],
      ['缺勤天数', '0.5'],
    ]) {
      const input = page.get(`input[aria-label="${label}"]`)
      await input.setValue(value)
      await input.trigger('change')
    }
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith('2026-09', 'E1', {
      exceptions: [
        {
          start: '2026-09-08T09:15:00',
          end: '2026-09-08T12:30:00',
          kind: 'COMPENSATORY_LEAVE',
          reason: '上午活动报备已核对',
        },
      ],
      actualDaysOverride: 25.5,
      absentDaysOverride: 0.5,
      leaveTypeCode: 'NONE',
      reason: '',
      revision: 0,
    })
  })
  it('请假为无且没有异常记录时默认不展开异常表单，正常确认提交空异常列表', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const editor = page.getComponent({ name: 'AttendanceExceptionEditor' })
    expect(editor.isVisible()).toBe(false)
    await page
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === '请假与异常时段')!
      .trigger('click')
    await click('登记缺卡或活动报备')
    expect(editor.isVisible()).toBe(true)
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
      '2026-09',
      'E1',
      expect.objectContaining({ leaveTypeCode: 'NONE', exceptions: [] }),
    )
  })
  it('restores both values to automatic calculation and keeps raw evidence distinct', async () => {
    const data = result()
    Object.assign(data.page.items[0], {
      actualDays: 20.5,
      absentDays: 0,
      actualDaysOverride: 20.5,
      absentDaysOverride: 0,
      leaveTypeCode: 'SICK',
      reason: '病假已核对',
      revision: 3,
    })
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    expect(page.text()).toContain('人工调整')
    expect(page.text()).toContain('病假')
    await page.get('button[aria-label="查看测试员工甲打卡日期"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('共 2 天')
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    await click('恢复打卡统计')
    await click('恢复计算')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith('2026-09', 'E1', {
      exceptions: [],
      actualDaysOverride: null,
      absentDaysOverride: null,
      leaveTypeCode: 'SICK',
      reason: '病假已核对',
      revision: 3,
    })
  })
  it.each(['COMP_TIME', 'PERSONAL', 'SICK', 'ANNUAL'])(
    'requires a nonblank reason for leave type %s, including dictionary extensions',
    async (type) => {
      const page = await open()
      await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
      await flushPromises()
      const select = page
        .findAllComponents({ name: 'ElSelect' })
        .find((component) => component.props('ariaLabel') === '请假类型')!
      select.vm.$emit('update:modelValue', type)
      await flushPromises()
      const textarea = page.get('textarea[aria-label="考勤核定说明"]')
      expect(textarea.attributes('aria-required')).toBe('true')
      expect(textarea.element.closest('.el-form-item')?.classList.contains('is-required')).toBe(
        true,
      )
      await textarea.setValue('   ')
      await click('确认考勤')
      expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('请填写考勤核定说明，或登记具体请假时段及说明')
      await textarea.setValue('  请假已核对  ')
      await click('确认考勤')
      expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
        '2026-09',
        'E1',
        expect.objectContaining({ leaveTypeCode: type, reason: '请假已核对' }),
      )
    },
  )
  it('makes the reason optional again when switching the leave type back to none', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const select = page
      .findAllComponents({ name: 'ElSelect' })
      .find((component) => component.props('ariaLabel') === '请假类型')!
    select.vm.$emit('update:modelValue', 'SICK')
    await flushPromises()
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
    select.vm.$emit('update:modelValue', 'NONE')
    await flushPromises()
    const textarea = page.get('textarea[aria-label="考勤核定说明"]')
    expect(textarea.attributes('aria-required')).toBe('false')
    expect(textarea.element.closest('.el-form-item')?.classList.contains('is-required')).toBe(false)
    await textarea.setValue('  ')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
      '2026-09',
      'E1',
      expect.objectContaining({ leaveTypeCode: 'NONE', reason: '' }),
    )
  })
  it('rejects non-half-day input and preserves an explicit manual zero', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const input = page.get('input[aria-label="实际出勤天数"]')
    await input.setValue('0.1')
    await input.trigger('change')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('0.5 天的倍数')
    await input.setValue('0')
    await input.trigger('change')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
      '2026-09',
      'E1',
      expect.objectContaining({ actualDaysOverride: 0 }),
    )
  })
  it('blocks saving when the leave dictionary has no active options', async () => {
    seedBusinessDictionaryForTest('HR', 'ATTENDANCE_LEAVE_TYPE', [])
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('请假类型字典暂不可用或没有启用项')
    const saveButton = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '确认考勤',
    )!
    expect(saveButton.disabled).toBe(true)
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
  })
  it('reads dictionary labels, hides duplicate confirmation and allows reopening confirmed records', async () => {
    seedBusinessDictionaryForTest('HR', 'ATTENDANCE_STATUS', [
      { code: 'PENDING', name: '待核对（字典）' },
      { code: 'CONFIRMED', name: '确认完成（字典）' },
    ])
    const data = result()
    data.page.items[0]!.attendanceStatus = 'CONFIRMED'
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    expect(page.text()).toContain('确认完成（字典）')
    expect(page.text()).toContain('待核对（字典）')
    expect(page.find('button[aria-label="确认测试员工甲考勤"]').exists()).toBe(false)
    expect(page.find('button[aria-label="确认测试员工乙考勤"]').exists()).toBe(true)
    const select = page
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '考勤状态')!
    select.vm.$emit('update:modelValue', 'PENDING')
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(api.getAttendance).toHaveBeenLastCalledWith(
      expect.objectContaining({ attendanceStatus: 'PENDING', begin: 0 }),
    )
    await click('重置')
    expect(api.getAttendance).toHaveBeenLastCalledWith(
      expect.objectContaining({ attendanceStatus: '' }),
    )
  })
  it('hides confirmation after success and retains status filter while reloading', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('可填写原因撤销确认')
    const confirmed = result()
    confirmed.page.items[0]!.attendanceStatus = 'CONFIRMED'
    vi.mocked(api.getAttendance).mockResolvedValueOnce(confirmed)
    await click('确认考勤')
    expect(page.text()).toContain('已确认')
    expect(page.find('button[aria-label="确认测试员工甲考勤"]').exists()).toBe(false)
  })
  it('returns to a valid page when the last pending row on that page is confirmed', async () => {
    const data = result()
    data.page.total = 21
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    const select = page
      .findAllComponents({ name: 'ElSelect' })
      .find((item) => item.props('ariaLabel') === '考勤状态')!
    select.vm.$emit('update:modelValue', 'PENDING')
    await page.get('form').trigger('submit')
    await flushPromises()
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    vi.mocked(api.getAttendance)
      .mockResolvedValueOnce({ ...data, page: { total: 20, begin: 20, step: 20, items: [] } })
      .mockResolvedValueOnce({ ...data, page: { ...data.page, total: 20, begin: 0 } })
    await click('确认考勤')
    expect(api.getAttendance).toHaveBeenLastCalledWith(
      expect.objectContaining({ attendanceStatus: 'PENDING', begin: 0 }),
    )
    expect(page.get('.el-pagination .is-active').text()).toBe('1')
    expect(page.text()).toContain('测试员工甲')
  })
  it('hides editing without attendance-menu permission and explains in-progress months', async () => {
    permissions.write = false
    permissions.read = false
    const data = result()
    data.provisional = true
    data.through = '2026-09-13'
    data.page.items.forEach((row) => (row.absentDays = null))
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    expect(page.text()).toContain('统计中')
    expect(page.text()).not.toContain('考勤确认')
  })
  it('shows department sources without incorrectly warning that the company rule is missing', async () => {
    const data = result()
    data.rule.expectedDays = null
    data.rule.companyExpectedDays = null
    data.page.items.forEach((row) => {
      row.ruleSource = 'DEPARTMENT'
    })
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    expect(page.text()).toContain('本部门规则')
    expect(page.text()).not.toContain('请完善本月部门规则')
  })
  it('routes both real pages with separate permissions and keeps old bookmarks redirecting', () => {
    const routes = constantRoutes.find((r) => r.path === '/supply-chain')!.children!
    expect(routes.find((r) => r.path === 'hr/attendance')?.meta?.permission).toBe(
      'hr:attendance:read',
    )
    expect(routes.find((r) => r.path === 'hr/attendance-rules')?.meta?.permission).toBe(
      'hr:attendance-rule:read',
    )
    expect(routes.find((r) => r.path === 'hr/attendance-appeals')?.redirect).toBe(
      '/supply-chain/hr/attendance',
    )
  })
  it('菜单权限人员可以手工核定缺失次数，必填依据并保留0，不改原始来源', async () => {
    permissions.write = false
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    for (const [label, value] of [
      ['核定缺卡次数', '0'],
      ['核定缺拜访次数', '2'],
    ]) {
      const input = page.get(`input[aria-label="${label}"]`)
      await input.setValue(value)
      await input.trigger('change')
    }
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('手工核定次数时，请填写核定说明')
    await page.get('textarea[aria-label="次数核定说明"]').setValue('已核对补卡，缺两次拜访')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
      '2026-09',
      'E1',
      expect.objectContaining({
        assessmentOverride: {
          missingCheckins: 0,
          missingVisits: 2,
          reason: '已核对补卡，缺两次拜访',
        },
      }),
    )
    expect(result().page.items[0]!.punchDays).toBe(2)
  })
  it('恢复系统统计后不提交人工次数', async () => {
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const input = page.get('input[aria-label="核定缺卡次数"]')
    await input.setValue('0')
    await input.trigger('change')
    await click('恢复缺卡统计')
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith(
      '2026-09',
      'E1',
      expect.not.objectContaining({ assessmentOverride: expect.anything() }),
    )
  })
  it('普通已确认记录无需规则复核任务也可撤销，必须填写原因并按版本提交', async () => {
    permissions.write = false
    const confirmed = result()
    const row = confirmed.page.items[0]!
    row.attendanceStatus = 'CONFIRMED'
    row.revision = 3
    vi.mocked(api.getAttendance).mockResolvedValueOnce(confirmed).mockResolvedValue(result())
    const page = await open()
    expect(page.get('button[aria-label="撤销测试员工甲考勤确认"]').text()).toBe('撤销确认')
    expect(page.find('button[aria-label="撤销测试员工乙考勤确认"]').exists()).toBe(false)
    await page.get('button[aria-label="撤销测试员工甲考勤确认"]').trigger('click')
    await flushPromises()
    const prompt = new DOMWrapper(document.body.querySelector('.el-message-box')!)
    expect(prompt.text()).toContain('相关工资需重新核算确认后再发放')
    await prompt.get('button.el-button--primary').trigger('click')
    await flushPromises()
    expect(api.reopenAttendanceRecord).not.toHaveBeenCalled()
    await prompt.get('textarea').setValue('重新核对缺卡次数')
    await prompt.get('button.el-button--primary').trigger('click')
    await flushPromises()
    expect(api.reopenAttendanceRecord).toHaveBeenCalledWith(
      '2026-09',
      expect.objectContaining({ employeeCode: 'E1', revision: 3 }),
      '重新核对缺卡次数',
    )
    expect(page.get('button[aria-label="确认测试员工甲考勤"]').text()).toBe('考勤确认')
  })

  it('已确认详情展示保存的人工核定、原始统计和异常说明，且完全只读', async () => {
    const data = result()
    const row = data.page.items[0]!
    row.attendanceStatus = 'CONFIRMED'
    row.actualDays = 24
    row.actualDaysOverride = 24
    row.absentDays = 2
    row.absentDaysOverride = 2
    row.entryDate = '2026-09-02'
    row.leaveDate = '2026-09-29'
    row.reason = '本月出勤已核对'
    row.assessmentOverride = { missingCheckins: 0, missingVisits: 2, reason: '已核对补卡与拜访' }
    row.assessment = {
      status: 'AVAILABLE',
      through: '2026-09-30',
      missingCheckins: 4,
      missingVisits: 3,
      days: [],
      message: '原始逐日统计',
    }
    row.exceptions = [
      {
        start: '2026-09-03T09:00:00',
        end: '2026-09-03T18:00:00',
        kind: 'PAID_LEAVE',
        reason: '已审批年假',
      },
    ]
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    await page.get('button[aria-label="查看测试员工甲考勤详情"]').trigger('click')
    await flushPromises()
    const details = new DOMWrapper(document.body.querySelector('[aria-label="考勤详情内容"]')!)
    expect(details.get('[role="tab"][aria-selected="true"]').text()).toBe('核定结果')
    expect(details.get('[role="tabpanel"][aria-labelledby$="-result"]').isVisible()).toBe(true)
    for (const text of [
      '本次确认时保存的结果',
      '2026-09-02 至 2026-09-29',
      '入职前不考核：2026-09-01',
      '离职后不考核：2026-09-30',
      '测试员工甲',
      '2026-09',
      '24 天',
      '2 天',
      '人工核定',
      '本月出勤已核对',
      '已核对补卡与拜访',
      '缺卡：4',
      '缺拜访：3',
      '带薪请假',
      '已审批年假',
      '2026-09-03 09:00:00',
      '2026-09-01',
    ])
      expect(details.text()).toContain(text)
    for (const [label, expected] of [
      ['打卡与拜访依据', '系统缺卡：4'],
      ['异常时段与说明', '已审批年假'],
      ['原始打卡日期', '2026-09-01'],
    ]) {
      await details
        .findAll('[role="tab"]')
        .find((tab) => tab.text() === label)!
        .trigger('click')
      await flushPromises()
      const active = details.findAll('[role="tabpanel"]').find((pane) => pane.isVisible())!
      expect(active.text()).toContain(expected)
    }
    expect(details.find('input,textarea,select').exists()).toBe(false)
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
    expect(api.previewAttendanceRecord).not.toHaveBeenCalled()
    expect(api.reopenAttendanceRecord).not.toHaveBeenCalled()
    row.reason = '后续加载的新值'
    await flushPromises()
    expect(details.text()).toContain('本月出勤已核对')
    expect(details.text()).not.toContain('后续加载的新值')
  })

  it('确认时明确展示入职前不考核，历史详情不使用当前档案补写确认依据', async () => {
    const data = result()
    data.page.items[0]!.entryDate = '2026-09-02'
    data.page.items[1]!.attendanceStatus = 'CONFIRMED'
    vi.mocked(api.getAttendance).mockResolvedValue(data)
    const page = await open()
    await page.get('button[aria-label="确认测试员工甲考勤"]').trigger('click')
    await flushPromises()
    const scope = new DOMWrapper(document.body.querySelector('[aria-label="入离职考核范围"]')!)
    expect(scope.text()).toContain('入职日期：2026-09-02')
    expect(scope.text()).toContain('2026-09-02 至 2026-09-30')
    expect(scope.text()).toContain('入职前不考核：2026-09-01')
    await click('取消')
    await page.get('button[aria-label="查看测试员工乙考勤详情"]').trigger('click')
    await flushPromises()
    const detail = new DOMWrapper(document.body.querySelector('[aria-label="考勤详情内容"]')!)
    expect(detail.text()).toContain('历史确认记录未保存入职日期')
    expect(detail.text()).toContain('本月在职范围：待核对')
    expect(api.confirmAttendanceRecord).not.toHaveBeenCalled()
  })

  it('待确认记录也有详情，来源缺失保持待核对，不显示零出勤', async () => {
    const page = await open()
    await page.get('button[aria-label="查看测试员工乙考勤详情"]').trigger('click')
    await flushPromises()
    const details = new DOMWrapper(document.body.querySelector('[aria-label="考勤详情内容"]')!)
    expect(details.text()).toContain('尚未确认')
    expect(details.text()).toContain('待关联打卡账号')
    expect(details.text()).toContain('不能视为零出勤')
    expect(details.text()).not.toContain('原始打卡天数0 天')
  })
})
