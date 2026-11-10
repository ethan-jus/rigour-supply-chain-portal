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
  selectedExport: vi.fn(),
  workbook: vi.fn(),
  dictionaries: vi.fn(),
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
  getSelectedLogisticsExport: api.selectedExport,
}))
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: api.workbook }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: api.dictionaries,
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
async function exportNow() {
  await button('自定义导出').trigger('click')
  await flushPromises()
  await button('开始导出').trigger('click')
  await flushPromises()
}
async function selectRows(ids: string[]) {
  for (const row of wrapper.findAll('.ledger-table .el-table__body-wrapper tbody tr')) {
    if (ids.some((id) => row.text().includes(id)))
      await row.get('input[type="checkbox"]').setValue(true)
  }
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  state.route = reactive({ path: '/supply-chain/cost/logistics', query: {} })
  api.cities.mockResolvedValue([{ code: 'WH', name: '武汉' }])
  api.dictionaries.mockResolvedValue(undefined)
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
  it('默认列与六个常用筛选按已确认方案排列，物流公司移至可选列', async () => {
    await open()
    expect(wrapper.findAll('.filter-panel .el-form-item__label').map((e) => e.text())).toEqual([
      '费用单号',
      '货拉拉／运单号',
      '业务单号',
      '运输类型',
      '运输日期',
      '单据状态',
    ])
    const columns = wrapper
      .findAll('.ledger-table .el-table__header th')
      .map((e) => e.text())
      .filter(Boolean)
    expect(columns).toEqual([
      '费用单号',
      '货拉拉／运单号',
      '运输类型',
      '运输日期',
      '收货方',
      '本单我方费用（元）',
      '单据状态',
      '创建人',
      '操作',
    ])
    await button('更多条件').trigger('click')
    expect(wrapper.findAll('.filter-panel .el-form-item__label').map((e) => e.text())).toEqual(
      expect.arrayContaining(['客户／收货方', '业务员', '归属部门']),
    )
  })

  it('仓储费用同样支持选中记录及自选字段，重新打开默认恢复全部字段', async () => {
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    api.list.mockResolvedValue({ ...empty(), total: 2, items: [record('WH-1'), record('WH-2')] })
    api.export.mockResolvedValue({ ...empty(), total: 2, items: [record('WH-1'), record('WH-2')] })
    await open()
    await selectRows(['WH-2'])
    await button('自定义导出').trigger('click')
    await flushPromises()
    expect(wrapper.find('.export-scope').text()).toContain('已勾选的 1 条记录')
    const fields = wrapper.findAll('.export-fields input[type="checkbox"]')
    expect(fields).toHaveLength(8)
    for (const [i, field] of fields.entries()) if (i !== 0 && i !== 4) await field.setValue(false)
    await button('开始导出').trigger('click')
    await flushPromises()
    expect(api.workbook).toHaveBeenLastCalledWith(
      '仓储费用',
      ['费用单号', '本单费用总额（元）'],
      [['WH-2', 300]],
    )
    expect(api.selectedExport).not.toHaveBeenCalled()
    await button('自定义导出').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.export-fields input:checked')).toHaveLength(8)
  })
  it('字典和档案目录迟到时列表与汇总先展示，目录完成前不能新增或编辑', async () => {
    const city = deferred<{ code: string; name: string }[]>()
    const dictionary = deferred<void>()
    api.cities.mockReturnValueOnce(city.promise)
    api.dictionaries.mockReturnValueOnce(dictionary.promise)
    await open()
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(api.employees).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.metric.primary').text()).toContain('1,200.00')
    expect(wrapper.text()).toContain('LC-1')
    expect(button('新增运输记录').attributes('disabled')).toBeDefined()
    expect(button('编辑').attributes('disabled')).toBeDefined()
    city.resolve([{ code: 'WH', name: '武汉' }])
    dictionary.resolve()
    await flushPromises()
    expect(button('新增运输记录').attributes('disabled')).toBeUndefined()
    expect(button('编辑').attributes('disabled')).toBeUndefined()
    expect(api.list).toHaveBeenCalledTimes(1)
  })
  it('目录失败不丢弃列表金额，也不能打开缺少档案的编辑表单', async () => {
    api.employees.mockRejectedValueOnce(new Error('员工目录暂不可用'))
    await open()
    expect(wrapper.text()).toContain('员工目录暂不可用')
    expect(wrapper.get('.metric.primary').text()).toContain('1,200.00')
    expect(button('新增运输记录').attributes('disabled')).toBeDefined()
    await button('查看').trigger('click')
    await flushPromises()
    expect(wrapper.get('.detail-probe').text()).toBe('LC-1')
  })
  it('实际列出两个收货方，并保留编辑、确认、作废和记录入口', async () => {
    await open()
    expect(wrapper.findAll('.recipient-names > div').map((n) => n.text())).toEqual([
      '星河门店',
      '长江门店',
    ])
    expect(wrapper.text()).not.toContain('2个收货点')
    expect(wrapper.get('.metric.primary').text()).toContain('1,200.00')
    for (const name of ['查看', '编辑', '确认', '作废']) expect(button(name)).toBeDefined()
  })
  it('列表失败时金额保持未知，不能展示为零费用', async () => {
    api.list.mockRejectedValueOnce(new Error('费用服务暂不可用'))
    await open()
    expect(wrapper.text()).toContain('费用服务暂不可用')
    expect(wrapper.get('.metrics').text()).not.toContain('0.00')
    expect(wrapper.get('.metric.primary strong').text()).toBe('—')
  })
  it('仓库缺业务归属时阻止保存并保留内容；补齐后重试重新读取档案', async () => {
    await open()
    await button('编辑').trigger('click')
    await flushPromises()
    const form = wrapper.findComponent({ name: 'CostLedgerEditor' }).props('modelValue')
    form.ledger.sender = { ...newParty('WH'), partyTypeCode: 'WAREHOUSE', partyCode: 'WH1' }
    form.remark = '到仓前联系收货人'
    api.parties.mockResolvedValue([{ code: 'WH1', name: '武汉仓', cityCode: null }])
    await button('保存').trigger('click')
    await flushPromises()
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('武汉仓（WH1）”未维护业务归属地区')
    const link = wrapper.get('a[href="#/supply-chain/erp/inventory/warehouses"]')
    expect(link.attributes('target')).toBe('_blank')
    expect(form.remark).toBe('到仓前联系收货人')
    api.parties.mockResolvedValue([{ code: 'WH1', name: '武汉仓', cityCode: 'WH' }])
    api.save.mockResolvedValue(record('LC-1'))
    await button('保存').trigger('click')
    await flushPromises()
    expect(api.parties).toHaveBeenCalledTimes(2)
    expect(api.save).toHaveBeenCalledWith(
      'logistics',
      'LC-1',
      expect.objectContaining({ remark: '到仓前联系收货人' }),
    )
  })
  it('仓库引用加载失败时保留表单并停止保存，不能当成已维护', async () => {
    await open()
    await button('编辑').trigger('click')
    await flushPromises()
    const form = wrapper.findComponent({ name: 'CostLedgerEditor' }).props('modelValue')
    form.ledger.receivingPoints[0].partyTypeCode = 'WAREHOUSE'
    form.ledger.receivingPoints[0].partyCode = 'WH1'
    api.parties.mockRejectedValueOnce(new Error('仓库服务暂不可用'))
    await button('保存').trigger('click')
    await flushPromises()
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('仓库服务暂不可用')
    expect(wrapper.find('.editor-probe').exists()).toBe(true)
  })
  it('保存前仓库校验返回时已切换页面，不提交旧单据', async () => {
    await open()
    await button('编辑').trigger('click')
    await flushPromises()
    const form = wrapper.findComponent({ name: 'CostLedgerEditor' }).props('modelValue')
    form.ledger.sender = { ...newParty('WH'), partyTypeCode: 'WAREHOUSE', partyCode: 'WH1' }
    const pending = deferred<{ code: string; name: string; cityCode: string }[]>()
    api.parties.mockReturnValueOnce(pending.promise)
    await button('保存').trigger('click')
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    api.list.mockResolvedValue(empty())
    await flushPromises()
    pending.resolve([{ code: 'WH1', name: '武汉仓', cityCode: 'WH' }])
    await flushPromises()
    expect(api.save).not.toHaveBeenCalled()
  })
  it.each(['查看', '编辑'])('%s请求迟到时不能串入仓储页面', async (action) => {
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
    await button('查询').trigger('click')
    await flushPromises()
    await button('自定义导出').trigger('click')
    await flushPromises()
    await button('开始导出').trigger('click')
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
    await open()
    await exportNow()
    expect(api.workbook).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('导出期间数据已变化，请重新导出')
  })
  it('未勾选时导出当前筛选的全部数据，而不是仅当前页', async () => {
    api.export.mockResolvedValue({ ...empty(), total: 2, items: [record('LC-1'), record('LC-2')] })
    await open()
    await exportNow()
    expect(api.selectedExport).not.toHaveBeenCalled()
    expect(api.export).toHaveBeenCalledWith(true, expect.objectContaining({ begin: 0, step: 200 }))
    expect(api.workbook.mock.calls[0]![2].map((r: string[]) => r[0])).toEqual(['LC-1', 'LC-2'])
  })
  it('勾选后只取所选数据并读取服务端最新金额，不能走全量导出接口', async () => {
    api.list.mockResolvedValue({ ...empty(), total: 2, items: [record('LC-1'), record('LC-2')] })
    const latest = record('LC-2')
    latest.data.amount = 456
    api.selectedExport.mockResolvedValue([latest])
    await open()
    await selectRows(['LC-2'])
    expect(wrapper.get('.selection-toolbar').text()).toContain('已勾选 1 条')
    await exportNow()
    expect(api.selectedExport).toHaveBeenCalledWith(['LC-2'])
    expect(api.export).not.toHaveBeenCalled()
    expect(api.workbook.mock.calls[0]![2]).toHaveLength(1)
    expect(api.workbook.mock.calls[0]![2][0][0]).toBe('LC-2')
    expect(api.workbook.mock.calls[0]![2][0][8]).toBe(456)
  })
  it('跨页保留勾选，重新查询时清除勾选', async () => {
    api.list
      .mockResolvedValueOnce({ ...empty(), total: 40, items: [record('LC-1')] })
      .mockResolvedValue({ ...empty(), total: 40, items: [record('LC-2')] })
    api.selectedExport.mockResolvedValue([record('LC-1'), record('LC-2')])
    await open()
    await selectRows(['LC-1'])
    await wrapper.get('.btn-next').trigger('click')
    await flushPromises()
    await selectRows(['LC-2'])
    expect(wrapper.get('.selection-toolbar').text()).toContain('已勾选 2 条')
    await exportNow()
    expect(api.selectedExport).toHaveBeenCalledWith(['LC-1', 'LC-2'])
    await button('查询').trigger('click')
    await flushPromises()
    expect(wrapper.find('.selection-toolbar').exists()).toBe(false)
  })
  it('自定义字段只导出所勾表头，不能导出空字段文件', async () => {
    api.export.mockResolvedValue({ ...empty(), total: 1, items: [record()] })
    await open()
    await button('自定义导出').trigger('click')
    await flushPromises()
    const fields = wrapper
      .findComponent({ name: 'CostExportDialog' })
      .findComponent({ name: 'ElCheckboxGroup' })
    fields.vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(button('开始导出').attributes('disabled')).toBeDefined()
    expect(api.export).not.toHaveBeenCalled()
    fields.vm.$emit('update:modelValue', ['documentNo', 'amount'])
    await flushPromises()
    await button('开始导出').trigger('click')
    await flushPromises()
    expect(api.workbook).toHaveBeenCalledWith(
      '物流运输记录',
      ['费用单号', '本单我方费用（元）'],
      [['LC-1', 300]],
    )
  })
  it('部分所选数据缺失时停止下载，不能退回导出全部', async () => {
    api.selectedExport.mockResolvedValue([])
    await open()
    await selectRows(['LC-1'])
    await exportNow()
    expect(wrapper.text()).toContain('所选记录已变化')
    expect(api.export).not.toHaveBeenCalled()
    expect(api.workbook).not.toHaveBeenCalled()
  })
  it('再次打开导出默认恢复全部字段，不沿用上次只选两列的状态', async () => {
    api.export.mockResolvedValue({ ...empty(), total: 1, items: [record()] })
    await open()
    await button('自定义导出').trigger('click')
    await flushPromises()
    wrapper
      .findComponent({ name: 'CostExportDialog' })
      .findComponent({ name: 'ElCheckboxGroup' })
      .vm.$emit('update:modelValue', ['documentNo', 'amount'])
    await flushPromises()
    await button('开始导出').trigger('click')
    await flushPromises()
    expect(api.workbook.mock.calls[0]![1]).toHaveLength(2)
    await exportNow()
    expect(api.workbook.mock.calls[1]![1]).toHaveLength(11)
    expect(api.workbook.mock.calls[1]![2][0]).toHaveLength(11)
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
  it('已确认只可查看和撤销，作废后才出现删除', async () => {
    vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '业务变更' } as never)
    api.list.mockResolvedValue({ ...empty(), total: 1, items: [record('LC-1', 'CONFIRMED')] })
    await open()
    expect(
      wrapper.findAll('button').filter((b) => ['编辑', '作废', '删除', '确认'].includes(b.text())),
    ).toHaveLength(0)
    await button('撤销').trigger('click')
    await flushPromises()
    expect(api.transition).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ id: 'LC-1' }),
      'revoke',
      expect.any(String),
    )
    api.list.mockResolvedValue({ ...empty(), total: 1, items: [record('LC-1', 'VOID')] })
    await button('查询').trigger('click')
    await flushPromises()
    expect(
      wrapper.findAll('button').filter((b) => ['编辑', '作废', '确认', '撤销'].includes(b.text())),
    ).toHaveLength(0)
    await button('删除').trigger('click')
    await flushPromises()
    expect(api.transition).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ id: 'LC-1' }),
      'delete',
      expect.any(String),
    )
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
