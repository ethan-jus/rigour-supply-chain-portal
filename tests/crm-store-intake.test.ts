import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElCascader, ElSelectV2, ElSelect } from 'element-plus'
import CrmStoreIntake from '@/views/supply-chain/crm/CrmStoreIntake.vue'
import CrmStoreLocationPicker from '@/views/supply-chain/crm/CrmStoreLocationPicker.vue'
import CrmStoreStatusEditor from '@/views/supply-chain/crm/CrmStoreStatusEditor.vue'
import CrmStoreLeadReview from '@/views/supply-chain/crm/CrmStoreLeadReview.vue'
import { crmStoreApi, type StoreLead, type StorePoi } from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
import { sampleStore, storeContext } from './fixtures/crm-stores'

vi.mock('@/api/core/crm-store', () => ({
  crmStoreApi: {
    intakeContext: vi.fn(),
    intakeLookup: vi.fn(),
    intakeCandidates: vi.fn(),
    admit: vi.fn(),
    submit: vi.fn(),
    resubmit: vi.fn(),
    businessStatus: vi.fn(),
    reviewLookup: vi.fn(),
    review: vi.fn(),
  },
}))
const item = (code: string, name: string, dict = 'CRM_STORE_BUSINESS_STATUS'): DictItemView => ({
  id: code,
  dictionaryCode: dict,
  dictionaryItemCode: code,
  dictionaryItemName: name,
  dictionaryItemLevel: 1,
  parentDictionaryItemCode: null,
  remark: null,
  ordinal: 1,
  revision: 1,
  enabled: true,
})
const statuses = [
  item('UNKNOWN', '待核实'),
  item('OPEN', '营业中'),
  item('TEMP_CLOSED', '暂停营业（自定义名称）'),
  item('CLOSED', '已停业'),
]
const storeTypes = [item('POI_080113', '台球厅', 'CRM_STORE_TYPE')]
const poi: StorePoi = {
  id: 'B001',
  name: '核实台球厅',
  address: '湖墅南路1号',
  areaCode: '330105',
  longitude: 120.16,
  latitude: 30.28,
  publicPhone: null,
  typeCode: '080113',
}
const lead: StoreLead = {
  id: '88',
  name: '提报球馆',
  address: '提报地址',
  areaCode: '330105',
  longitude: 120.15,
  latitude: 30.25,
  status: 'REJECTED',
  submittedAt: '2026-11-04T00:00:00Z',
  submitterUserId: 'SYSTEM',
  reviewerUserId: null,
  reviewedAt: null,
  reviewReason: '补充资料',
  resultStoreId: null,
  publicPhone: null,
  storeTypeCode: 'POI_080113',
  coordinateSystem: 'GCJ02',
  revision: 2,
}
let wrapper: VueWrapper
async function button(text: string) {
  const node = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  expect(node).toBeTruthy()
  node!.click()
  await flushPromises()
}
async function input(label: string, value: string) {
  const node = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement
  expect(node).toBeTruthy()
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
async function intake(existingLead?: StoreLead) {
  wrapper = mount(CrmStoreIntake, {
    attachTo: document.body,
    props: { storeTypes, statuses, lead: existingLead },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(crmStoreApi.intakeContext).mockResolvedValue(storeContext)
  vi.mocked(crmStoreApi.intakeLookup).mockResolvedValue([])
  vi.mocked(crmStoreApi.intakeCandidates).mockResolvedValue([poi])
  vi.mocked(crmStoreApi.admit).mockResolvedValue({ storeId: '99', name: poi.name })
  vi.mocked(crmStoreApi.submit).mockResolvedValue({ ...lead, status: 'PENDING_REVIEW' })
  vi.mocked(crmStoreApi.resubmit).mockResolvedValue({
    ...lead,
    status: 'PENDING_REVIEW',
    revision: 3,
  })
  vi.mocked(crmStoreApi.businessStatus).mockResolvedValue(undefined)
  vi.mocked(crmStoreApi.reviewLookup).mockResolvedValue([sampleStore])
  vi.mocked(crmStoreApi.review).mockResolvedValue({ ...lead, status: 'APPROVED' })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('unified store intake', () => {
  it('searches the company first, submits only the selected POI identity, and does not claim', async () => {
    await intake()
    await input('新增门店名称', '核实球馆')
    expect(document.body.textContent).not.toContain('从高德查找')
    await button('查找已有门店')
    expect(crmStoreApi.intakeLookup).toHaveBeenCalledWith('核实球馆', '330100')
    await button('从高德查找')
    await button('选择门店')
    await button('确认入公海')
    expect(crmStoreApi.admit).toHaveBeenCalledWith(poi.id, expect.any(String))
    expect(crmStoreApi.submit).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('门店已进入公海')
    expect(document.body.textContent).toContain('前往公海')
    expect(wrapper.emitted('navigate')).toBeUndefined()
    await button('前往公海')
    expect(wrapper.emitted('navigate')).toEqual([['PUBLIC', '99']])
  })
  it('invalidates stale company and Amap results when query identity changes', async () => {
    let resolve!: (rows: StorePoi[]) => void
    vi.mocked(crmStoreApi.intakeCandidates).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await intake()
    await input('新增门店名称', '球馆')
    await button('查找已有门店')
    await button('从高德查找')
    await input('新增门店名称', '另一家')
    resolve([poi])
    await flushPromises()
    expect(document.body.textContent).not.toContain(poi.name)
    expect(document.body.textContent).not.toContain('确认入公海')
  })
  it('manual entry submits a typed, located proposal for review without creating a store', async () => {
    await intake()
    await input('新增门店名称', '手动球馆')
    await button('查找已有门店')
    await button('手动填写')
    wrapper.findAllComponents(ElSelectV2).at(-1)!.vm.$emit('update:modelValue', '330105')
    await flushPromises()
    expect(document.body.textContent).not.toContain('所属区县已变化')
    wrapper.findComponent(ElCascader).vm.$emit('update:modelValue', 'POI_080113')
    wrapper.findComponent(CrmStoreLocationPicker).vm.$emit('picked', 120.15, 30.25, 'WGS84')
    await input('新增详细地址', '手动地址')
    await button('提交审核')
    expect(crmStoreApi.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '手动球馆',
        areaCode: '330105',
        address: '手动地址',
        longitude: 120.15,
        latitude: 30.25,
        coordinateSystem: 'WGS84',
        storeTypeCode: 'POI_080113',
        publicPhone: null,
      }),
    )
    expect(crmStoreApi.admit).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('门店已提交审核')
  })
  it('editing provider facts switches to manual review and removes the direct-admission action', async () => {
    await intake()
    await input('新增门店名称', '球馆')
    await button('查找已有门店')
    await button('从高德查找')
    await button('选择门店')
    await button('资料不符，改为手动提报')
    await input('新增详细地址', '实际地址2号')
    await button('提交审核')
    expect(crmStoreApi.admit).not.toHaveBeenCalled()
    expect(crmStoreApi.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: poi.name,
        address: '实际地址2号',
        storeTypeCode: 'POI_080113',
      }),
    )
  })
  it('keeps provider errors visible and permits manual fallback', async () => {
    vi.mocked(crmStoreApi.intakeCandidates).mockRejectedValue(new Error('高德暂不可用'))
    await intake()
    await input('新增门店名称', '球馆')
    await button('查找已有门店')
    await button('从高德查找')
    expect(document.body.textContent).toContain('高德暂不可用')
    await button('手动填写')
    expect(document.body.textContent).toContain('提交审核')
    expect(crmStoreApi.admit).not.toHaveBeenCalled()
  })
  it('resubmits the original rejected record rather than creating another proposal', async () => {
    await intake(lead)
    await input('新增详细地址', '补正地址')
    await button('重新提交审核')
    expect(crmStoreApi.resubmit).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({ address: '补正地址' }),
    )
    expect(crmStoreApi.submit).not.toHaveBeenCalled()
  })
  it('clears the old location when the proposal county changes and requires a new pick', async () => {
    vi.mocked(crmStoreApi.intakeContext).mockResolvedValue({
      ...storeContext,
      areas: [
        ...storeContext.areas,
        { code: '330106', name: '西湖区', level: 'COUNTY', parentCode: '330100', regionCode: null },
      ],
    })
    await intake(lead)
    wrapper.findAllComponents(ElSelectV2).at(-1)!.vm.$emit('update:modelValue', '330106')
    await flushPromises()
    expect(wrapper.findComponent(CrmStoreLocationPicker).props('longitude')).toBeUndefined()
    expect(document.body.textContent).toContain('所属区县已变化')
    await button('重新提交审核')
    expect(crmStoreApi.resubmit).not.toHaveBeenCalled()
    wrapper.findComponent(CrmStoreLocationPicker).vm.$emit('picked', 120.1, 30.2, 'GCJ02')
    await flushPromises()
    await button('重新提交审核')
    expect(crmStoreApi.resubmit).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({ areaCode: '330106', longitude: 120.1, latitude: 30.2 }),
    )
  })
  it('does not show success on a duplicate admission response', async () => {
    vi.mocked(crmStoreApi.admit).mockRejectedValue(new Error('该高德 POI 已在商家库中'))
    await intake()
    await input('新增门店名称', '球馆')
    await button('查找已有门店')
    await button('从高德查找')
    await button('选择门店')
    await button('确认入公海')
    expect(document.body.textContent).toContain('该高德 POI 已在商家库中')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(document.body.textContent).not.toContain('门店已进入公海')
  })
})

describe('operating status and submission review', () => {
  it('uses configured status labels, requires evidence and sends the explicit owner context', async () => {
    wrapper = mount(CrmStoreStatusEditor, {
      attachTo: document.body,
      props: { store: sampleStore, statuses, management: false },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(document.body.textContent).not.toContain('UNKNOWN')
    wrapper.findComponent(ElSelect).vm.$emit('update:modelValue', 'CLOSED')
    await flushPromises()
    await button('确认并留痕')
    expect(crmStoreApi.businessStatus).not.toHaveBeenCalled()
    await input('经营状态核实依据', '现场确认已撤店')
    await button('确认并留痕')
    expect(crmStoreApi.businessStatus).toHaveBeenCalledWith(
      sampleStore,
      'CLOSED',
      '现场确认已撤店',
      false,
      expect.any(String),
    )
    expect(wrapper.emitted('saved')).toEqual([[]])
    expect(document.body.textContent).toContain('结束当前归属')
  })
  it('does not allow status writes with an unavailable dictionary', async () => {
    wrapper = mount(CrmStoreStatusEditor, {
      attachTo: document.body,
      props: { store: sampleStore, statuses: [], management: true },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(document.body.textContent).toContain('经营状态字典未加载')
    await input('经营状态核实依据', '核验')
    await button('确认并留痕')
    expect(crmStoreApi.businessStatus).not.toHaveBeenCalled()
  })
  it('uses reviewer lookup and links a reviewed proposal without copying store history', async () => {
    vi.mocked(crmStoreApi.review).mockRejectedValueOnce(new Error('网络中断，请重试'))
    wrapper = mount(CrmStoreLeadReview, {
      attachTo: document.body,
      props: { lead, approve: true, areas: storeContext.areas, statuses, storeTypes },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    await button('查重核对')
    await button('关联此门店')
    await input('提报审核说明', '核验为已有门店')
    await button('确认关联')
    expect(document.body.textContent).toContain('网络中断，请重试')
    await button('确认关联')
    expect(vi.mocked(crmStoreApi.review).mock.calls[0][4]?.requestId).toBe(
      vi.mocked(crmStoreApi.review).mock.calls[1][4]?.requestId,
    )
    expect(crmStoreApi.reviewLookup).toHaveBeenCalledWith(lead.name, lead.areaCode)
    expect(crmStoreApi.intakeLookup).not.toHaveBeenCalled()
    expect(crmStoreApi.review).toHaveBeenCalledWith(
      lead.id,
      lead.revision,
      true,
      '核验为已有门店',
      expect.objectContaining({
        existingStoreId: sampleStore.id,
        distinctConfirmed: false,
        requestId: expect.any(String),
      }),
    )
  })
})
