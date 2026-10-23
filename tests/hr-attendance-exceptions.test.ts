import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/AttendanceExceptionEditor.vue'
import type { AttendanceExceptionPeriod } from '@/api/core/hr-attendance'

let page: VueWrapper<InstanceType<typeof Editor>>
afterEach(() => {
  page?.unmount()
  document.body.innerHTML = ''
})
async function open(periods: AttendanceExceptionPeriod[] = [], stubTimePicker = false) {
  page = mount(Editor, {
    attachTo: document.body,
    props: {
      month: '2026-10',
      modelValue: periods,
      'onUpdate:modelValue': (value) => page.setProps({ modelValue: value }),
    },
    global: { plugins: [ElementPlus], stubs: { ElTimePicker: stubTimePicker } },
  })
  await flushPromises()
}
const pickers = () => page.findAllComponents({ name: 'ElDatePicker' })
async function choose(index: number, value: string | [string, string], allDay = true) {
  pickers()[index]!.vm.$emit('update:modelValue', value)
  if (typeof value === 'string') {
    page.findAllComponents({ name: 'ElCheckbox' })[index]!.vm.$emit('update:modelValue', allDay)
  }
  await flushPromises()
}
async function setTimes(index: number, value: [string, string] | null) {
  page.findAllComponents({ name: 'ElTimePicker' })[index]!.vm.$emit('update:modelValue', value)
  await flushPromises()
}
async function click(label: string) {
  await page
    .findAll('button')
    .find((button) => button.text().includes(label))!
    .trigger('click')
  await flushPromises()
}
async function explain() {
  await page.get('input[aria-label="异常说明"]').setValue('活动报备已核对')
}
const period = (start: string, end: string): AttendanceExceptionPeriod => ({
  start,
  end,
  kind: 'ACTIVITY',
  reason: '活动报备',
})

describe('考勤异常多日期录入', () => {
  it('每个日期可录入独立时段，保留分钟并在记录中回显', async () => {
    await open()
    await choose(0, '2026-10-08', false)
    await setTimes(0, ['09:15', '12:30'])
    await click('添加日期')
    await choose(1, '2026-10-06', false)
    await setTimes(1, ['14:00', '18:45'])
    await explain()
    await click('添加异常记录')
    expect(
      (page.props('modelValue') as AttendanceExceptionPeriod[]).map((p) => [p.start, p.end]),
    ).toEqual([
      ['2026-10-06T14:00:00', '2026-10-06T18:45:00'],
      ['2026-10-08T09:15:00', '2026-10-08T12:30:00'],
    ])
    expect(page.get('.exception-records').text()).toContain('2026-10-08 09:15:00')
    expect(page.get('.exception-records').text()).toContain('2026-10-08 12:30:00')
    expect(page.getComponent({ name: 'ElTimePicker' }).props('modelValue')).toBeNull()
  })

  it('时段缺失、相同、倒置或无效时不能登记，切换全天后可保存', async () => {
    // Simulate malformed picker events without passing invalid values into Element Plus internals.
    await open([], true)
    await choose(0, '2026-10-08', false)
    await explain()
    for (const times of [null, ['09:00', ''], ['25:00', '26:00']] as const) {
      await setTimes(0, times ? [...times] : null)
      await click('添加异常记录')
      expect(page.emitted('update:modelValue')).toBeUndefined()
      expect(page.get('[role="alert"]').text()).toContain('开始时间和结束时间')
    }
    for (const times of [
      ['09:00', '09:00'],
      ['18:00', '09:00'],
    ] as [string, string][]) {
      await setTimes(0, times)
      await click('添加异常记录')
      expect(page.emitted('update:modelValue')).toBeUndefined()
      expect(page.get('[role="alert"]').text()).toContain('结束时间须晚于开始时间')
    }
    page.getComponent({ name: 'ElCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await click('添加异常记录')
    expect(page.props('modelValue')).toEqual([
      expect.objectContaining({ start: '2026-10-08T00:00:00', end: '2026-10-09T00:00:00' }),
    ])
  })

  it('时段与全天可混合登记，未填写日期的行不能静默丢失', async () => {
    await open()
    await choose(0, '2026-10-08', false)
    await setTimes(0, ['09:00', '12:00'])
    await click('添加日期')
    await explain()
    await click('添加异常记录')
    expect(page.emitted('update:modelValue')).toBeUndefined()
    expect(page.get('[role="alert"]').text()).toContain('请选择日期2')
    await choose(1, '2026-10-09')
    await click('添加异常记录')
    expect(page.props('modelValue')).toEqual([
      expect.objectContaining({ start: '2026-10-08T09:00:00', end: '2026-10-08T12:00:00' }),
      expect.objectContaining({ start: '2026-10-09T00:00:00', end: '2026-10-10T00:00:00' }),
    ])
  })

  it('同一天的不同时间段仍不能重复登记', async () => {
    await open([period('2026-10-08T09:00:00', '2026-10-08T12:00:00')])
    await choose(0, '2026-10-08', false)
    await setTimes(0, ['14:00', '18:00'])
    await explain()
    await click('添加异常记录')
    expect(page.emitted('update:modelValue')).toBeUndefined()
    expect(page.get('[role="alert"]').text()).toContain('同一天的异常请合并填写')
  })

  it('可添加和移除多个日期，按日期保存，清空草稿并允许继续录入', async () => {
    await open()
    await choose(0, '2026-10-08')
    await click('添加日期')
    await choose(1, '2026-10-06')
    await click('添加日期')
    await choose(2, '2026-10-09')
    await page.get('button[aria-label="移除日期3"]').trigger('click')
    expect(pickers()).toHaveLength(2)
    const disabledDate = pickers()[1]!.props('disabledDate')
    expect(disabledDate(new Date('2026-10-08T00:00:00'))).toBe(true)
    expect(disabledDate(new Date('2026-10-09T00:00:00'))).toBe(false)
    await explain()
    await click('添加异常记录')
    const saved = page.props('modelValue') as AttendanceExceptionPeriod[]
    expect(saved.map((p) => [p.start, p.end])).toEqual([
      ['2026-10-06T00:00:00', '2026-10-07T00:00:00'],
      ['2026-10-08T00:00:00', '2026-10-09T00:00:00'],
    ])
    expect(pickers()).toHaveLength(1)
    expect(pickers()[0]!.props('modelValue')).toBe('')
    expect(pickers()[0]!.props('disabledDate')(new Date('2026-10-08T00:00:00'))).toBe(true)
    await page.get('.exception-records button').trigger('click')
    await flushPromises()
    expect(pickers()[0]!.props('disabledDate')(new Date('2026-10-06T00:00:00'))).toBe(false)
  })

  it('同一批次不能手动输入重复日期，保留草稿便于修正', async () => {
    await open()
    await choose(0, '2026-10-08')
    await click('添加日期')
    await choose(1, '2026-10-08')
    await explain()
    await click('添加异常记录')
    expect(page.emitted('update:modelValue')).toBeUndefined()
    expect(page.get('[role="alert"]').text()).toContain('不能重复')
    expect(pickers()[1]!.props('modelValue')).toBe('2026-10-08')
    await choose(1, '2026-10-09')
    expect(page.find('[role="alert"]').exists()).toBe(false)
    await click('添加异常记录')
    expect(page.props('modelValue')).toHaveLength(2)
  })

  it('已登记的跨天时间段占用对应日期，结束时间为零点时不占用下一天', async () => {
    await open([period('2026-10-06T14:00:00', '2026-10-08T00:00:00')])
    const disabledDate = pickers()[0]!.props('disabledDate')
    expect(disabledDate(new Date('2026-10-06T00:00:00'))).toBe(true)
    expect(disabledDate(new Date('2026-10-07T00:00:00'))).toBe(true)
    expect(disabledDate(new Date('2026-10-08T00:00:00'))).toBe(false)
    await choose(0, '2026-10-07')
    await explain()
    await click('添加异常记录')
    expect(page.get('[role="alert"]').text()).toContain('不能重复')
    expect(page.props('modelValue')).toHaveLength(1)
    await choose(0, '2026-10-08')
    await click('添加异常记录')
    expect(page.props('modelValue')).toHaveLength(2)
  })

  it('起止时间也不能在同一天重复登记不同异常，跨月区间仍可登记', async () => {
    await open([period('2026-10-06T09:00:00', '2026-10-06T12:00:00')])
    page.getComponent({ name: 'ElRadioGroup' }).vm.$emit('update:modelValue', 'RANGE')
    await flushPromises()
    await choose(0, ['2026-10-06T14:00:00', '2026-10-06T18:00:00'])
    await explain()
    await click('添加异常记录')
    expect(page.get('[role="alert"]').text()).toContain('同一天的异常请合并填写')
    expect(page.emitted('update:modelValue')).toBeUndefined()
    await choose(0, ['2026-09-30T14:00:00', '2026-10-02T12:00:00'])
    await click('添加异常记录')
    expect(page.props('modelValue')).toHaveLength(2)
  })

  it('无效日期及核算月份外的日期不能加入记录', async () => {
    await open()
    expect(pickers()[0]!.props('disabledDate')(new Date('2026-11-01T00:00:00'))).toBe(true)
    await explain()
    for (const date of ['2026-11-01', '2026-10-32']) {
      await choose(0, date)
      await click('添加异常记录')
      expect(page.get('[role="alert"]').text()).toContain('核算月份内的有效日期')
      expect(page.emitted('update:modelValue')).toBeUndefined()
    }
  })

  it('历史时间未包含秒数时，相邻日期仍可正常登记', async () => {
    await open([period('2026-10-06T00:00', '2026-10-07T00:00')])
    await choose(0, '2026-10-05')
    await explain()
    await click('添加异常记录')
    expect(page.props('modelValue')).toHaveLength(2)
    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.text()).toContain('2026-10-06（全天）')
  })
})
