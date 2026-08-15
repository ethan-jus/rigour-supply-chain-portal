import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const crmApi = vi.hoisted(() => ({
  getCrmCustomers: vi.fn(),
  getCrmCustomer: vi.fn(),
  getCrmShippingAddresses: vi.fn(),
  getCrmCustomerTypes: vi.fn(),
  getCrmCustomerAreas: vi.fn(),
  getCrmExternalStaff: vi.fn(),
  syncCrmData: vi.fn(),
}))

const messages = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))
const routeMeta = vi.hoisted(() => ({ routeKey: 'supply.crm.customers.profiles' }))

vi.mock('@/api', () => crmApi)
vi.mock('@/api/core/business-settings', () => ({
  resolveBizDict: vi.fn().mockResolvedValue({ dictionary: {}, items: [] }),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ meta: routeMeta }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: (permission: string) => permission === 'crm:customer:write' }),
}))
vi.mock('element-plus', () => ({
  ElMessage: messages,
}))

import CrmMasterDataView from '@/views/supply-chain/crm/CrmMasterDataView.vue'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'

const passthrough = defineComponent({ template: '<div><slot /></div>' })
const cardStub = defineComponent({ template: '<section><slot name="header" /><slot /></section>' })
const buttonStub = defineComponent({
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
})
const selectStub = defineComponent({
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
})
const emptyStub = defineComponent({ template: '<span />' })

function mountPage() {
  return mount(CrmMasterDataView, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElAlert: passthrough,
        ElButton: buttonStub,
        ElCard: cardStub,
        ElDrawer: emptyStub,
        ElEmpty: emptyStub,
        ElForm: passthrough,
        ElFormItem: passthrough,
        ElInput: emptyStub,
        ElOption: emptyStub,
        ElPagination: emptyStub,
        ElSelect: selectStub,
        ElTabPane: passthrough,
        ElTabs: passthrough,
        ElTable: passthrough,
        ElTableColumn: emptyStub,
        ElTag: passthrough,
      },
    },
  })
}

describe('CRM 主数据页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBusinessDictionariesForTest()
    seedBusinessDictionaryForTest('CRM', 'DHB_CUSTOMER_STATUS', [{
      code: 'A', name: '待激活', value: 'A', status: 'ACTIVE', sortNo: 10,
    }])
    seedBusinessDictionaryForTest('CRM', 'DHB_CUSTOMER_CLEARING_FORM', [{
      code: 'FORWARD', name: '现付', value: 'forward', status: 'ACTIVE', sortNo: 10,
    }])
    routeMeta.routeKey = 'supply.crm.customers.profiles'
    crmApi.getCrmCustomers.mockResolvedValue({
      total: 1,
      begin: 0,
      step: 20,
      items: [{
        id: 'customer-1', code: 'C001', name: '测试客户', internalStatus: 'ACTIVE',
        account: 'customer', typeName: '经销商', areaName: '上海', contactName: '张三',
        phone: '13800000000', staffName: '销售甲', sourceUpdatedAt: null,
        syncedAt: '2026-08-13T04:00:00Z', sourcePresence: 'PRESENT', sourceStatus: 'T',
      }],
    })
    crmApi.syncCrmData.mockResolvedValue({
      batchId: 'batch-1',
      status: 'SUCCEEDED',
      objects: [{
        runId: 'run-1', objectType: 'CUSTOMER', status: 'SUCCEEDED', fetched: 1,
        created: 1, changed: 0, repaired: 0, duplicates: 0, absent: 0,
        rejected: 0, pages: 1, finishedAt: '2026-08-13T04:00:00Z',
      }],
    })
    crmApi.getCrmCustomerTypes.mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] })
    crmApi.getCrmShippingAddresses.mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] })
    crmApi.getCrmCustomerAreas.mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] })
  })

  it('客户档案页面加载客户，并把 CUSTOMER 作为当前页面同步参数', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(crmApi.getCrmCustomers).toHaveBeenCalledWith({
      begin: 0,
      step: 20,
      q: undefined,
      status: undefined,
    })

    await wrapper.findAll('button').find((button) => button.text() === '同步客户档案')!.trigger('click')
    await flushPromises()

    expect(crmApi.syncCrmData).toHaveBeenCalledWith('CUSTOMER')
    expect(messages.success).toHaveBeenCalledWith(
      '同步完成：1 类，获取 1 条，新增 1 条，变更 0 条，修复 0 条，拒绝 0 条',
    )
    expect(crmApi.getCrmCustomers).toHaveBeenCalledTimes(2)
  })

  it('客户等级菜单加载客户类型，并把 CUSTOMER_TYPE 作为同步参数', async () => {
    routeMeta.routeKey = 'supply.crm.customers.levels-tags'
    const wrapper = mountPage()
    await flushPromises()

    expect(crmApi.getCrmCustomerTypes).toHaveBeenCalledWith({
      begin: 0,
      step: 20,
      q: undefined,
    })

    await wrapper.findAll('button').find((button) => button.text() === '同步客户类型')!.trigger('click')
    await flushPromises()

    expect(crmApi.syncCrmData).toHaveBeenCalledWith('CUSTOMER_TYPE')
  })

  it('收货地址簿单独加载地址，并把 ADDRESS 作为全量同步参数', async () => {
    routeMeta.routeKey = 'supply.crm.customers.shipping-addresses'
    const wrapper = mountPage()
    await flushPromises()

    expect(crmApi.getCrmShippingAddresses).toHaveBeenCalledWith({
      begin: 0,
      step: 20,
      q: undefined,
    })

    await wrapper.findAll('button').find((button) => button.text() === '同步全部收货地址')!.trigger('click')
    await flushPromises()

    expect(crmApi.syncCrmData).toHaveBeenCalledWith('ADDRESS')
  })

  it('归属地区按省市层级展示，并为未识别地区保留未归类节点', async () => {
    routeMeta.routeKey = 'supply.crm.customers.areas'
    crmApi.getCrmCustomerAreas.mockResolvedValue({
      total: 5,
      begin: 0,
      step: 200,
      items: [
        { id: 'area-gd', code: '44084', name: '广东省', status: 'ACTIVE', syncedAt: null },
        { id: 'area-gz', code: '44094', name: '广州市', status: 'ACTIVE', syncedAt: null },
        { id: 'area-dg', code: '44093', name: '东莞市', status: 'ACTIVE', syncedAt: null },
        { id: 'area-national', code: '44076', name: '全国', status: 'ACTIVE', syncedAt: null },
        { id: 'area-custom', code: 'custom', name: '默认地区', status: 'ACTIVE', syncedAt: null },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()

    expect(crmApi.getCrmCustomerAreas).toHaveBeenCalledWith({ begin: 0, step: 200, q: undefined })
    expect(wrapper.text()).toContain('广东省')
    expect(wrapper.text()).toContain('2 个市级地区')
    expect(wrapper.text()).toContain('广州市')
    expect(wrapper.text()).toContain('未归类地区')

    const state = wrapper.vm as unknown as { areaTree: Array<{ name: string; children: Array<{ name: string }> }> }
    const guangdong = state.areaTree.find((item) => item.name === '广东省')
    expect(guangdong?.children.map((item) => item.name)).toEqual(['东莞市', '广州市'])
  })

  it('优先使用 CRM 查询接口返回的父级 ID 构建地区树', async () => {
    routeMeta.routeKey = 'supply.crm.customers.areas'
    crmApi.getCrmCustomerAreas.mockResolvedValue({
      total: 2,
      begin: 0,
      step: 200,
      items: [
        { id: 'area-province', code: 'P-1', name: '华东', status: 'ACTIVE', syncedAt: null, parentId: null, parentCode: null },
        { id: 'area-city', code: 'C-1', name: '上海市', status: 'ACTIVE', syncedAt: null, parentId: 'area-province', parentCode: 'P-1' },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()

    const state = wrapper.vm as unknown as { areaTree: Array<{ name: string; children: Array<{ name: string }> }> }
    const parent = state.areaTree.find((item) => item.name === '华东')
    expect(parent?.children.map((item) => item.name)).toEqual(['上海市'])
  })

  it('同步冲突时提示已有任务运行，并允许用户稍后刷新数据', async () => {
    routeMeta.routeKey = 'supply.crm.customers.profiles'
    crmApi.syncCrmData.mockRejectedValueOnce({
      code: 'CONFLICT',
      message: '相同租户、连接器和数据类型已有同步任务运行中',
    })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '同步客户档案')!.trigger('click')
    await flushPromises()

    expect(messages.warning).toHaveBeenCalledWith('当前客户档案已有同步任务运行中，请稍后重试')
    expect(messages.error).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('可能是定时同步或其他页面发起的任务')
  })

  it('订货宝状态和结算方式只展示中文描述', () => {
    const wrapper = mountPage()
    const labels = wrapper.vm as unknown as {
      sourceStatusLabel: (status: string) => string
      settlementLabel: (mode: string) => string
    }

    expect(labels.sourceStatusLabel('A')).toBe('待激活')
    expect(labels.settlementLabel('forward')).toBe('现付')
    expect(labels.settlementLabel('forward')).not.toContain('forward')
  })

  it('客户详情使用接口返回的收货地址数据', async () => {
    crmApi.getCrmCustomer.mockResolvedValue({
      id: 'customer-1', code: 'C001', name: '测试客户', internalStatus: 'ACTIVE',
      account: 'customer', typeName: '经销商', areaName: '上海', city: '上海', inviter: null,
      remark: null, contactName: '张三', phone: '13800000000', email: null, address: null,
      settlementMode: 'forward', staffName: '销售甲', salesAssignments: [], sourceStatus: 'T',
      sourceCreatedAt: null, sourceUpdatedAt: null, syncedAt: null, sourcePresence: 'PRESENT',
      shippingAddresses: [{
        id: 'address-1', consignee: '收货人', contact: '收货人', phone: '13900000000',
        regionText: '上海市', areaName: '浦东新区', addressDetail: '世纪大道1号',
        fullAddress: '上海市浦东新区世纪大道1号', defaultAddress: true,
        sourceUpdatedAt: null, sourceFields: {},
      }],
      sourceFields: {},
      source: { clientGuid: 'client-1', typeId: null, areaId: null, areaGuid: null,
        statusCode: 'T', clearingFormCode: 'forward' },
    })
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as unknown as { openCustomerDetailById: (id: string) => Promise<void> })
      .openCustomerDetailById('customer-1')
    await flushPromises()

    const state = wrapper.vm as unknown as { selectedCustomer: { shippingAddresses: unknown[] } }
    expect(crmApi.getCrmCustomer).toHaveBeenCalledWith('customer-1')
    expect(state.selectedCustomer.shippingAddresses).toHaveLength(1)
  })
})
