import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElSelect } from 'element-plus'
import CrmStoreEditor from '@/views/supply-chain/crm/CrmStoreEditor.vue'
import { crmStoreApi, type StorePoi } from '@/api/core/crm-store'
import { sampleStore, storeContext } from './fixtures/crm-stores'
import { ApiError } from '@/api/core/error'

vi.mock('@/api/core/crm-store', () => ({
  crmStoreApi: { maintenanceContext: vi.fn(), poiCandidates: vi.fn(), update: vi.fn() },
}))
const poi: StorePoi = {
  id: 'BTEST001',
  name: '核实台球厅',
  address: '核实路1号',
  publicPhone: null,
  typeCode: '080113',
  areaCode: '330105',
  longitude: 120.15,
  latitude: 30.28,
}
let wrapper: VueWrapper
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(
    (node) => node.textContent?.trim() === text,
  )
  expect(button).toBeTruthy()
  button!.click()
  await flushPromises()
}
async function input(label: string, value: string) {
  const node = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement
  expect(node).toBeTruthy()
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(crmStoreApi.maintenanceContext).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.poiCandidates).mockResolvedValue([poi])
  vi.mocked(crmStoreApi.update).mockResolvedValue(undefined)
  wrapper = mount(CrmStoreEditor, {
    attachTo: document.body,
    props: {
      store: { ...sampleStore, publicPhone: '人工电话', storeTypeCode: 'EXISTING' },
      storeTypes: [],
      statuses: ['UNKNOWN', 'OPEN', 'TEMP_CLOSED', 'CLOSED'].map((code, ordinal) => ({
        id: String(ordinal + 1),
        dictionaryId: 1,
        dictionaryCode: 'CRM_STORE_BUSINESS_STATUS',
        dictionaryItemCode: code,
        dictionaryItemName: code,
        ordinal,
        enabled: true,
        dictionaryItemLevel: 1,
        parentDictionaryItemCode: null,
        remark: null,
        revision: 1,
      })),
    },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('store maintenance', () => {
  it('discards an old query when the store name changes before the response', async () => {
    let resolve!: (rows: StorePoi[]) => void
    vi.mocked(crmStoreApi.poiCandidates).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await click('从高德补全')
    await input('维护门店名称', '另一家门店')
    resolve([poi])
    await flushPromises()
    expect(document.body.textContent).not.toContain('确认填入')
    await input('维护修改原因', '人工核实')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: '另一家门店' }),
      '人工核实',
      undefined,
      undefined,
    )
  })
  it('fills supplied fields and the dictionary classification, and retains the confirmed POI when its name differs', async () => {
    await wrapper.setProps({
      storeTypes: [
        {
          dictionaryId: 1,
          dictionaryCode: 'CRM_STORE_TYPE',
          dictionaryItemCode: 'POI_080113',
          dictionaryItemName: '台球厅',
          ordinal: 1,
          enabled: true,
        },
      ],
    })
    vi.mocked(crmStoreApi.poiCandidates).mockResolvedValue([
      { ...poi, publicPhone: '000-00000000' },
    ])
    await click('从高德补全')
    await click('确认填入')
    expect(document.querySelector('[role="status"]')?.textContent).toContain('已填入')
    await input('维护修改原因', '核实匹配')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: poi.name,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        coordinateSystem: 'GCJ02',
        publicPhone: '000-00000000',
        storeTypeCode: 'POI_080113',
      }),
      '核实匹配',
      poi.id,
      undefined,
    )
  })
  it('shows actionable IP whitelist guidance without exposing upstream diagnostics', async () => {
    vi.mocked(crmStoreApi.poiCandidates).mockRejectedValue(
      new ApiError(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: 'private secret',
          details: [{ field: 'amap', reason: 'AMAP_IP_NOT_ALLOWED', message: 'private secret' }],
        },
        503,
      ),
    )
    await click('从高德补全')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('10005')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('IP 白名单')
    expect(document.body.textContent).not.toContain('secret')
  })
  it('can undo candidate fill without losing the original human-maintained fields', async () => {
    await click('从高德补全')
    await click('确认填入')
    await click('撤销填入')
    await input('维护修改原因', '保留原资料')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: sampleStore.name,
        longitude: sampleStore.longitude,
        publicPhone: '人工电话',
      }),
      '保留原资料',
      undefined,
      undefined,
    )
  })
  it('loads manage scope, shows the complete administrative path and saves manual edits without Amap', async () => {
    expect(crmStoreApi.maintenanceContext).toHaveBeenCalledWith(sampleStore.id)
    expect(document.body.textContent).toContain('浙江省 / 杭州市 / 拱墅区')
    await input('维护详细地址', '人工核实地址')
    await input('维护修改原因', '现场核实')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        areaCode: '330105',
        address: '人工核实地址',
        longitude: sampleStore.longitude,
      }),
      '现场核实',
      undefined,
      undefined,
    )
    expect(crmStoreApi.poiCandidates).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toEqual([[sampleStore.id]])
  })
  it('never fills a result automatically and preserves missing phone and unknown dictionary type', async () => {
    await click('从高德补全')
    expect(crmStoreApi.poiCandidates).toHaveBeenCalledWith(
      sampleStore.id,
      sampleStore.name,
      '330105',
    )
    expect((document.querySelector('[aria-label="维护门店名称"]') as HTMLInputElement).value).toBe(
      sampleStore.name,
    )
    await click('确认填入')
    await input('维护修改原因', '确认高德门店')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: poi.name,
        longitude: poi.longitude,
        latitude: poi.latitude,
        coordinateSystem: 'GCJ02',
        publicPhone: '人工电话',
        storeTypeCode: 'EXISTING',
      }),
      '确认高德门店',
      poi.id,
      undefined,
    )
  })
  it('keeps manual maintenance available on provider failure and does not pretend a match succeeded', async () => {
    vi.mocked(crmStoreApi.poiCandidates).mockRejectedValue(new Error('高德查询暂不可用'))
    await click('从高德补全')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('高德查询暂不可用')
    expect(document.body.textContent).not.toContain('本次确认')
    await input('维护修改原因', '人工核实')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.anything(),
      '人工核实',
      undefined,
      undefined,
    )
  })
  it('saves profile and closure in one command with evidence and an explicit cooldown notice', async () => {
    wrapper.findAllComponents(ElSelect).at(-1)!.vm.$emit('update:modelValue', 'CLOSED')
    await flushPromises()
    expect(document.body.textContent).toContain('48小时认领冷却')
    await click('保存并留痕')
    expect(crmStoreApi.update).not.toHaveBeenCalled()
    await input('维护详细地址', '核实后的门牌地址')
    await input('维护修改原因', '现场确认已撤店并修正门牌')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ address: '核实后的门牌地址' }),
      '现场确认已撤店并修正门牌',
      undefined,
      { status: 'CLOSED', reason: '现场确认已撤店并修正门牌' },
    )
  })
  it('keeps a pending status change when undoing POI fill, and preserves edits after a rejected save', async () => {
    await click('从高德补全')
    await click('确认填入')
    wrapper.findAllComponents(ElSelect).at(-1)!.vm.$emit('update:modelValue', 'TEMP_CLOSED')
    await click('撤销填入')
    await input('维护修改原因', '现场确认装修暂停')
    vi.mocked(crmStoreApi.update).mockRejectedValue(new Error('门店状态已变化，请刷新'))
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: sampleStore.name }),
      '现场确认装修暂停',
      undefined,
      { status: 'TEMP_CLOSED', reason: '现场确认装修暂停' },
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(document.body.textContent).toContain('门店状态已变化，请刷新')
    expect(document.body.textContent).toContain('保留归属和原保护期限')
  })
  it('disables status changes when the dictionary is absent without blocking profile maintenance', async () => {
    await wrapper.setProps({ statuses: [] })
    expect(wrapper.findAllComponents(ElSelect).at(-1)!.props('disabled')).toBe(true)
    await input('维护修改原因', '手动修正资料')
    await click('保存并留痕')
    expect(crmStoreApi.update).toHaveBeenCalledWith(
      expect.anything(),
      '手动修正资料',
      undefined,
      undefined,
    )
  })
})
