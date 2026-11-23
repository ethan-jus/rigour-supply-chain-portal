import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import SalesShipmentView from '@/views/supply-chain/order/SalesShipmentView.vue'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  update: vi.fn(),
  can: vi.fn(() => true),
}))
vi.mock('@/api/core/order-sales', () => ({
  getSalesShipments: api.list,
  getSalesShipment: api.detail,
  updateSalesShipmentLogistics: api.update,
  deleteSalesShipment: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: api.can }),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryOptions: () => [{ value: 'JT', label: '极兔速递' }],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
  refreshBusinessDictionary: vi.fn(),
}))

const shipment = {
  id: '1',
  shipmentNo: 'DHB-1',
  sourceSystemCode: 'DINGHUOBAO',
  sourceDocumentNo: 'FH.20261123.0001',
  salesOrderNoSnapshot: 'DH.20261123.0001',
  logisticsCompany: '极兔速递',
  trackingNo: 'JT123',
  shipTime: '2026-11-23T05:14:00Z',
  shipmentStatusCode: 'SIGNED',
  remark: '原备注',
  revision: 3,
  lines: [],
}

let wrapper: VueWrapper | undefined
const renderPage = () =>
  mount(SalesShipmentView, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: {
        DhbPageSyncButton: true,
        SupplyPageHelp: true,
        SupplyActionLabel: { template: '<span>{{ fallback }}</span>', props: ['fallback'] },
      },
    },
  })

beforeEach(() => {
  vi.clearAllMocks()
  api.can.mockReturnValue(true)
  api.list.mockResolvedValue({ items: [shipment], total: 1, begin: 0, step: 20 })
  api.detail.mockResolvedValue(shipment)
  api.update.mockResolvedValue({ ...shipment, trackingNo: 'JT456', remark: null, revision: 4 })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('发货单编辑物流信息', () => {
  it('打开订货宝发货单后，只提交改动字段并重新加载列表', async () => {
    wrapper = renderPage()
    await flushPromises()
    const edit = wrapper.findAll('button').find((button) => button.text() === '编辑')
    expect(edit).toBeDefined()
    await edit!.trigger('click')
    await flushPromises()
    expect(api.detail).toHaveBeenCalledWith('1')
    const dialog = wrapper.get('.el-dialog')
    expect(dialog.get('.el-select').text()).toContain('极兔速递')
    expect(dialog.get<HTMLTextAreaElement>('textarea').element.value).toBe('原备注')
    expect(dialog.findAll<HTMLInputElement>('input').map(({ element }) => element.value)).toContain(
      '2026-11-23 13:14:00',
    )
    const trackingInput = dialog
      .findAll<HTMLInputElement>('input')
      .find((input) => input.element.value === 'JT123')
    expect(trackingInput).toBeDefined()
    await trackingInput!.setValue('JT456')
    await dialog.get('textarea').setValue('')
    await dialog
      .findAll('button')
      .find((button) => button.text() === '保存')!
      .trigger('click')
    await flushPromises()

    expect(api.update).toHaveBeenCalledWith('1', { revision: 3, trackingNo: 'JT456', remark: '' })
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['历史物流公司', 'JT123', '历史物流公司'],
    ['立即送', '', '立即送（自配送）'],
  ])('回显%s，改备注时不会重写原物流公司', async (company, trackingNo, display) => {
    api.detail.mockResolvedValueOnce({ ...shipment, logisticsCompany: company, trackingNo })
    wrapper = renderPage()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    const dialog = wrapper.get('.el-dialog')
    expect(dialog.get('.el-select').text()).toContain(display)

    await dialog.get('textarea').setValue('改备注')
    await dialog
      .findAll('button')
      .find((button) => button.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith('1', { revision: 3, remark: '改备注' })
  })

  it('取消的发货单不显示编辑入口', async () => {
    api.list.mockResolvedValueOnce({
      items: [{ ...shipment, shipmentStatusCode: 'CANCELLED' }],
      total: 1,
    })
    wrapper = renderPage()
    await flushPromises()
    expect(wrapper.findAll('button').some((button) => button.text() === '编辑')).toBe(false)
  })
})
