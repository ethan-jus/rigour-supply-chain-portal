import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import CrmStorePoolView from '@/views/supply-chain/crm/CrmStorePoolView.vue'
import CrmStoreMap from '@/views/supply-chain/crm/CrmStoreMap.vue'
import { crmStoreApi } from '@/api/core/crm-store'
import { loadStoreMapSdk, storeMapPositions, type StoreMapSdk } from '@/utils/crm-store-map'
import { sampleStore, sampleStores, storeContext } from './fixtures/crm-stores'

vi.mock('@/api/core/crm-store', () => ({
  crmStoreApi: {
    context: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
    visits: vi.fn(),
    reviewVisit: vi.fn(),
  },
}))
vi.mock('@/api/core/business-settings', () => ({
  getEffectiveBizDict: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('@/utils/crm-store-map', async (original) => ({
  ...(await original<typeof import('@/utils/crm-store-map')>()),
  loadStoreMapSdk: vi.fn(),
}))
const map = {
  add: vi.fn(),
  clearMap: vi.fn(),
  setFitView: vi.fn(),
  setZoomAndCenter: vi.fn(),
  destroy: vi.fn(),
}
let markerOptions: Record<string, unknown>[] = []
const sdk: StoreMapSdk = {
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
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  markerOptions = []
  vi.mocked(loadStoreMapSdk).mockResolvedValue(sdk)
  vi.mocked(crmStoreApi.context).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.list).mockResolvedValue({
    total: 84,
    items: sampleStores,
    nextCursor: 'TEST-100',
  })
  vi.mocked(crmStoreApi.detail).mockResolvedValue(sampleStore)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})
async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: CrmStorePoolView }],
  })
  await router.push('/supply-chain/crm/stores/public')
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
    expect(wrapper.get('.store-table').text()).toContain('认领冷却中')
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
  it('独立表头、门店标签保留，名称直接开详情，没有查看按钮', async () => {
    const page = await mountPage()
    expect(page.findAll('th').map((n) => n.text())).toEqual([
      '门店信息',
      '门店类型',
      '所属地区',
      '最近拜访',
      '最近成交',
      '认领状态',
      '操作',
    ])
    expect(page.findAll('button').some((button) => button.text() === '查看')).toBe(false)
    expect(page.get('.store-identity').text()).toContain('历史合作')
    expect(page.get('.store-identity').text()).toContain('价值 A')
    await page.get('.store-name').trigger('click')
    await flushPromises()
    expect(crmStoreApi.detail).toHaveBeenCalledWith(sampleStore.id, 'PUBLIC')
    expect(document.body.querySelector('.el-drawer')).toBeTruthy()
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
    expect(markerOptions).toHaveLength(3)
    expect(page.text()).toContain('当前页 4 家 · 筛选共 84 家')
    expect(page.text()).toContain('1 家位置待完善')
    await display('list')
    expect((page.get('input[aria-label="门店名称或地址"]').element as HTMLInputElement).value).toBe(
      '台球',
    )
    expect(page.find('.store-table').exists()).toBe(true)
    expect(map.destroy).toHaveBeenCalledOnce()
    expect(crmStoreApi.list).toHaveBeenCalledTimes(1)
  })
  it('地图按钮显示本页全部点，点击图钉选店，再点名称打开详情', async () => {
    const page = await mountPage()
    await display('map')
    expect(map.setFitView).toHaveBeenCalled()
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
    wrapper = mount(CrmStoreMap, {
      props: {
        rows: variants.map((v) => ({ ...sampleStore, ...v, name: '<img src=x>测试门店' })),
        total: 4,
        loading: false,
        focusId: null,
      },
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
    await wrapper.setProps({ focusId: 'private-cooperated' })
    expect(buttons[3].classList.contains('is-private')).toBe(true)
    expect(buttons[3].classList.contains('is-selected')).toBe(true)
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true')
    expect(buttons[3].querySelector('.marker-cooperated')).toBeTruthy()
    expect(wrapper.get('.map-tags').text()).toContain('私海')
    await wrapper.setProps({ focusId: null })
    expect(buttons[3].classList.contains('is-selected')).toBe(false)
    expect(buttons[3].classList.contains('is-private')).toBe(true)
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
      props: { rows: sampleStores, total: 4, loading: false, focusId: null },
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
