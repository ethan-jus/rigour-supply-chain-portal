import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import Calendar from '@/views/supply-chain/hr/components/HrDateCalendar.vue'
import CalendarEditor from '@/views/supply-chain/hr/components/PayrollSchemeCalendarEditor.vue'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import { calendarFixture } from './fixtures/statutory-calendar'
import { getStatutoryCalendar } from '@/api/core/business-calendar'
import { ApiError } from '@/api/core/error'
vi.mock('@/api/core/business-calendar', () => ({ getStatutoryCalendar: vi.fn() }))
beforeEach(() => {
  vi.mocked(getStatutoryCalendar)
    .mockClear()
    .mockImplementation(async (year) => calendarFixture(year))
})

const stubs = {
  ElForm: { template: '<div><slot/></div>' },
  ElFormItem: { template: '<div><slot/></div>' },
  ElAlert: true,
  ElCheckboxGroup: true,
  ElDatePicker: true,
  ElTimePicker: true,
  ElSelect: true,
  ElOption: true,
  ElSwitch: true,
  ElDivider: true,
  ElButton: { template: '<button><slot/></button>' },
  ElIcon: { template: '<span><slot/></span>' },
  ElLink: { template: '<a><slot/></a>' },
}
describe('考勤日历与新绩效政策', () => {
  it('多选日期保留其他月份，取消选择可恢复，禁用时不修改', async () => {
    const page = mount(Calendar, {
      props: { modelValue: ['2026-09-01'], month: '2026-10' },
      global: { stubs },
    })
    await page.get('button[aria-label="2026-10-10 未选择"]').trigger('click')
    expect(page.emitted('update:modelValue')?.[0]?.[0]).toEqual(['2026-09-01', '2026-10-10'])
    await page.setProps({ modelValue: ['2026-09-01', '2026-10-10'] })
    await page.get('button[aria-label="2026-10-10 已选择"]').trigger('click')
    expect(page.emitted('update:modelValue')?.[1]?.[0]).toEqual(['2026-09-01'])
    await page.setProps({ disabled: true })
    await page.get('button[aria-label="2026-10-11 未选择"]').trigger('click')
    expect(page.emitted('update:modelValue')).toHaveLength(2)
    page.unmount()
  })
  it('部门日历将休息日改工作日时写入原计算契约，并保留跨月例外', async () => {
    const form = newPayrollScheme()
    form.effectiveFrom = '2026-10-01'
    form.calendar.weekdays = [1, 2, 3, 4, 5]
    form.calendar.source = 'MANUAL'
    form.calendar.restDays = ['2026-11-02']
    const page = mount(CalendarEditor, { props: { modelValue: form }, global: { stubs } })
    await page.get('button[aria-label="2026-10-10 休息日"]').trigger('click')
    await nextTick()
    expect(form.calendar.workDays).toContain('2026-10-10')
    expect(form.calendar.restDays).toContain('2026-11-02')
    await page.get('button[aria-label="2026-10-12 工作日"]').trigger('click')
    expect(form.calendar.restDays).toContain('2026-10-12')
    page.unmount()
  })
  it('新规则保留绩效参数，日历改为按年度动态跟随法定安排而非写死日期', () => {
    const d = newPayrollScheme()
    expect([d.sales.dailyCheckins, d.sales.dailyVisits, d.sales.processProtectionDays]).toEqual([
      7, 3, 10,
    ])
    expect(d.manager.calculationMode).toBe('ACTUAL_COMPLETION')
    expect(d.manager.steps).toEqual([])
    expect(d.manager.cap).toBeNull()
    expect(d.calendar.weekdays).toEqual([1, 2, 3, 4, 5])
    expect(d.calendar.source).toBe('STATUTORY')
    expect(d.calendar.restDays).toEqual([])
    expect(d.calendar.workDays).toEqual([])
  })
  it('月历跨年切换不改日期选择，邻月日期不允许误操作', async () => {
    const page = mount(Calendar, {
      props: { modelValue: ['2026-12-31'], month: '2026-12', appearance: 'month' },
      global: { stubs },
    })
    expect(
      page.get('button[aria-label="2027-01-01 非本月日期"]').attributes('disabled'),
    ).toBeDefined()
    await page.get('button[aria-label="2027-01-01 非本月日期"]').trigger('click')
    await page.get('button[aria-label="下一月"]').trigger('click')
    expect(page.emitted('update:month')?.[0]).toEqual(['2027-01'])
    await page.setProps({ month: '2027-01' })
    await page.get('button[aria-label="上一月"]').trigger('click')
    expect(page.emitted('update:month')?.[1]).toEqual(['2026-12'])
    expect(page.emitted('update:modelValue')).toBeUndefined()
    page.unmount()
  })
  it('恢复本月法定安排时覆盖本月人工安排，保留其他月份和历史周排班', async () => {
    const form = newPayrollScheme()
    form.effectiveFrom = '2026-10-01'
    form.calendar.weekdays = [1, 2, 3, 4, 5]
    form.calendar.source = 'MANUAL'
    form.calendar.restDays = ['2026-10-01', '2026-11-02']
    form.calendar.workDays = ['2026-11-07']
    const page = mount(CalendarEditor, { props: { modelValue: form }, global: { stubs } })
    await flushPromises()
    expect(page.find('el-checkbox-group-stub').exists()).toBe(false)
    await page
      .findAll('button')
      .find((button) => button.text() === '恢复本月法定安排')!
      .trigger('click')
    expect(form.calendar.restDays).toContain('2026-11-02')
    expect(form.calendar.restDays).toContain('2026-10-01')
    expect(form.calendar.workDays).toContain('2026-10-10')
    expect(form.calendar.workDays).toContain('2026-11-07')
    expect(page.findAll('.calendar-day.selected')).toHaveLength(13)
    expect(form.calendar.weekdays).toEqual([1, 2, 3, 4, 5])
    page.unmount()
  })
  it('切换年度重新读取发布数据，补班与放假正确显示；尚未发布的年度不伪造工作日', async () => {
    const form = newPayrollScheme()
    form.effectiveFrom = '2025-10-01'
    const page = mount(CalendarEditor, { props: { modelValue: form }, global: { stubs } })
    await flushPromises()
    expect(page.get('button[data-date="2025-10-08"]').text()).toContain('（休）')
    expect(page.get('button[data-date="2025-10-11"]').text()).toContain('补班')
    page.getComponent(Calendar).vm.$emit('update:month', '2026-10')
    await flushPromises()
    expect(getStatutoryCalendar).toHaveBeenCalledWith(2026)
    expect(page.get('button[data-date="2026-10-08"]').text()).toContain('工作日')
    expect(page.get('button[data-date="2026-10-10"]').text()).toContain('补班')
    expect(page.findAll('.calendar-day.selected')).toHaveLength(13)
    await page.get('button[aria-label="2026-10-10 工作日"]').trigger('click')
    expect(form.calendar.restDays).toEqual(['2026-10-10'])
    page.getComponent(Calendar).vm.$emit('update:month', '2027-01')
    await flushPromises()
    expect(getStatutoryCalendar).toHaveBeenCalledWith(2027)
    expect(page.get('button[data-date="2027-01-04"]').text()).not.toContain('待同步')
    expect(page.get('button[data-date="2027-01-04"]').attributes('disabled')).toBeDefined()
    expect(page.findAll('.day-status')).toHaveLength(0)
    expect(page.find('.calendar-summary').exists()).toBe(false)
    expect(page.text()).toContain('2027年放假安排暂未公布')
    expect(page.text()).not.toContain('同步')
    expect(form.calendar.restDays).toEqual(['2026-10-10'])
    page.unmount()
  })
  it('正常月份只显示业务安排与天数，同年切月不反复加载年度日历', async () => {
    const form = newPayrollScheme()
    form.effectiveFrom = '2026-10-01'
    const page = mount(CalendarEditor, { props: { modelValue: form }, global: { stubs } })
    await flushPromises()
    expect(page.find('.calendar-notice').exists()).toBe(false)
    expect(page.text()).not.toContain('同步')
    expect(page.find('.calendar-summary').text()).toContain('工作日 18 天')
    expect(page.findAll('.day-status')).toHaveLength(31)
    page.getComponent(Calendar).vm.$emit('update:month', '2026-11')
    await flushPromises()
    expect(getStatutoryCalendar).toHaveBeenCalledTimes(1)
    expect(page.get('button[data-date="2026-11-02"]').text()).toContain('工作日')
    page.unmount()
  })
  it('接口失败统一提示并允许重试，日期不显示技术状态也不误算出勤', async () => {
    vi.mocked(getStatutoryCalendar).mockRejectedValueOnce(
      new ApiError({ code: 'NOT_FOUND', message: '资源不存在' }, 404),
    )
    const form = newPayrollScheme()
    form.effectiveFrom = '2026-10-01'
    const page = mount(CalendarEditor, { props: { modelValue: form }, global: { stubs } })
    await flushPromises()
    expect(page.findAll('.calendar-notice')).toHaveLength(1)
    expect(page.find('.calendar-notice').text()).toContain('暂时无法显示工作日历')
    expect(page.text()).not.toContain('资源不存在')
    expect(page.text()).not.toContain('同步')
    expect(page.findAll('.day-status')).toHaveLength(0)
    expect(page.find('.calendar-summary').exists()).toBe(false)
    expect(page.get('button[data-date="2026-10-01"]').attributes('disabled')).toBeDefined()
    await page.find('.calendar-notice button').trigger('click')
    await flushPromises()
    expect(page.find('.calendar-notice').exists()).toBe(false)
    expect(page.findAll('.calendar-day.selected')).toHaveLength(13)
    page.unmount()
  })
})
