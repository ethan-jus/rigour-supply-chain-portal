import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import Batch from '@/views/supply-chain/cost/CostExpenseBatch.vue'
import { ApiError } from '@/api/core/error'

const saveCost = vi.hoisted(() => vi.fn())
// confirm 实际返回动作；当前 Element Plus 声明把动作与输入结果写成了交集。
const confirmed = 'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>
const routeGuards = vi.hoisted(() => ({
  leave: [] as Array<() => Promise<boolean>>,
  update: [] as Array<() => Promise<boolean>>,
}))
vi.mock('@/api/core/cost', () => ({ saveCost }))
vi.mock('vue-router', () => ({
  onBeforeRouteLeave: (guard: () => Promise<boolean>) => routeGuards.leave.push(guard),
  onBeforeRouteUpdate: (guard: () => Promise<boolean>) => routeGuards.update.push(guard),
}))
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  costOptions: (code: string) =>
    code === 'COST_PAYMENT_STATUS'
      ? [{ value: 'UNPAID', label: '未付款' }]
      : [{ value: 'TRAVEL', label: '差旅费' }],
}))

let page: VueWrapper
beforeEach(() => {
  saveCost.mockReset()
  routeGuards.leave = []
  routeGuards.update = []
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  vi.spyOn(ElMessage, 'info').mockImplementation(() => ({ close: vi.fn() }))
  page = mount(Batch, {
    props: {
      modelValue: true,
      employees: [
        { employeeCode: 'E1', employeeName: '员工甲', departmentId: null, departmentName: '' },
      ],
    },
    global: {
      plugins: [ElementPlus],
      stubs: {
        ElDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        CostCitySelect: { name: 'CostCitySelect', template: '<div/>', props: ['modelValue'] },
        CostExpenseEmployeeSelect: {
          name: 'CostExpenseEmployeeSelect',
          template: '<div/>',
          props: ['modelValue'],
        },
      },
    },
  })
})
afterEach(() => {
  page.unmount()
  vi.restoreAllMocks()
})

const button = (text: string) => page.findAll('button').find((b) => b.text().includes(text))!
async function fill() {
  page.getComponent({ name: 'CostExpenseEmployeeSelect' }).vm.$emit('update:modelValue', 'E1')
  const city = page.getComponent({ name: 'CostCitySelect' })
  city.vm.$emit('loaded', [{ code: 'C1', name: '城市甲' }])
  city.vm.$emit('update:modelValue', 'C1')
  await flushPromises()
  for (const picker of page.findAllComponents({ name: 'ElDatePicker' }))
    picker.vm.$emit('update:modelValue', '2026-10-19')
  for (const select of page.findAllComponents({ name: 'ElSelect' }).slice(1))
    select.vm.$emit('update:modelValue', 'TRAVEL')
  const inputs = page
    .findAllComponents({ name: 'ElInput' })
    .filter((c) => c.props('maxlength') === '200')
  inputs.forEach((input, index) => input.vm.$emit('update:modelValue', `差旅-${index}`))
  page
    .findAllComponents({ name: 'ElInputNumber' })
    .forEach((c) => c.vm.$emit('update:modelValue', 10))
  page
    .findAllComponents({ name: 'ElInput' })
    .filter((c) => c.props('maxlength') === '1000')
    .forEach((c) => c.vm.$emit('update:modelValue', '门店拜访交通'))
  await flushPromises()
}

describe('业务批量录入报销', () => {
  it('批量快递先校验寄送明细，再保留运单与费用归属提交', async () => {
    await fill()
    for (const select of page.findAllComponents({ name: 'ElSelect' }).slice(1))
      select.vm.$emit('update:modelValue', 'COURIER')
    await flushPromises()
    await button('保存本批费用').trigger('click')
    expect(saveCost).not.toHaveBeenCalled()
    expect(page.text()).toContain('请填写快递寄送的寄送内容')
    const values = {
      寄送内容: '合同原件',
      '收件客户 / 合作方': '合作门店',
      快递公司: '顺丰速运',
      运单号: '000012345',
    }
    for (const input of page.findAllComponents({ name: 'ElInput' })) {
      const label = input.find('input').attributes('aria-label') as keyof typeof values
      if (values[label]) input.vm.$emit('update:modelValue', values[label])
    }
    saveCost.mockResolvedValueOnce({ documentNo: 'EXP-COURIER' })
    await button('保存本批费用').trigger('click')
    await flushPromises()
    expect(saveCost).toHaveBeenCalledWith(
      'expenses',
      null,
      expect.objectContaining({
        typeCode: 'COURIER',
        cityCode: 'C1',
        ownerEmployeeCode: 'E1',
        expense: {
          costCategory: 'expense',
          purpose: '门店拜访交通',
          courier: {
            contents: '合同原件',
            recipientName: '合作门店',
            companyName: '顺丰速运',
            trackingNo: '000012345',
          },
        },
      }),
    )
    expect(page.text()).toContain('已保存 · EXP-COURIER')
  })
  it('只重试失败行，网络结果不明时复用原请求编号和内容', async () => {
    await button('增加一行').trigger('click')
    await fill()
    saveCost
      .mockResolvedValueOnce({ documentNo: 'EXP-1' })
      .mockRejectedValueOnce(new Error('网络中断'))
    await button('保存本批费用').trigger('click')
    await flushPromises()
    expect(saveCost).toHaveBeenCalledTimes(2)
    const first = saveCost.mock.calls[0]![2]
    const pending = JSON.parse(JSON.stringify(saveCost.mock.calls[1]![2]))
    expect(first).toMatchObject({
      cityCode: 'C1',
      cityName: '城市甲',
      ownerEmployeeCode: 'E1',
      paymentStatusCode: 'UNPAID',
      amount: 10,
    })
    expect(first.requestId).not.toBe(pending.requestId)
    expect(page.text()).toContain('已保存 · EXP-1')
    saveCost.mockResolvedValueOnce({ documentNo: 'EXP-2' })
    await button('重试未成功记录').trigger('click')
    await flushPromises()
    expect(saveCost).toHaveBeenCalledTimes(3)
    expect(saveCost.mock.calls[2]![2]).toEqual(pending)
    expect(page.text()).toContain('已保存 · EXP-2')
  })

  it('明确校验失败后允许修改，并使用新提交编号', async () => {
    await fill()
    saveCost.mockRejectedValueOnce(
      new ApiError({ code: 'VALIDATION_ERROR', message: '费用事项无效' }, 400),
    )
    await button('保存本批费用').trigger('click')
    await flushPromises()
    const rejectedId = saveCost.mock.calls[0]![2].requestId
    const input = page
      .findAllComponents({ name: 'ElInput' })
      .find((c) => c.props('maxlength') === '200')!
    expect(input.props('disabled')).toBe(false)
    input.vm.$emit('update:modelValue', '修改后的费用事项')
    saveCost.mockResolvedValueOnce({ documentNo: 'EXP-3' })
    await button('保存本批费用').trigger('click')
    await flushPromises()
    expect(saveCost.mock.calls[1]![2]).toMatchObject({ title: '修改后的费用事项' })
    expect(saveCost.mock.calls[1]![2].requestId).not.toBe(rejectedId)
  })

  it('资料不完整时不提交任何费用', async () => {
    await button('保存本批费用').trigger('click')
    expect(saveCost).not.toHaveBeenCalled()
    expect(page.text()).toContain('请填写员工、费用归属')
  })

  it('关闭未保存批次时允许继续录入；明确放弃后清空并关闭', async () => {
    await fill()
    await button('关闭').trigger('click')
    await flushPromises()
    expect(ElMessageBox.confirm).toHaveBeenCalledOnce()
    expect(page.emitted('update:modelValue')).toBeUndefined()
    expect(page.findAllComponents({ name: 'ElInputNumber' })[0]!.props('modelValue')).toBe(10)

    vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce(confirmed)
    await button('关闭').trigger('click')
    await flushPromises()
    expect(page.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(
      page.findAllComponents({ name: 'ElInputNumber' })[0]!.props('modelValue'),
    ).toBeUndefined()
  })

  it('切换页面与刷新保护未保存批次，空白批次不阻止离开', async () => {
    expect(await routeGuards.leave[0]!()).toBe(true)
    const blankReload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(blankReload)
    expect(blankReload.defaultPrevented).toBe(false)

    await fill()
    expect(await routeGuards.leave[0]!()).toBe(false)
    expect(await routeGuards.update[0]!()).toBe(false)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)
    vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce(confirmed)
    expect(await routeGuards.leave[0]!()).toBe(true)
  })

  it('保存期间禁止离开和重复提交，全部保存后关闭无需放弃确认', async () => {
    await fill()
    let complete!: (value: { documentNo: string }) => void
    saveCost.mockImplementationOnce(() => new Promise((resolve) => (complete = resolve)))
    await button('保存本批费用').trigger('click')
    expect(button('关闭').attributes('disabled')).toBeDefined()
    expect(await routeGuards.leave[0]!()).toBe(false)
    await button('重试未成功记录').trigger('click')
    expect(saveCost).toHaveBeenCalledTimes(1)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)

    complete({ documentNo: 'EXP-OK' })
    await flushPromises()
    expect(await routeGuards.leave[0]!()).toBe(true)
    await button('关闭').trigger('click')
    await flushPromises()
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(page.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('部分保存或网络结果不明的批次仍需离开确认', async () => {
    await button('增加一行').trigger('click')
    await fill()
    saveCost
      .mockResolvedValueOnce({ documentNo: 'EXP-1' })
      .mockRejectedValueOnce(new Error('网络中断'))
    await button('保存本批费用').trigger('click')
    await flushPromises()
    expect(await routeGuards.leave[0]!()).toBe(false)
    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('未成功的费用'),
      '离开批量录入',
      expect.any(Object),
    )
    expect(page.text()).toContain('已保存 · EXP-1')
  })
})
