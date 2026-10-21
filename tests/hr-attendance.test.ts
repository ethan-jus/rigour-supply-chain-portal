import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Attendance from '@/views/supply-chain/hr/HrAttendanceView.vue'
import * as api from '@/api/core/hr-attendance'
import {
  seedBusinessDictionaryForTest,
  clearBusinessDictionariesForTest,
} from '@/utils/business-dictionary'
import { constantRoutes } from '@/router/routes'

const permissions = vi.hoisted(() => ({ write: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => permissions.write }),
}))
vi.mock('@/api/core/hr-attendance', () => ({
  attendanceMonth: () => '2026-09',
  getAttendance: vi.fn(),
  getAttendanceDepartments: vi.fn(),
  getAttendanceRule: vi.fn(),
  saveAttendanceRule: vi.fn(),
  confirmAttendanceRecord: vi.fn(),
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
  permissions.write = true
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
      'textarea[aria-label="缺卡原因"]',
    ) as HTMLTextAreaElement
    textarea.value = '9月3日忘记打卡'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenCalledWith('2026-09', 'E1', {
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
    await click('确认考勤')
    expect(api.confirmAttendanceRecord).toHaveBeenLastCalledWith('2026-09', 'E2', {
      actualDaysOverride: 20.5,
      absentDaysOverride: 0.5,
      leaveTypeCode: 'ANNUAL',
      reason: '',
      revision: 0,
    })
  })
  it('restores both values to automatic calculation and keeps raw evidence distinct', async () => {
    const data = result()
    Object.assign(data.page.items[0], {
      actualDays: 20.5,
      absentDays: 0,
      actualDaysOverride: 20.5,
      absentDaysOverride: 0,
      leaveTypeCode: 'SICK',
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
      actualDaysOverride: null,
      absentDaysOverride: null,
      leaveTypeCode: 'SICK',
      reason: '',
      revision: 3,
    })
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
  it('reads status labels and filter options from the dictionary, and hides confirmed actions', async () => {
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
    expect(document.body.textContent).toContain('确认后将锁定当前考勤结果')
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
  it('hides editing from readers and explains in-progress months', async () => {
    permissions.write = false
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
})
