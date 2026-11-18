import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CrmWecomOverview from '@/views/supply-chain/crm/CrmWecomOverview.vue'
import { crmWecomApi } from '@/api/core/crm-wecom'
vi.mock('@/api/core/crm-wecom', () => ({ crmWecomApi: { summary: vi.fn(), list: vi.fn() } }))
let page: VueWrapper
const summary = { dataStatus: 'PARTIAL' as const, syncedAt: '2026-11-17T08:00:00Z', activeContacts: 1, linkedContacts: 1, pendingContacts: 0, coveredStores: 2, newContacts: 0 }
afterEach(() => { page?.unmount(); vi.resetAllMocks() })
it('公司概览保留完整门店名称及部分同步提示，不把关系条数当作人数', async () => {
  vi.mocked(crmWecomApi.summary).mockResolvedValue(summary)
  vi.mocked(crmWecomApi.list).mockResolvedValue({ total: 1, nextCursor: null, items: [{ id: '1', contactId: '2', name: '王老板', linked: true, stores: [{ id: '3', name: '星河台球俱乐部', role: '老板' }, { id: '4', name: '星河二店', role: '老板' }], relations: [{ employeeId: '5', employeeName: '张三', status: 'ACTIVE', addedAt: '2026-11-17T08:00:00Z' }] }] })
  page = mount(CrmWecomOverview, { props: { view: 'ALL' }, global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(page.text()).toContain('星河台球俱乐部')
  expect(page.text()).toContain('星河二店')
  expect(page.text()).toContain('尚未确认覆盖全公司')
  expect(page.text()).toContain('按联系人去重 · 1 人')
  expect(crmWecomApi.list).toHaveBeenCalledWith('ALL', false, undefined)
})
it('未接通时显示未知统计而不是全零', async () => {
  vi.mocked(crmWecomApi.summary).mockResolvedValue({ ...summary, dataStatus: 'NOT_CONNECTED', activeContacts: null, linkedContacts: null, pendingContacts: null, coveredStores: null })
  vi.mocked(crmWecomApi.list).mockResolvedValue({ total: 0, nextCursor: null, items: [] })
  page = mount(CrmWecomOverview, { props: { view: 'MINE' }, global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(page.text()).toContain('尚未接入企微官方同步')
  expect(page.find('.wecom-metrics').text().match(/—/g)).toHaveLength(4)
})
