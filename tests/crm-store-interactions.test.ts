import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import CrmStorePoolView from '@/views/supply-chain/crm/CrmStorePoolView.vue'
import CrmStoreLeadReview from '@/views/supply-chain/crm/CrmStoreLeadReview.vue'
import CrmStoreIntake from '@/views/supply-chain/crm/CrmStoreIntake.vue'
import CrmStoreEditor from '@/views/supply-chain/crm/CrmStoreEditor.vue'
import CrmStoreMap from '@/views/supply-chain/crm/CrmStoreMap.vue'
import {
  crmStoreApi,
  type StoreRow,
  type StoreMapResult,
  type StoreLead,
} from '@/api/core/crm-store'
import { loadStoreMapSdk, storeMapPositions, type StoreMapSdk } from '@/utils/crm-store-map'
import { sampleStore, sampleStores, storeContext } from './fixtures/crm-stores'
import { auditActorLabel } from '@/utils/audit-actor'

vi.mock('@/utils/audit-actor', () => ({
  auditActorLabel: vi.fn((value: string) => (value ? '测试姓名' : '未记录')),
}))

vi.mock('@/api/core/crm-store', () => ({
  crmStoreApi: {
    context: vi.fn(),
    maintenanceContext: vi.fn(),
    intakeContext: vi.fn(),
    leads: vi.fn(),
    list: vi.fn(),
    map: vi.fn(),
    mapStores: vi.fn(),
    detail: vi.fn(),
    visits: vi.fn(),
    reviewVisit: vi.fn(),
  },
}))
vi.mock('@/api/core/business-settings', () => ({
  getEffectiveBizDict: vi.fn().mockResolvedValue({ items: [] }),
  resolveBizDict: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('@/utils/crm-store-map', async (original) => ({
  ...(await original<typeof import('@/utils/crm-store-map')>()),
  loadStoreMapSdk: vi.fn(),
}))
const map = {
  add: vi.fn(),
  remove: vi.fn(),
  clearMap: vi.fn(),
  setFitView: vi.fn(),
  setBounds: vi.fn(),
  getZoom: vi.fn().mockReturnValue(4),
  getBounds: vi.fn().mockReturnValue({
    getSouthWest: () => ({ getLng: () => 120, getLat: () => 30 }),
    getNorthEast: () => ({ getLng: () => 121, getLat: () => 31 }),
  }),
  on: vi.fn(),
  off: vi.fn(),
  setZoomAndCenter: vi.fn(),
  destroy: vi.fn(),
}
let markerOptions: Record<string, unknown>[] = []
let districtOptions: { kind: string; options: Record<string, unknown> }[] = []
const sdk: StoreMapSdk = {
  plugin: vi.fn(),
  DistrictLayer: {
    Country: class {
      constructor(options: Record<string, unknown>) {
        districtOptions.push({ kind: 'Country', options })
      }
      setzIndex() {}
    },
    Province: class {
      constructor(options: Record<string, unknown>) {
        districtOptions.push({ kind: 'Province', options })
      }
      setzIndex() {}
    },
  },
  Map: class {
    constructor() {
      return map
    }
  } as unknown as StoreMapSdk['Map'],
  Marker: class {
    constructor(options: Record<string, unknown>) {
      markerOptions.push(options)
    }
    setzIndex() {}
  },
  convertFrom: vi.fn(),
}
function mapResult(rows: StoreRow[], total = rows.length): StoreMapResult {
  const located = rows.filter((row) => row.longitude != null && row.latitude != null)
  return {
    total,
    level: 'STORE',
    located: total - (rows.length - located.length),
    visible: total - (rows.length - located.length),
    bounds: { west: 120, east: 121, south: 30, north: 31 },
    points: located.map((row) => ({
      id: `point:${row.id}`,
      areaCode: null,
      areaLevel: null,
      storeId: row.id,
      name: row.name,
      longitude: row.longitude!,
      latitude: row.latitude!,
      coordinateSystem: row.coordinateSystem!,
      count: 1,
      privateCount: row.poolType === 'PRIVATE' ? 1 : 0,
      cooperatedCount: row.cooperationStatus === 'COOPERATED' ? 1 : 0,
      bounds: {
        west: row.longitude!,
        east: row.longitude!,
        south: row.latitude!,
        north: row.latitude!,
      },
    })),
  }
}
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  markerOptions = []
  districtOptions = []
  vi.mocked(loadStoreMapSdk).mockResolvedValue(sdk)
  vi.mocked(crmStoreApi.context).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.maintenanceContext).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.intakeContext).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.leads).mockResolvedValue({ total: 0, items: [], page: 1, size: 20 })
  vi.mocked(crmStoreApi.list).mockResolvedValue({
    total: 84,
    items: sampleStores,
    nextCursor: 'TEST-100',
  })
  vi.mocked(crmStoreApi.detail).mockResolvedValue(sampleStore)
  vi.mocked(crmStoreApi.map).mockResolvedValue(mapResult(sampleStores, 170099))
  map.getZoom.mockReturnValue(4)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})
async function mountPage(path = 'public') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: CrmStorePoolView }],
  })
  await router.push('/supply-chain/crm/stores/' + path)
  await router.isReady()
  wrapper = mount(CrmStorePoolView, {
    attachTo: document.body,
    global: { plugins: [router, ElementPlus] },
  })
  await flushPromises()
  return wrapper
}
async function display(mode: 'list' | 'map') {
  await wrapper!.get(`input[type="radio"][value="${mode}"]`).setValue(true)
  await flushPromises()
}
describe('门店列表、详情和地图的真实组件交互', () => {
  it.each(['public', 'library', 'mine', 'cooperated', 'leads'])(
    '新增入口仅公海和商家库显示：%s',
    async (page) => {
      await mountPage(page)
      const visible = wrapper!.findAll('button').some((button) => button.text() === '新增门店')
      expect(visible).toBe(['public', 'library'].includes(page))
    },
  )
  it('本人私海可维护经营状态，停业时不再提示发起新拜访', async () => {
    const row = {
      ...sampleStore,
      poolType: 'PRIVATE',
      ownerEmployeeId: storeContext.employeeId,
      businessStatus: 'TEMP_CLOSED',
      businessStatusReason: '装修暂停',
    }
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:pool:private-read', 'crm:store:status-write', 'crm:store:visit-write'],
    })
    vi.mocked(crmStoreApi.list).mockResolvedValue({ total: 1, items: [row], nextCursor: null })
    vi.mocked(crmStoreApi.detail).mockResolvedValue(row)
    await mountPage('mine')
    expect(wrapper!.findAll('button').some((button) => button.text() === '经营状态')).toBe(true)
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === row.name)!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('暂停新拜访和开单')
    expect(document.body.textContent).not.toContain('到店拜访请从销售工作台')
  })
  it('无经营状态维护权限的本人私海不展示维护按钮', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:pool:private-read'],
    })
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 1,
      items: [{ ...sampleStore, poolType: 'PRIVATE', ownerEmployeeId: storeContext.employeeId }],
      nextCursor: null,
    })
    await mountPage('mine')
    expect(wrapper!.findAll('button').some((button) => button.text() === '经营状态')).toBe(false)
  })
  it('商家库只读人员可以看详情，不能维护或认领', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:store:library-read', 'crm:pool:claim'],
    })
    await mountPage('library')
    expect(wrapper!.findAll('button').some((b) => b.text() === '维护')).toBe(false)
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === sampleStore.name)!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).not.toContain('维护资料')
    expect(document.body.textContent).not.toContain('认领到我的客户')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('基本资料')
  })
  it('维护直接打开编辑弹窗，保存后回到列表，不隐式弹出详情', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:store:library-read', 'crm:store:manage', 'crm:pool:claim'],
    })
    await mountPage('library')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '维护')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.findComponent(CrmStoreEditor).exists()).toBe(true)
    expect(wrapper!.findComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(false)
    expect(document.querySelector('.store-editor-dialog')?.textContent).toContain('维护门店资料')
    expect(document.body.textContent).not.toContain('认领到我的客户')
    expect(crmStoreApi.detail).not.toHaveBeenCalled()
    wrapper!.findComponent(CrmStoreEditor).vm.$emit('saved', sampleStore.id)
    await flushPromises()
    expect(wrapper!.findComponent(CrmStoreEditor).exists()).toBe(false)
    expect(wrapper!.findComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(false)
    expect(crmStoreApi.detail).not.toHaveBeenCalled()
    expect(crmStoreApi.list).toHaveBeenCalledTimes(2)
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === sampleStore.name)!
      .trigger('click')
    await flushPromises()
    const detailMaintenance = [...document.querySelectorAll('.el-drawer__footer button')].find(
      (button) => button.textContent?.trim() === '维护资料',
    ) as HTMLButtonElement
    detailMaintenance.click()
    await flushPromises()
    expect(wrapper!.findComponent(CrmStoreEditor).props('store').id).toBe(sampleStore.id)
  })
  it.each(['public', 'cooperated'])('认领只在公海展示：%s', async (path) => {
    await mountPage(path)
    expect(wrapper!.findAll('button').some((b) => b.text() === '认领')).toBe(path === 'public')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === sampleStore.name)!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent!.includes('认领到我的客户')).toBe(path === 'public')
    expect(document.body.textContent).not.toContain('维护资料')
  })
  it('商家库展示管理范围、档案状态和维护入口，不复制公海认领列表', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:store:manage', 'crm:pool:claim'],
    })
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 1,
      items: [{ ...sampleStore, recordStatus: 'SUSPENDED' }],
      nextCursor: null,
    })
    await mountPage('library')
    expect(crmStoreApi.list).toHaveBeenCalledWith(expect.objectContaining({ view: 'ALL' }))
    expect(wrapper!.text()).toContain('公司门店总账')
    expect(wrapper!.text()).toContain('已停用')
    expect(wrapper!.findAll('button').some((b) => b.text() === '维护')).toBe(true)
    expect(wrapper!.findAll('button').some((b) => b.text() === '认领')).toBe(false)
    const pool = wrapper!
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '客户池')!
    const status = wrapper!
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '档案状态')!
    pool.vm.$emit('update:modelValue', 'PRIVATE')
    status.vm.$emit('update:modelValue', 'SUSPENDED')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '查询')!
      .trigger('click')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'ALL', pool: 'PRIVATE', recordStatus: 'SUSPENDED' }),
    )
  })
  it('商家库分开客户池和负责人，完整展示基础资料，审计姓名在时间前且不暴露账号ID', async () => {
    const actorId = '11111111-1111-4111-8111-111111111111'
    const privateRow = {
      ...sampleStore,
      poolType: 'PRIVATE',
      ownerEmployeeId: 'OTHER',
      ownerName: 'EMP001',
      primaryPoi: 'B0TESTPOI',
      updatedBy: actorId,
      createdBy: actorId,
    }
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 2,
      items: [privateRow, { ...sampleStore, id: 'TEST-PUBLIC' }],
      nextCursor: null,
    })
    vi.mocked(crmStoreApi.detail).mockResolvedValue(privateRow)
    await mountPage('library')
    const headers = wrapper!.findAll('th').map((c) => c.text())
    for (const title of [
      'POI',
      '省份',
      '市',
      '区县',
      '地址',
      '客户池',
      '负责人',
      '修改人',
      '修改时间',
    ])
      expect(headers).toContain(title)
    expect(headers).not.toContain('当前归属')
    expect(headers).not.toContain('修改时间 / 修改人')
    expect(headers.indexOf('修改人')).toBeLessThan(headers.indexOf('修改时间'))
    expect(wrapper!.text()).toContain('私海')
    expect(wrapper!.text()).toContain('未分配')
    expect(wrapper!.text()).toContain('测试姓名')
    expect(wrapper!.text()).not.toContain(actorId)
    expect(vi.mocked(auditActorLabel)).toHaveBeenCalledWith(actorId)
    expect(vi.mocked(auditActorLabel)).toHaveBeenCalledWith('EMP001')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === sampleStore.name)!
      .trigger('click')
    await flushPromises()
    const detail = document.querySelector('[role="dialog"]')!
    const labels = [...detail.querySelectorAll('.el-descriptions__label')].map((c) =>
      c.textContent?.trim(),
    )
    expect(labels.indexOf('创建人')).toBeLessThan(labels.indexOf('创建时间'))
    expect(labels.indexOf('修改人')).toBeLessThan(labels.indexOf('修改时间'))
    expect(detail.textContent).not.toContain(actorId)
  })
  it('私海默认展示跟进信息，筛选随团队范围传递，暂缓核验不显示到期回收', async () => {
    const row = {
      ...sampleStore,
      poolType: 'PRIVATE',
      phase: 'FOLLOW_UP',
      validVisitCount: 4,
      currentOwnershipId: '10',
      ownerEmployeeId: storeContext.employeeId,
      deadlineAt: '2020-01-01T00:00:00Z',
      holdReason: 'PENDING_REVIEW',
    }
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:pool:private-read', 'crm:pool:team-read', 'crm:pool:release'],
    })
    vi.mocked(crmStoreApi.list).mockResolvedValue({ total: 1, items: [row], nextCursor: null })
    vi.mocked(crmStoreApi.detail).mockResolvedValue(row)
    await mountPage('mine')
    expect(wrapper!.findAll('th').map((c) => c.text())).toContain('最近有效拜访')
    expect(wrapper!.findAll('th').map((c) => c.text())).not.toContain('最近成交')
    expect(wrapper!.findAll('th').map((c) => c.text())).not.toContain('负责人')
    expect(wrapper!.text()).toContain('累计有效')
    expect(wrapper!.text()).toContain('暂缓回收 · 核验中')
    const phase = wrapper!
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '跟进阶段')!
    phase.vm.$emit('update:modelValue', 'FOLLOW_UP')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '查询')!
      .trigger('click')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'MINE', phase: 'FOLLOW_UP' }),
    )
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '跟进')!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('有效拜访后延续 7 天跟进期')
    await wrapper!.get('input[type="radio"][value="true"]').setValue(true)
    await flushPromises()
    expect(crmStoreApi.context).toHaveBeenLastCalledWith('TEAM')
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'TEAM', phase: 'FOLLOW_UP' }),
    )
    expect(wrapper!.text()).toContain('团队客户')
  })
  it('合作客户展示合作事实、价值和活跃度，按归属提供跳转，不直接新增认领或维护', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: [
        'crm:pool:cooperated-read',
        'crm:pool:private-read',
        'crm:pool:public-read',
        'crm:store:library-read',
        'crm:store:manage',
        'crm:pool:claim',
        'crm:lead:create',
      ],
    })
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 3,
      nextCursor: null,
      items: [
        {
          ...sampleStore,
          id: 'own',
          poolType: 'PRIVATE',
          ownerEmployeeId: storeContext.employeeId,
        },
        { ...sampleStore, id: 'public' },
        { ...sampleStore, id: 'closed', businessStatus: 'CLOSED' },
      ],
    })
    await mountPage('cooperated')
    const headers = wrapper!.findAll('th').map((c) => c.text())
    for (const label of [
      '客户价值',
      '交易活跃度',
      '首次合作',
      '最近成交',
      '负责人',
      '客户池',
      '经营状态',
    ])
      expect(headers).toContain(label)
    for (const label of ['POI', '修改时间', '保护期限']) expect(headers).not.toContain(label)
    const actions = wrapper!.findAll('button').map((b) => b.text())
    expect(actions.filter((label) => label === '去跟进')).toHaveLength(1)
    expect(actions.filter((label) => label === '去公海')).toHaveLength(1)
    expect(actions.filter((label) => label === '商家档案')).toHaveLength(3)
    for (const label of ['新增门店', '认领', '维护', '经营状态'])
      expect(actions).not.toContain(label)
    expect(wrapper!.text()).toContain('2026-05-01')
    expect(wrapper!.text()).toContain('停止作业')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '去跟进')!
      .trigger('click')
    await flushPromises()
    expect(crmStoreApi.context).toHaveBeenLastCalledWith('MINE')
    expect(crmStoreApi.detail).toHaveBeenLastCalledWith('own', 'MINE')
  })
  it('仅合作查询权限不显示超出授权的跳转操作', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:pool:cooperated-read'],
    })
    await mountPage('cooperated')
    expect(wrapper!.findAll('th').map((c) => c.text())).not.toContain('操作')
  })
  it('门店提报按服务端分页和状态查询，点击名称只读查看完整事实，退回可修改重提', async () => {
    const lead: StoreLead = {
      id: 'lead-1',
      name: '待补充台球厅',
      areaCode: '330105',
      address: '湖墅路1号',
      longitude: 120.1,
      latitude: 30.2,
      coordinateSystem: 'GCJ02',
      publicPhone: '057100000000',
      storeTypeCode: 'POI_080113',
      revision: 1,
      status: 'REJECTED',
      submittedAt: '2026-11-01T00:00:00Z',
      submitterUserId: '11111111-1111-4111-8111-111111111111',
      reviewerUserId: null,
      reviewedAt: '2026-11-02T00:00:00Z',
      reviewReason: '请核对门头',
      resultStoreId: null,
    }
    vi.mocked(crmStoreApi.leads).mockResolvedValue({ total: 130, items: [lead], page: 1, size: 20 })
    await mountPage('leads')
    expect(crmStoreApi.leads).toHaveBeenCalledWith({
      review: false,
      page: 1,
      size: 20,
      keyword: undefined,
      status: undefined,
    })
    const headers = wrapper!.findAll('th').map((c) => c.text())
    for (const label of [
      '门店名称',
      '地区 / 地址',
      '来源',
      '审核状态',
      '提交时间',
      '审核时间',
      '审核意见',
      '入库结果',
    ])
      expect(headers).toContain(label)
    expect(wrapper!.text()).not.toContain('最近 100 条')
    expect(wrapper!.text()).toContain('手动提报')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === lead.name)!
      .trigger('click')
    await flushPromises()
    const detail = wrapper!.findComponent(CrmStoreLeadReview)
    expect(detail.props('readOnly')).toBe(true)
    expect(document.body.textContent).toContain('057100000000')
    expect(document.body.textContent).toContain('请核对门头')
    expect(document.body.textContent).not.toContain('审核通过')
    detail.vm.$emit('close')
    await flushPromises()
    const pagination = wrapper!.findComponent({ name: 'ElPagination' })
    expect(pagination.props('total')).toBe(130)
    pagination.vm.$emit('update:current-page', 2)
    pagination.vm.$emit('current-change', 2)
    await flushPromises()
    expect(crmStoreApi.leads).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, size: 20 }),
    )
    await wrapper!.get('input[aria-label="提报门店名称或地址"]').setValue('台球')
    wrapper!
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '提报审核状态')!
      .vm.$emit('update:modelValue', 'REJECTED')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '查询')!
      .trigger('click')
    await flushPromises()
    expect(crmStoreApi.leads).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, keyword: '台球', status: 'REJECTED' }),
    )
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '修改重提')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.findComponent(CrmStoreIntake).props('lead')?.id).toBe(lead.id)
  })
  it('提报接口契约不匹配时保留可用空表，不让旧响应破坏页面', async () => {
    vi.mocked(crmStoreApi.leads).mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof crmStoreApi.leads>>,
    )
    await mountPage('leads')
    expect(wrapper!.text()).toContain('接口版本不匹配')
    expect(wrapper!.findComponent({ name: 'ElTable' }).props('data')).toEqual([])
    expect(wrapper!.findComponent({ name: 'ElPagination' }).props('total')).toBe(0)
  })
  it('待我审核固定待审范围，审核按钮先打开完整资料和查重表单', async () => {
    const lead: StoreLead = {
      id: 'lead-2',
      name: '待审核台球厅',
      areaCode: '330105',
      address: '湖墅路2号',
      longitude: 120.1,
      latitude: 30.2,
      coordinateSystem: 'GCJ02',
      publicPhone: null,
      storeTypeCode: 'POI_080113',
      revision: 1,
      status: 'PENDING_REVIEW',
      submittedAt: '2026-11-01T00:00:00Z',
      submitterUserId: '11111111-1111-4111-8111-111111111111',
      reviewerUserId: null,
      reviewedAt: null,
      reviewReason: null,
      resultStoreId: null,
    }
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: ['crm:lead:read', 'crm:lead:review'],
    })
    vi.mocked(crmStoreApi.leads).mockResolvedValue({ total: 1, items: [lead], page: 1, size: 20 })
    await mountPage('leads')
    await wrapper!.get('input[type="radio"][value="true"]').setValue(true)
    await flushPromises()
    expect(crmStoreApi.leads).toHaveBeenLastCalledWith(
      expect.objectContaining({ review: true, page: 1, status: undefined }),
    )
    expect(
      wrapper!
        .findAllComponents({ name: 'ElSelect' })
        .some((c) => c.props('ariaLabel') === '提报审核状态'),
    ).toBe(false)
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '审核')!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('湖墅路2号')
    expect(document.body.textContent).toContain('测试姓名')
    expect(document.body.textContent).not.toContain('11111111-1111-4111-8111-111111111111')
    expect(wrapper!.findAll('th').map((c) => c.text())).toContain('提报人')
    expect(document.body.textContent).toContain('关联已有门店')
    expect(wrapper!.findComponent(CrmStoreLeadReview).props('readOnly')).not.toBe(true)
  })
  it('省级显示名称、数量和层级，单店区域仍按地区下钻', async () => {
    const data = mapResult([sampleStore])
    data.level = 'PROVINCE'
    data.points[0] = {
      ...data.points[0],
      storeId: null,
      name: '浙江省',
      areaCode: '330000',
      areaLevel: 'PROVINCE',
    }
    vi.mocked(crmStoreApi.map).mockResolvedValue(data)
    wrapper = mount(CrmStoreMap, {
      props: { query: { view: 'PUBLIC', size: 20 }, focusRow: null },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    const button = (markerOptions[0].content as HTMLElement).querySelector('button')!
    expect(button.className).toContain('is-province')
    expect(button.querySelector('.area-name')?.textContent).toBe('浙江')
    expect(button.querySelector('.area-level')).toBeNull()
    expect(button.querySelector('strong')?.textContent).toBe('1')
    expect(wrapper.text()).toContain('按省汇总')
    expect(wrapper.text()).toContain('区域内完整统计')
    expect(districtOptions[0]).toMatchObject({ kind: 'Country', options: { depth: 1, SOC: 'CHN' } })
    button.click()
    expect(map.setZoomAndCenter.mock.lastCall?.[0]).toBeGreaterThanOrEqual(7)
    expect(map.setZoomAndCenter.mock.lastCall?.[0]).toBeLessThan(10)
    expect(crmStoreApi.mapStores).not.toHaveBeenCalled()
    expect(crmStoreApi.detail).not.toHaveBeenCalled()
  })
  it.each([
    ['PREFECTURE', '杭州市', '330100', 'PREFECTURE', 10, '杭州'],
    ['PREFECTURE', '恩施土家族苗族自治州', '422800', 'PREFECTURE', 10, '恩施土家族苗族自治州'],
    ['COUNTY', '拱墅区', '330105', 'COUNTY', 13, '拱墅区'],
    ['PREFECTURE', '仙桃市', '429004', 'COUNTY', 13, '仙桃'],
    ['COUNTY', '东莞市', '441900', 'PREFECTURE', 13, '东莞市'],
  ] as const)(
    '%s 显示分层样式并处理特殊行政层级 %s',
    async (level, name, code, actualLevel, zoom, displayName) => {
      const data = mapResult([sampleStore], 120)
      data.level = level
      data.points[0] = {
        ...data.points[0],
        count: 120,
        storeId: null,
        name,
        areaCode: code,
        areaLevel: actualLevel,
      }
      vi.mocked(crmStoreApi.map).mockResolvedValue(data)
      wrapper = mount(CrmStoreMap, {
        props: { query: { view: 'PUBLIC', size: 20 }, focusRow: null },
        global: { plugins: [ElementPlus] },
      })
      await flushPromises()
      const button = (markerOptions[0].content as HTMLElement).querySelector('button')!
      expect(button.className).toContain(`is-${level.toLowerCase()}`)
      expect(button.querySelector('.area-name')?.textContent).toBe(displayName)
      expect(button.getAttribute('aria-label')).toContain(`${name}，120 家门店`)
      expect(button.title).toContain(name)
      expect(button.querySelector('.area-level')).toBeNull()
      expect(districtOptions[0]).toMatchObject({
        kind: level === 'COUNTY' ? 'Province' : 'Country',
        options: { depth: 2 },
      })
      if (level === 'COUNTY')
        expect(districtOptions[0].options.adcode).toEqual([code.slice(0, 2) + '0000'])
      button.click()
      expect(map.setZoomAndCenter.mock.lastCall?.[0]).toBeGreaterThanOrEqual(zoom)
      if (zoom < 13) expect(map.setZoomAndCenter.mock.lastCall?.[0]).toBeLessThan(zoom + 3)
    },
  )
  it('新增门店的地区选择只渲染可视选项，不挂载全国所有区县', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      areas: [
        ...storeContext.areas.slice(0, 2),
        ...Array.from({ length: 250 }, (_, i) => ({
          code: String(330101 + i),
          name: `测试区县${i}`,
          level: 'COUNTY' as const,
          parentCode: '330100',
          regionCode: null,
        })),
      ],
    })
    const page = await mountPage()
    const existingOptions = document.querySelectorAll('[role="option"]').length
    await page
      .findAll('button')
      .find((b) => b.text() === '新增门店')!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('新增门店')
    expect(document.querySelectorAll('[role="option"]').length - existingOptions).toBeLessThan(40)
  })
  it('公海页签再次激活时刷新数据和权限，保留筛选且首次进入不重复请求', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: CrmStorePoolView }],
    })
    await router.push('/supply-chain/crm/stores/public')
    await router.isReady()
    const active = ref(true)
    vi.mocked(crmStoreApi.list).mockResolvedValueOnce({ total: 0, items: [], nextCursor: null })
    wrapper = mount(
      defineComponent({
        components: { CrmStorePoolView },
        setup: () => ({ active }),
        template: '<KeepAlive><CrmStorePoolView v-if="active" /></KeepAlive>',
      }),
      { attachTo: document.body, global: { plugins: [router, ElementPlus] } },
    )
    await flushPromises()
    expect(crmStoreApi.context).toHaveBeenCalledTimes(1)
    expect(crmStoreApi.list).toHaveBeenCalledTimes(1)
    await wrapper.get('input[aria-label="门店名称或地址"]').setValue('台球')
    active.value = false
    await flushPromises()
    // 在另一个页签退回门店后，公海应重新读取服务器的当前归属和本人冷却状态。
    vi.mocked(crmStoreApi.context).mockResolvedValue({ ...storeContext, scopeLabel: '杭州市' })
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 1,
      items: [{ ...sampleStore, claimBlockedReason: '认领冷却中' }],
      nextCursor: null,
    })
    active.value = true
    await flushPromises()
    expect(crmStoreApi.context).toHaveBeenCalledTimes(2)
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '台球' }))
    expect(wrapper.get('.scope-label').text()).toContain('杭州市')
    expect(wrapper.get('.store-table').text()).toContain(sampleStore.name)
    expect(wrapper.get('.claim-action').attributes('aria-label')).toContain('认领冷却中')
    expect(
      (wrapper.get('input[aria-label="门店名称或地址"]').element as HTMLInputElement).value,
    ).toBe('台球')
  })
  it('标准分页按服务端游标前后翻页，重新查询后回到第一页', async () => {
    const page = await mountPage()
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'TEST-100', size: 20 }),
    )
    expect(page.get('.page-position').text()).toBe('2 / 5')
    await page.get('.el-pagination .btn-prev').trigger('click')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: undefined }),
    )
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    await page.get('input[aria-label="门店名称或地址"]').setValue('清风')
    await page.get('form[aria-label="查询条件"]').trigger('submit')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '清风', cursor: undefined }),
    )
    expect(page.get('.page-position').text()).toBe('1 / 5')
  })
  it('空结果保留分页骨架且不能前后翻页', async () => {
    vi.mocked(crmStoreApi.list).mockResolvedValue({ total: 0, items: [], nextCursor: null })
    const page = await mountPage()
    expect(page.get('.el-pagination .btn-prev').attributes('disabled')).toBeDefined()
    expect(page.get('.el-pagination .btn-next').attributes('disabled')).toBeDefined()
    expect(page.get('.page-position').text()).toBe('1 / 1')
  })
  it('默认展示 POI 和独立地理字段，标签不挤占名称，名称打开详情', async () => {
    const page = await mountPage()
    expect(page.findAll('th').map((n) => n.text())).toEqual([
      '门店名称',
      'POI',
      '门店类型',
      '省份',
      '市',
      '区县',
      '地址',
      '门店标签',
      '经营状态',
      '操作',
    ])
    expect(page.findAll('button').some((button) => button.text() === '查看')).toBe(false)
    expect(page.get('.store-tags').text()).toContain('历史合作')
    expect(page.get('.store-tags').text()).toContain('价值 A')
    await page.get('.store-name').trigger('click')
    await flushPromises()
    expect(crmStoreApi.detail).toHaveBeenCalledWith(sampleStore.id, 'PUBLIC')
    expect(document.body.querySelector('.el-drawer')).toBeTruthy()
  })
  it('默认列可选择和恢复，POI 保持原始标识，缺少坐标不伪装为地图入口', async () => {
    vi.mocked(crmStoreApi.list).mockResolvedValue({
      total: 2,
      items: [{ ...sampleStore, primaryPoi: 'B0TEST0001' }, sampleStores[3]!],
      nextCursor: null,
    })
    const page = await mountPage()
    expect(page.get('.poi-code').text()).toBe('B0TEST0001')
    expect(page.get('.store-name').text()).toBe(sampleStore.name)
    expect(page.get('.store-address.is-unlocated').element.tagName).toBe('SPAN')
    expect(page.get('.store-address.is-unlocated').text()).toContain('位置待完善')
    const choices = page.findAllComponents({ name: 'ElCheckbox' })
    const poi = choices.find((choice) => choice.props('value') === 'poi')!
    const lastVisit = choices.find((choice) => choice.props('value') === 'lastVisit')!
    await poi.get('input').setValue(false)
    await lastVisit.get('input').setValue(true)
    expect(page.findAll('th').map((n) => n.text())).not.toContain('POI')
    expect(page.findAll('th').map((n) => n.text())).toContain('最近拜访')
    document.body.querySelector<HTMLButtonElement>('.reset-columns')!.click()
    await flushPromises()
    expect(page.findAll('th').map((n) => n.text())).toContain('POI')
    expect(page.findAll('th').map((n) => n.text())).not.toContain('最近拜访')
  })
  it('显示暂缓回收原因及前任复访编号，普通查看者没有核验按钮', async () => {
    vi.mocked(crmStoreApi.context).mockResolvedValue({
      ...storeContext,
      permissions: [...storeContext.permissions, 'crm:store:history-read'],
    })
    vi.mocked(crmStoreApi.detail).mockResolvedValue({
      ...sampleStore,
      holdReason: 'PENDING_REVIEW',
      currentOwnershipId: '300',
    })
    vi.mocked(crmStoreApi.visits).mockResolvedValue([
      {
        id: '50',
        storeId: sampleStore.id,
        ownershipId: '299',
        salespersonId: 'PREVIOUS',
        status: 'EFFECTIVE',
        visitedAt: '2026-10-21T00:00:00Z',
        submittedAt: null,
        qualifiedAt: '2026-10-21T00:00:00Z',
        resultSummary: '已了解采购需求',
        reviewReason: '证据完整',
        revision: 3,
        storeVisitNo: 2,
        employeeVisitNo: 1,
        ownershipVisitNo: 1,
        visitType: 'REVISIT',
      },
    ])
    const page = await mountPage()
    await page.get('.store-name').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('拜访待核验，暂缓回收')
    const tab = document.body.querySelector<HTMLElement>('#tab-visits')!
    tab.click()
    await flushPromises()
    expect(crmStoreApi.visits).toHaveBeenCalledWith(sampleStore.id, 'PUBLIC')
    expect(document.body.textContent).toContain('复访 · 第 2 次')
    expect(document.body.textContent).toContain('PREVIOUS')
    expect(document.body.textContent).not.toContain('撤销有效性')
  })
  it('定位在页面内切到地图并聚焦原始自有坐标；切回列表保留筛选和数据', async () => {
    const page = await mountPage()
    await page.get('input[aria-label="门店名称或地址"]').setValue('台球')
    await page.get('button.store-address').trigger('click')
    await flushPromises()
    expect(page.find('.store-map-view').exists()).toBe(true)
    expect(map.setZoomAndCenter).toHaveBeenCalledWith(16, [
      sampleStore.longitude,
      sampleStore.latitude,
    ])
    expect(page.get('.map-store-name').text()).toBe(sampleStore.name)
    expect(map.add.mock.lastCall?.[0]).toHaveLength(3)
    expect(page.text()).toContain('170,099')
    expect(page.find('.el-pagination').exists()).toBe(false)
    expect(page.text()).toContain('1 家位置待完善')
    await display('list')
    expect((page.get('input[aria-label="门店名称或地址"]').element as HTMLInputElement).value).toBe(
      '台球',
    )
    expect(page.find('.store-table').exists()).toBe(true)
    expect(map.destroy).toHaveBeenCalledOnce()
    expect(crmStoreApi.list).toHaveBeenCalledTimes(2)
  })
  it('地图使用独立全量聚合接口，点击图钉选店再点名称打开详情', async () => {
    const page = await mountPage()
    await display('map')
    expect(map.setZoomAndCenter).toHaveBeenCalled()
    expect(crmStoreApi.map).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'PUBLIC', cursor: undefined }),
      expect.any(AbortSignal),
    )
    ;(markerOptions[0].content as HTMLButtonElement).click()
    await flushPromises()
    await page.get('.map-store-name').trigger('click')
    expect(crmStoreApi.detail).toHaveBeenCalledWith(sampleStore.id, 'PUBLIC')
  })
  it('公海/私海与合作历史独立编码，选中不覆盖状态且名称不注入图标', async () => {
    const variants = [
      { id: 'public-new', poolType: 'PUBLIC', cooperationStatus: 'NEVER' },
      { id: 'private-new', poolType: 'PRIVATE', cooperationStatus: 'NEVER' },
      { id: 'public-cooperated', poolType: 'PUBLIC', cooperationStatus: 'COOPERATED' },
      { id: 'private-cooperated', poolType: 'PRIVATE', cooperationStatus: 'COOPERATED' },
    ]
    vi.mocked(crmStoreApi.map).mockResolvedValue(
      mapResult(variants.map((v) => ({ ...sampleStore, ...v, name: '<img src=x>测试门店' }))),
    )
    wrapper = mount(CrmStoreMap, {
      props: { query: { view: 'PUBLIC', size: 20 }, focusRow: null },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    const buttons = markerOptions.map((option) => option.content as HTMLButtonElement)
    expect(buttons.map((button) => button.classList.contains('is-private'))).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect(buttons.map((button) => !!button.querySelector('.marker-cooperated'))).toEqual([
      false,
      false,
      true,
      true,
    ])
    expect(buttons[2].getAttribute('aria-label')).toContain('公海 · 已合作')
    expect(buttons[3].getAttribute('aria-label')).toContain('私海 · 已合作')
    expect(buttons.every((button) => !button.querySelector('img'))).toBe(true)
    expect(buttons.every((button) => button.textContent?.trim() === '')).toBe(true)
    await wrapper.setProps({ focusRow: { ...sampleStore, ...variants[3] } })
    await flushPromises()
    const selected = markerOptions.at(-1)!.content as HTMLButtonElement
    expect(selected.classList.contains('is-private')).toBe(true)
    expect(selected.classList.contains('is-selected')).toBe(true)
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(selected.querySelector('.marker-cooperated')).toBeTruthy()
    expect(wrapper.get('.map-tags').text()).toContain('私海')
    await wrapper.setProps({ focusRow: null })
    await flushPromises()
    expect(wrapper.find('.map-store-card').exists()).toBe(false)
  })
  it('全国数量聚合覆盖全部门店，不依赖列表条数或游标，放大聚合继续查询', async () => {
    const data = mapResult([sampleStore], 170099)
    data.points[0] = {
      ...data.points[0],
      count: 170099,
      storeId: null,
      name: null,
      bounds: { west: 75, east: 135, south: 20, north: 50 },
    }
    vi.mocked(crmStoreApi.map).mockResolvedValue(data)
    const page = await mountPage()
    await page.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    await display('map')
    expect(page.find('.el-pagination').exists()).toBe(false)
    expect(page.text()).toContain('170,099')
    const button = markerOptions[0].content as HTMLButtonElement
    expect(button.textContent).toBe('170,099')
    expect(crmStoreApi.map).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: undefined }),
      expect.any(AbortSignal),
    )
    button.click()
    expect(map.setZoomAndCenter).toHaveBeenLastCalledWith(6, [
      sampleStore.longitude,
      sampleStore.latitude,
    ])
  })
  it('门店类型查询在列表和地图一致，未提交的输入不会影响拖动查询', async () => {
    const page = await mountPage()
    await page.findComponent({ name: 'ElCascader' }).vm.$emit('update:modelValue', 'POI_L1_08')
    await page.get('form[aria-label="查询条件"]').trigger('submit')
    await flushPromises()
    expect(crmStoreApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeType: 'POI_L1_08' }),
    )
    await display('map')
    expect(crmStoreApi.map).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeType: 'POI_L1_08' }),
      expect.any(AbortSignal),
    )
    await page.get('input[aria-label="门店名称或地址"]').setValue('未提交')
    vi.useFakeTimers()
    const move = map.on.mock.calls.find(([event]) => event === 'moveend')![1] as () => void
    const zoom = map.on.mock.calls.find(([event]) => event === 'zoomend')![1] as () => void
    const before = vi.mocked(crmStoreApi.map).mock.calls.length
    move()
    zoom()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(crmStoreApi.map).toHaveBeenCalledTimes(before + 1)
    expect(crmStoreApi.map).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyword: '',
        storeType: 'POI_L1_08',
        west: 120,
        east: 121,
        south: 30,
        north: 31,
      }),
      expect.any(AbortSignal),
    )
    vi.useRealTimers()
  })
  it('同一位置多家门店可逐家查看，成员查询仍携带当前视图和分类', async () => {
    const data = mapResult([sampleStore])
    data.total = data.located = data.visible = 2
    data.points[0] = { ...data.points[0], count: 2, storeId: null }
    vi.mocked(crmStoreApi.map).mockResolvedValue(data)
    vi.mocked(crmStoreApi.mapStores).mockResolvedValue({
      total: 2,
      items: sampleStores.slice(0, 2),
      nextCursor: null,
    })
    wrapper = mount(CrmStoreMap, {
      props: { query: { view: 'PUBLIC', size: 20, storeType: 'POI_L1_08' }, focusRow: null },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    ;(markerOptions[0].content as HTMLButtonElement).click()
    await flushPromises()
    expect(crmStoreApi.mapStores).toHaveBeenCalledWith(
      expect.objectContaining({
        view: 'PUBLIC',
        storeType: 'POI_L1_08',
        coordinateSystem: 'GCJ02',
        west: sampleStore.longitude,
      }),
    )
    expect(wrapper.findAll('.cluster-store-row')).toHaveLength(2)
    await wrapper.get('.cluster-store-row').trigger('click')
    await flushPromises()
    expect(wrapper.get('.map-store-name').text()).toBe(sampleStore.name)
  })
  it('晚到的旧筛选结果不会覆盖新筛选，销毁时取消地图请求', async () => {
    let finish!: (data: StoreMapResult) => void
    vi.mocked(crmStoreApi.map).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    wrapper = mount(CrmStoreMap, {
      props: { query: { view: 'PUBLIC', size: 20 }, focusRow: null },
      global: { plugins: [ElementPlus] },
    })
    const oldSignal = vi.mocked(crmStoreApi.map).mock.calls[0][1]!
    vi.mocked(crmStoreApi.map).mockResolvedValue(mapResult([sampleStore], 1))
    await wrapper.setProps({ query: { view: 'PUBLIC', size: 20, city: '330100' } })
    await flushPromises()
    finish(mapResult(sampleStores, 170099))
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(wrapper.get('.map-counts').text()).toContain('筛选共 1 家')
    expect(wrapper.get('.map-counts').text()).not.toContain('170,099')
    const latestSignal = vi.mocked(crmStoreApi.map).mock.lastCall![1]!
    wrapper.unmount()
    wrapper = undefined
    expect(latestSignal.aborted).toBe(true)
  })
  it('切出地图后，延迟加载的 SDK 不再创建地图或留下标记', async () => {
    let resolve!: (value: StoreMapSdk) => void
    vi.mocked(loadStoreMapSdk).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    wrapper = mount(CrmStoreMap, {
      props: { query: { view: 'PUBLIC', size: 20 }, focusRow: null },
      global: { plugins: [ElementPlus] },
    })
    wrapper.unmount()
    wrapper = undefined
    resolve(sdk)
    await flushPromises()
    expect(map.add).not.toHaveBeenCalled()
  })
  it('底图失败时给出重试，仍可切回列表', async () => {
    vi.mocked(loadStoreMapSdk).mockRejectedValue(new Error('地图加载失败，请重试或切回列表。'))
    const page = await mountPage()
    await display('map')
    expect(page.text()).toContain('地图加载失败')
    await display('list')
    expect(page.find('.store-table').exists()).toBe(true)
  })
})
describe('地图坐标系', () => {
  it('WGS84只转换展示坐标，GCJ02直接绘制，坐标不明和缺失不落点', async () => {
    vi.mocked(sdk.convertFrom).mockImplementation((_points, _type, callback) =>
      callback('complete', { locations: [{ getLng: () => 120.165, getLat: () => 30.286 }] }),
    )
    const gps = { ...sampleStore, id: 'GPS', coordinateSystem: 'WGS84' }
    const result = await storeMapPositions(sdk, [
      sampleStore,
      gps,
      sampleStores[3],
      { ...sampleStore, id: 'UNKNOWN', coordinateSystem: null },
    ])
    expect(result.positions.size).toBe(2)
    expect(result.positions.get('GPS')).toEqual([120.165, 30.286])
    expect(result.positions.get(sampleStore.id)).toEqual([120.159, 30.289])
    expect(gps.longitude).toBe(120.159)
  })
  it('转换失败不把WGS84直接画到高德底图', async () => {
    vi.mocked(sdk.convertFrom).mockImplementation((_points, _type, callback) =>
      callback('error', {}),
    )
    const result = await storeMapPositions(sdk, [{ ...sampleStore, coordinateSystem: 'WGS84' }])
    expect(result.positions.size).toBe(0)
    expect(result.conversionFailed).toBe(true)
  })
})
