import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PayrollWorkflowActions from '@/views/supply-chain/hr/components/PayrollWorkflowActions.vue'
import type { PayrollRecord } from '@/api/core/payroll'

let wrapper: VueWrapper
const record = (statusCode: string, month = '2026-09') =>
  ({
    statusCode,
    month,
    calculation: { issues: statusCode === 'REVIEW' ? ['审核未完成', '历史任职缺失'] : [] },
    payments: [],
  }) as unknown as PayrollRecord
function render(row = record('REVIEW'), permissions = true) {
  wrapper = mount(PayrollWorkflowActions, {
    props: {
      row,
      currentMonth: '2026-10',
      canCalculate: permissions,
      canConfirm: permissions,
      canPay: permissions,
      busy: false,
    },
    global: { plugins: [ElementPlus] },
  })
}
const button = (name: string) => wrapper.findAll('button').find((b) => b.text() === name)
afterEach(() => wrapper?.unmount())
describe('薪酬下一步操作', () => {
  it('待核对只能重算或调整，不能直接确认；检查通过后才显示确认入口', async () => {
    render()
    expect(wrapper.text()).toContain('当前有 2 类问题待处理')
    expect(wrapper.text()).toContain('保存后自动重算')
    expect(button('确认薪酬')).toBeUndefined()
    await button('当月核定')!.trigger('click')
    expect(wrapper.emitted('adjust')).toHaveLength(1)
    await button('重新核算')!.trigger('click')
    expect(wrapper.emitted('recalculate')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
    await wrapper.setProps({ row: record('READY') })
    expect(button('重新核算')).toBeUndefined()
    await button('确认薪酬')!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
  it('确认后只登记实际付款，全部发放后显示完成', async () => {
    render(record('CONFIRMED'))
    expect(button('当月核定')).toBeUndefined()
    expect(wrapper.text()).toContain('不发起转账')
    await button('登记发放')!.trigger('click')
    expect(wrapper.emitted('paid')).toHaveLength(1)
    await wrapper.setProps({ row: record('PAID') })
    expect(wrapper.text()).toContain('本月薪酬流程已完成')
    expect(button('登记发放')).toBeUndefined()
    await button('查看发放记录')!.trigger('click')
    expect(wrapper.emitted('payments')).toHaveLength(1)
  })
  it('部分发放仍引导登记剩余金额', () => {
    render({ ...record('CONFIRMED'), payments: [{ amount: 100 }] } as PayrollRecord)
    expect(wrapper.text()).toContain('下一步：登记剩余发放')
    expect(button('登记发放')).toBeDefined()
  })
  it('当前和未来月份未结束时不可确认，并说明原因', async () => {
    render(record('READY', '2026-10'))
    expect(button('确认薪酬')!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('月份尚未结束')
    await wrapper.setProps({ row: record('READY', '2026-11') })
    expect(button('确认薪酬')!.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ row: record('READY', '2026-09') })
    expect(button('确认薪酬')!.attributes('disabled')).toBeUndefined()
  })
  it('没有对应权限时提供交接说明，不提供可写操作', async () => {
    render(record('REVIEW'), false)
    expect(wrapper.text()).toContain('当前账号无核算权限')
    expect(button('重新核算')).toBeUndefined()
    expect(button('当月核定')).toBeUndefined()
    await wrapper.setProps({ row: record('READY') })
    expect(wrapper.text()).toContain('当前账号无确认权限')
    expect(button('确认薪酬')).toBeUndefined()
    await wrapper.setProps({ row: record('CONFIRMED') })
    expect(wrapper.text()).toContain('当前账号无发放登记权限')
    expect(button('登记发放')).toBeUndefined()
  })
  it('操作中禁用下一步，未知状态不提供流转入口', async () => {
    render(record('READY'))
    await wrapper.setProps({ busy: true })
    expect(button('确认薪酬')!.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ busy: false, row: record('UNKNOWN') })
    expect(wrapper.text()).toContain('当前状态暂不支持流转操作')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['关闭'])
  })
})
