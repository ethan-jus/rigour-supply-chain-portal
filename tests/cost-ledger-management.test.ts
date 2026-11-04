import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import View from '@/views/supply-chain/cost/CostLedgerManagementView.vue'
import { createLedgerCommand, newParty } from '@/views/supply-chain/cost/cost-ledger'
import type { CostPage, CostRecord } from '@/api/core/cost'

const state = vi.hoisted(() => ({ route: {} as { path: string; query: Record<string, string> } }))
const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
  cities: vi.fn(),
  employees: vi.fn(),
  save: vi.fn(),
  transition: vi.fn(),
  parties: vi.fn(),
  export: vi.fn(),
  workbook: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/cost', () => ({
  getCosts: api.list,
  getCost: api.detail,
  getCostHistory: api.history,
  getCostCities: api.cities,
  getCostEmployees: api.employees,
  saveCost: api.save,
  changeCostStatus: api.transition,
  uploadCostAttachment: vi.fn(),
}))
vi.mock('@/api/core/cost-ledger', () => ({
  getLedgerParties: api.parties,
  getLedgerExport: api.export,
}))
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: api.workbook }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '—',
}))

const empty = (): CostPage => ({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  confirmedAmount: 0,
  pendingAmount: 0,
  registeredAmount: 0,
  missingAmountCount: 0,
  thirdPartyCount: 0,
  warehouseCount: 0,
})
const record = (id = 'LC-1', status = 'DRAFT'): CostRecord => {
  const data = createLedgerCommand(true)
  data.costDate = '2026-11-04'
  data.cityCode = 'WH'
  data.cityName = '武汉'
  data.amount = 300
  data.ledger!.sender = { ...newParty('WH'), partyTypeCode: 'OTHER', manualName: '武汉城市仓' }
  data.ledger!.receivingPoints = ['星河门店', '长江门店'].map((name) => ({
    ...newParty('WH'),
    partyTypeCode: 'OTHER',
    manualName: name,
    contactName: '张三',
    phone: '13800000000',
    address: '武汉市示例路1号',
  }))
  return {
    id,
    documentNo: id,
    statusCode: status,
    revision: 1,
    categoryCode: 'LOGISTICS',
    data,
    sources: [],
    warehouseName: null,
    ownerEmployeeName: null,
    createdTime: '2026-11-04T01:00:00Z',
    updatedTime: '2026-11-04T01:00:00Z',
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let wrapper: VueWrapper
const button = (name: string) => wrapper.findAll('button').find((b) => b.text() === name)!
async function open() {
  wrapper = mount(View, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        CostCitySelect: true,
        CostDictSelect: true,
        CostLedgerPartySelect: true,
        CostAttachmentEditor: true,
        CostAttachments: true,
        CostLedgerEditor: {
          name: 'CostLedgerEditor',
          props: ['modelValue', 'logistics'],
          template: '<div class="editor-probe" />',
        },
        CostLedgerDetail: {
          props: ['row'],
          template: '<div class="detail-probe">{{row.documentNo}}</div>',
        },
        ElDialog: {
          props: ['modelValue', 'title'],
          template:
            '<section v-if="modelValue" class="dialog-probe"><h2>{{title}}</h2><slot/><slot name="footer"/></section>',
        },
      },
    },
  })
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  state.route = reactive({ path: '/supply-chain/cost/logistics', query: {} })
  api.cities.mockResolvedValue([{ code: 'WH', name: '武汉' }])
  api.employees.mockResolvedValue([])
  api.parties.mockResolvedValue([])
  api.list.mockResolvedValue({ ...empty(), total: 1, items: [record()], confirmedAmount: 1200 })
  api.detail.mockImplementation(async (_category, id) => record(id))
  api.history.mockResolvedValue([])
  api.transition.mockResolvedValue(record())
  api.workbook.mockResolvedValue(undefined)
})
afterEach(() => {
  wrapper?.unmount()
  ElMessage.closeAll()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('精简成本台账页面业务流程', () => {
  it('实际列出两个收货方，并保留编辑、确认、作废和记录入口', async () => {
    await open()
    expect(wrapper.findAll('.recipient-names > div').map((n) => n.text())).toEqual([
      '星河门店',
      '长江门店',
    ])
    expect(wrapper.text()).not.toContain('2个收货点')
    expect(wrapper.get('.metric.primary').text()).toContain('1,200.00')
    for (const name of ['查看', '编辑', '确认', '作废', '记录']) expect(button(name)).toBeDefined()
  })
  it('列表失败时金额保持未知，不能展示为零费用', async () => {
    api.list.mockRejectedValueOnce(new Error('费用服务暂不可用'))
    await open()
    expect(wrapper.text()).toContain('费用服务暂不可用')
    expect(wrapper.get('.metrics').text()).not.toContain('0.00')
    expect(wrapper.get('.metric.primary strong').text()).toBe('—')
  })
  it.each(['查看', '编辑', '记录'])('%s请求迟到时不能串入仓储页面', async (action) => {
    const pending = deferred<CostRecord>()
    const logs = deferred<never[]>()
    await open()
    api.detail.mockReturnValueOnce(pending.promise)
    api.history.mockReturnValueOnce(logs.promise)
    await button(action).trigger('click')
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    api.list.mockResolvedValue(empty())
    await flushPromises()
    pending.resolve(record('OLD-LOGISTICS'))
    logs.resolve([])
    await flushPromises()
    expect(wrapper.find('.dialog-probe').exists()).toBe(false)
    expect(wrapper.get('.list-toolbar').text()).toContain('仓储费用')
  })
  it('导出跨页期间修改筛选，仍使用点击导出时的条件并列出全部收货方', async () => {
    const first = deferred<CostPage>()
    const rows = Array.from({ length: 201 }, (_, i) => record(`LC-${i}`))
    api.export
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ...empty(), total: 201, begin: 200, items: [rows[200]!] })
    await open()
    await wrapper.get('.filters input').setValue('ORIGINAL')
    await button('导出').trigger('click')
    await wrapper.get('.filters input').setValue('CHANGED')
    first.resolve({ ...empty(), total: 201, items: rows.slice(0, 200) })
    await flushPromises()
    expect(api.export).toHaveBeenNthCalledWith(
      2,
      true,
      expect.objectContaining({ begin: 200, documentNo: 'ORIGINAL' }),
    )
    expect(api.workbook.mock.calls[0]![2]).toHaveLength(201)
    expect(api.workbook.mock.calls[0]![2][0][4]).toBe('星河门店\n长江门店')
  })
  it('服务返回数量超过总数时停止导出，不生成口径不一致的文件', async () => {
    api.export.mockResolvedValue({ ...empty(), total: 1, items: [record('LC-1'), record('LC-2')] })
    const error = vi.spyOn(ElMessage, 'error')
    await open()
    await button('导出').trigger('click')
    await flushPromises()
    expect(api.workbook).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('导出期间数据已变化，请重新导出')
  })
  it('确认与作废继续调用对应服务并保存作废原因', async () => {
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({
      value: '重复登记，作废保留原始记录',
    } as never)
    await open()
    await button('确认').trigger('click')
    await flushPromises()
    expect(api.transition).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ id: 'LC-1' }),
      'confirm',
      '',
    )
    await button('作废').trigger('click')
    await flushPromises()
    expect(api.transition).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ id: 'LC-1' }),
      'void',
      '重复登记，作废保留原始记录',
    )
  })
  it('修改已确认费用必须填写原因，保存后保持已确认且附件只读', async () => {
    const confirmed = record('LC-1', 'CONFIRMED')
    api.list.mockResolvedValue({ ...empty(), total: 1, items: [confirmed] })
    api.detail.mockResolvedValue(confirmed)
    api.save.mockResolvedValue({ ...confirmed, revision: 2 })
    const success = vi.spyOn(ElMessage, 'success')
    await open()
    await button('编辑').trigger('click')
    await flushPromises()
    expect(wrapper.find('cost-attachment-editor-stub').exists()).toBe(false)
    expect(wrapper.find('cost-attachments-stub').attributes('editable')).toBe('false')
    const form = wrapper.findComponent({ name: 'CostLedgerEditor' }).props('modelValue')
    form.reason = ''
    await button('保存').trigger('click')
    await flushPromises()
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请填写修改已确认费用的原因')
    form.reason = '物流公司更正实际运费'
    await button('保存').trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      'logistics',
      'LC-1',
      expect.objectContaining({ reason: '物流公司更正实际运费', revision: 2 }),
    )
    expect(success).toHaveBeenCalledWith('费用已更新，保持已确认状态')
  })
  it('确认弹窗等待期间切换页面，不向其他成本类别提交旧记录', async () => {
    const confirm = deferred<never>()
    vi.spyOn(ElMessageBox, 'confirm').mockReturnValueOnce(confirm.promise)
    await open()
    await button('确认').trigger('click')
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    api.list.mockResolvedValue(empty())
    await flushPromises()
    confirm.resolve('confirm' as never)
    await flushPromises()
    expect(api.transition).not.toHaveBeenCalled()
  })
})
