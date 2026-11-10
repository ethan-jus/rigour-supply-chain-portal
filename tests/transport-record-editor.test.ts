import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/cost/TransportRecordEditor.vue'
import type { TransportDetail } from '@/api/core/transport-records'
import type { CostSource } from '@/api/core/cost'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))

const api = vi.hoisted(() => ({ employees: vi.fn(), history: vi.fn(), sources: vi.fn() }))
vi.mock('@/api/core/cost', () => ({
  getCostEmployees: api.employees,
  getCostHistory: api.history,
  getCostCities: vi.fn(),
  saveCost: vi.fn(),
}))
vi.mock('@/api/core/cost-ledger', () => ({
  getLedgerSources: api.sources,
  getLedgerParties: vi.fn(),
}))
vi.mock('@/api/core/transport-records', () => ({ saveTransport: vi.fn() }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn(),
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))

function detail(): TransportDetail {
  const data = createLedgerCommand(true)
  data.ledger = null
  data.typeCode = 'DELIVERY'
  data.amount = 100.01
  data.costDate = '2026-11-10'
  return {
    platform: null,
    record: {
      id: 'C1',
      documentNo: 'LC1',
      revision: 2,
      categoryCode: 'LOGISTICS',
      statusCode: 'CONFIRMED',
      data,
      warehouseName: null,
      ownerEmployeeName: null,
      sources: [
        {
          id: 'S1',
          documentNo: 'SO1',
          sourceType: 'SALES_ORDER',
          receiverName: '确认时的门店',
          employeeName: '确认时的业务员',
          departmentName: '确认时的部门',
          documentDate: '2026-11-01',
          contactName: '原收货人',
          contactPhone: '13900000001',
          destinationAddress: '原收货地址',
        } as CostSource,
      ],
      createdTime: '',
      updatedTime: '',
    },
  }
}
const global = {
  plugins: [ElementPlus],
  stubs: {
    CostAttachments: true,
    CostAttachmentEditor: true,
    CostLedgerSourcePicker: true,
    CostCitySelect: true,
    CostLedgerPartySelect: true,
    CostLedgerEditor: true,
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  api.employees.mockResolvedValue([])
  api.history.mockResolvedValue([])
  api.sources.mockResolvedValue([
    { documentNo: 'SO1', receiverName: '后续修改的门店', documentDate: '2026-11-01' },
  ])
})
describe('运输记录详情回填', () => {
  it.each(['完整来源快照', '台账快照'])(
    '只读详情使用%s，不覆盖确认时的业务资料',
    async (format) => {
      const d = detail()
      if (format === '台账快照') {
        const ledger = createLedgerCommand(true).ledger!
        ledger.receivingPoints = [
          {
            pointCode: 'TO1',
            partyTypeCode: 'CUSTOMER',
            partyCode: 'CU1',
            manualName: null,
            displayName: '确认时的门店',
            contactName: '原收货人',
            phone: '13900000001',
            address: '原收货地址',
            cityCode: '4201',
          },
        ]
        ledger.sources = [
          {
            orderCode: 'SO1',
            orderTypeCode: 'SALES_ORDER',
            linkRoleCode: 'COST',
            employeeName: '确认时的业务员',
            departmentName: '确认时的部门',
            allocations: [
              {
                feeKey: 'F1',
                receivingPointCode: 'TO1',
                cityCode: '4201',
                basis: 1,
                amount: 100.01,
              },
            ],
          },
        ]
        d.record.data.ledger = ledger
        d.record.sources = []
      }
      const wrapper = mount(Editor, {
        props: { modelValue: true, readonly: true, detail: d },
        global,
        attachTo: document.body,
      })
      await flushPromises()
      if (format === '台账快照') expect(api.sources).toHaveBeenCalledOnce()
      else expect(api.sources).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('确认时的门店')
      expect(document.body.textContent).toContain('确认时的业务员')
      expect(document.body.textContent).toContain('确认时的部门')
      expect(document.body.textContent).not.toContain('后续修改的门店')
      const receiverSection = Array.from(document.body.querySelectorAll('.transport-section')).find(
        (s) => s.querySelector('h3')?.textContent === '收货信息',
      )
      expect(receiverSection?.textContent).toContain('原收货人')
      expect(receiverSection?.textContent).toContain('13900000001')
      expect(receiverSection?.textContent).toContain('原收货地址')
      wrapper.unmount()
      document.body.innerHTML = ''
    },
  )
  it('历史未关联原单仍显示已保存的收货方、地址和物流公司，不提示查看者选单', async () => {
    const d = detail()
    d.record.sources = []
    d.record.data.logistics = {
      ...createLedgerCommand(true).logistics!,
      receiverName: '历史收货仓',
      destinationAddress: '历史收货地址',
      carrierName: '历史承运公司',
    }
    const wrapper = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const receiverSection = Array.from(document.body.querySelectorAll('.transport-section')).find(
      (s) => s.querySelector('h3')?.textContent === '收货信息',
    )
    expect(receiverSection?.textContent).toContain('历史收货仓')
    expect(receiverSection?.textContent).toContain('历史收货地址')
    expect(document.body.textContent).toContain('历史承运公司')
    expect(document.body.textContent).not.toContain('选择业务订单后显示收货信息')
    expect(api.sources).not.toHaveBeenCalled()
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it.each([
    ['DRAFT', ['编辑', '确认', '作废'], ['撤销', '删除']],
    ['CONFIRMED', ['撤销'], ['编辑', '确认', '作废', '删除']],
    ['VOID', ['删除'], ['编辑', '确认', '作废', '撤销']],
  ])('详情 %s 只提供允许的操作并从详情进入订单关联', async (status, allowed, forbidden) => {
    const d = detail()
    d.record.statusCode = status as string
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const heading = document.body.querySelector('.record-heading')!
    const labels = Array.from(heading.querySelectorAll('button')).map((b) => b.textContent!.trim())
    for (const label of allowed as string[]) expect(labels).toContain(label)
    for (const label of forbidden as string[]) expect(labels).not.toContain(label)
    const link = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === '更改关联',
    )
    if (status === 'DRAFT') {
      link!.click()
      await flushPromises()
      expect(w.emitted('edit')).toEqual([['orders']])
    } else expect(link).toBeUndefined()
    w.unmount()
    document.body.innerHTML = ''
  })
  it('资料未加载完时不能保存半加载的运输记录', async () => {
    api.employees.mockReturnValue(new Promise(() => {}))
    const d = detail()
    d.record.statusCode = 'DRAFT'
    const wrapper = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const save = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '保存运输记录',
    )
    expect(save?.disabled).toBe(true)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
