import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import CrmStorePoolView from '@/views/supply-chain/crm/CrmStorePoolView.vue'
import CrmStoreMap from '@/views/supply-chain/crm/CrmStoreMap.vue'
import { crmStoreApi, type StoreRow, type StoreMapResult } from '@/api/core/crm-store'
import { loadStoreMapSdk, storeMapPositions, type StoreMapSdk } from '@/utils/crm-store-map'
import { sampleStore, sampleStores, storeContext } from './fixtures/crm-stores'

vi.mock('@/api/core/crm-store', () => ({
  crmStoreApi: {
    context: vi.fn(),
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
    expect(document.body.textContent).toContain('新增门店提报')
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
