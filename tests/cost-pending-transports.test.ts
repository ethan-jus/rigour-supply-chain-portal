import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CostPendingTransports from '@/views/supply-chain/bi/cost/CostPendingTransports.vue'
import { getPendingTransports } from '@/api/core/bi-cost-dashboard'

vi.mock('@/api/core/bi-cost-dashboard', () => ({ getPendingTransports: vi.fn() }))
const permission = vi.hoisted(() => ({ write: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({
    can: (action: string) => action === 'order:logistics-cost:read' || permission.write,
  }),
}))

const query = {
  year: 2026,
  month: 11,
  city: 'WH',
  department: 'D7',
  snapshotId: 'dashboard-snapshot',
  size: 20,
}
const items = [
  {
    id: 'transport-1',
    date: '2026-11-15',
    documentNo: 'TEST-DHB-01',
    cityName: '武汉市',
    missing: ['AMOUNT', 'DEPARTMENT', 'EVIDENCE'],
  },
  {
    id: 'transport-2',
    date: '2026-11-15',
    documentNo: 'TEST-HLL-02',
    cityName: '武汉市',
    sourceSystem: 'HUOLALA',
    missing: ['AMOUNT'],
  },
]
describe('看板待完善运输记录', () => {
  const render = () =>
    mount(CostPendingTransports, {
      props: { query, range: '11 月 · 武汉市' },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
  it('按看板原筛选分页，逐项引导到对应的原单区域', async () => {
    vi.mocked(getPendingTransports).mockResolvedValue({
      total: 23,
      scopeTotal: 23,
      page: 1,
      size: 20,
      items,
    })
    const wrapper = render()
    await flushPromises()
    expect(getPendingTransports).toHaveBeenCalledWith(
      { ...query, page: 1 },
      expect.any(AbortSignal),
    )
    expect(wrapper.emitted('count')).toEqual([[23]])
    expect(wrapper.text()).toContain('共 23 笔')
    expect(wrapper.text()).toContain('关联业务单缺部门')
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links.find((link) => link.text() === '去补运费')?.props('to')).toMatchObject({
      query: { sourceId: 'transport-1', section: 'fees', edit: '1' },
    })
    expect(links.find((link) => link.text() === '去上传凭证')?.props('to')).toMatchObject({
      query: { sourceId: 'transport-1', section: 'evidence', edit: '1' },
    })
    expect(links.find((link) => link.text() === '去核对平台账单')?.props('to')).toEqual({
      path: '/supply-chain/cost/logistics',
      query: { sourceId: 'transport-2', section: 'fees' },
    })

    vi.mocked(getPendingTransports).mockResolvedValue({
      total: 23,
      scopeTotal: 23,
      page: 2,
      size: 20,
      items,
    })
    await wrapper.get('.pagination button:last-child').trigger('click')
    await flushPromises()
    expect(getPendingTransports).toHaveBeenLastCalledWith(
      { ...query, page: 2 },
      expect.any(AbortSignal),
    )
    vi.mocked(getPendingTransports).mockResolvedValue({
      total: 1,
      scopeTotal: 23,
      page: 1,
      size: 20,
      items: [items[0]!],
    })
    await wrapper.get('select').setValue('EVIDENCE')
    await flushPromises()
    expect(getPendingTransports).toHaveBeenLastCalledWith(
      { ...query, reason: 'EVIDENCE', page: 1 },
      expect.any(AbortSignal),
    )
    expect(wrapper.emitted('count')?.at(-1)).toEqual([23])
    expect(wrapper.text()).toContain('共 1 笔')
    expect(wrapper.text()).not.toContain('TEST-HLL-02')
    expect(links.find((link) => link.text() === '批量补录运费')?.props('to')).toMatchObject({
      query: { action: 'import-freight' },
    })
    wrapper.unmount()
  })

  it('仅有查看权限时仍可看到缺项和进入原单查看', async () => {
    permission.write = false
    vi.mocked(getPendingTransports).mockResolvedValue({
      total: 2,
      scopeTotal: 2,
      page: 1,
      size: 20,
      items,
    })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('缺运费')
    expect(wrapper.text()).toContain('请联系有运输记录编辑权限的同事补齐')
    expect(wrapper.text()).not.toContain('去补运费')
    expect(wrapper.text()).not.toContain('批量补录运费')
    expect(wrapper.text()).toContain('TEST-DHB-01')
    wrapper.unmount()
    permission.write = true
  })
})
