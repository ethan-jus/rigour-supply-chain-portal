import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  getInvoice: vi.fn(),
  getProfiles: vi.fn(),
  apply: vi.fn(),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderInvoice: mocks.getInvoice,
  getOrderInvoiceProfiles: mocks.getProfiles,
  applyOrderInvoice: mocks.apply,
}))

import OrderInvoiceApplyDialog from '@/views/supply-chain/order/components/OrderInvoiceApplyDialog.vue'

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '9',
    orderId: '1',
    orderNo: 'A001',
    statusCode: 'PENDING',
    statusName: '待开票',
    titleType: 'COMPANY',
    titleTypeName: '企业',
    title: '杭州测试有限公司',
    taxNo: '91330100TEST',
    invoiceType: 'NORMAL',
    invoiceTypeName: '普通发票',
    bankName: null,
    bankAccount: null,
    registerAddress: null,
    registerPhone: null,
    email: null,
    remark: null,
    amount: 1000,
    attachments: [],
    invoiceNo: null,
    appliedBy: '张三',
    appliedAt: '2026-09-20T02:00:00Z',
    invoicedBy: null,
    invoicedAt: null,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  }
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    titleType: 'COMPANY',
    titleTypeName: '企业',
    title: '杭州最近有限公司',
    taxNo: '91330100RECENT',
    invoiceType: 'NORMAL',
    invoiceTypeName: '普通发票',
    bankName: null,
    bankAccount: null,
    registerAddress: null,
    registerPhone: null,
    email: null,
    remark: null,
    lastUsedAt: '2026-09-20T02:00:00Z',
    ...overrides,
  }
}

let wrapper: ReturnType<typeof mount> | null = null

function mountDialog(props: Record<string, unknown>) {
  wrapper = mount(OrderInvoiceApplyDialog, {
    props: { modelValue: true, orderNo: 'A001', ...props },
    global: { plugins: [ElementPlus] },
    attachTo: document.body,
  })
  return wrapper
}

function dialogText() {
  return document.body.textContent || ''
}

function bodyInput(placeholder: string) {
  const input = document.body.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!input) throw new Error(`input not found: ${placeholder}`)
  return input
}

async function setInput(placeholder: string, value: string) {
  const input = bodyInput(placeholder)
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function clickButton(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === text,
  )
  if (!button) throw new Error(`button not found: ${text}`)
  button.click()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('申请开票弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getInvoice.mockResolvedValue(null)
    mocks.getProfiles.mockResolvedValue([])
    mocks.apply.mockResolvedValue(invoice())
  })

  it('列表入口打开时自行拉取发票，未申请按空表单申请', async () => {
    mountDialog({})
    await flushPromises()

    expect(mocks.getInvoice).toHaveBeenCalledWith('A001')
    expect(dialogText()).toContain('申请开票')
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('')
  })

  it('已撤回时预填历史资料并提示重新申请', async () => {
    mocks.getInvoice.mockResolvedValue(invoice({ statusCode: 'REVOKED', statusName: '已撤回' }))
    mountDialog({})
    await flushPromises()

    expect(dialogText()).toContain('重新申请开票')
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('杭州测试有限公司')
  })

  it('面板传入待开票发票时不再拉取，直接改资料', async () => {
    mountDialog({ invoice: invoice() })
    await flushPromises()

    expect(mocks.getInvoice).not.toHaveBeenCalled()
    expect(dialogText()).toContain('修改开票资料')
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('杭州测试有限公司')
  })

  it('提交成功后回传新视图并关闭', async () => {
    mountDialog({})
    await flushPromises()

    await setInput('营业执照/身份证上的名称', '新抬头有限公司')
    await setInput('企业抬头必填', '91330100NEW')
    clickButton('提交申请')
    await flushPromises()

    expect(mocks.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNo: 'A001',
        title: '新抬头有限公司',
        taxNo: '91330100NEW',
        titleType: 'COMPANY',
        invoiceType: 'NORMAL',
      }),
    )
    expect(wrapper?.emitted('applied')).toHaveLength(1)
    expect(wrapper?.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('客户有多套开票资料时下拉默认选最近一套并回显', async () => {
    mocks.getProfiles.mockResolvedValue([
      profile({ id: 1, title: '杭州最近有限公司', taxNo: '91330100RECENT' }),
      profile({ id: 2, title: '上海历史有限公司', taxNo: '91310000OLD' }),
    ])
    mountDialog({})
    await flushPromises()

    expect(dialogText()).toContain('开票信息')
    expect(dialogText()).toContain('已带入该客户最近使用的开票信息')
    expect(dialogText()).toContain('杭州最近有限公司')
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('杭州最近有限公司')
  })

  it('切换到新增开票信息后清空表单', async () => {
    mocks.getProfiles.mockResolvedValue([profile()])
    mountDialog({})
    await flushPromises()
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('杭州最近有限公司')

    const selectWrapper = document.body.querySelector('.el-select__wrapper') as HTMLElement | null
    expect(selectWrapper).toBeTruthy()
    selectWrapper!.click()
    await flushPromises()
    const newOption = Array.from(document.body.querySelectorAll('.el-select-dropdown__item')).find(
      (node) => node.textContent?.includes('新增开票信息'),
    )
    expect(newOption).toBeTruthy()
    ;(newOption as HTMLElement).click()
    await flushPromises()

    expect(dialogText()).toContain('已切换为新增开票信息')
    expect(bodyInput('营业执照/身份证上的名称').value).toBe('')
  })

  it('必填红星跟随条件切换：企业必填税号，个人不需要', async () => {
    mountDialog({})
    await flushPromises()

    function taxNoFormItem() {
      return Array.from(document.body.querySelectorAll('.el-form-item')).find((node) =>
        node.textContent?.includes('纳税人识别号'),
      )
    }
    expect(taxNoFormItem()?.classList.contains('is-required')).toBe(true)

    const personRadio = Array.from(document.body.querySelectorAll('.el-radio')).find((node) =>
      node.textContent?.includes('个人'),
    )
    expect(personRadio).toBeTruthy()
    ;(personRadio!.querySelector('input') as HTMLInputElement).click()
    await flushPromises()

    expect(taxNoFormItem()?.classList.contains('is-required')).toBe(false)
  })
})
