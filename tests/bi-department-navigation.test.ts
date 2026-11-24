import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElTreeSelect } from 'element-plus'
import DashboardView from '@/views/supply-chain/bi/DashboardView.vue'
import { meetingFixture } from './fixtures/bi-meeting-data'

vi.mock('element-plus/es/components/image/style/css', () => ({}))
const api = vi.hoisted(() => ({ overview: vi.fn(), filters: vi.fn(), analysis: vi.fn() }))
vi.mock('@/api/core/bi', () => ({
  getDepartmentDashboardFilters: api.filters,
  getSupplyDashboardOverview: api.overview,
  getSupplyDashboardOperatingAnalysis: api.analysis,
  getSupplyDashboardFilterOptions: vi.fn(),
  getSupplyDashboardDataTrust: vi.fn(),
}))
vi.mock('@/api/core/bi-access', () => ({
  getBiEffectiveScope: async () => ({ accessLevel: 'SCOPED', globalGovernance: false }),
}))
vi.mock('@/api/core/bi-sales-dashboard', () => ({
  getSalesDashboardAnalysis: async () => ({ goals: [] }),
}))

describe('部门经营导航', () => {
  it('负责人默认看团队，保留地区与期间向下两级，返回后恢复父部门', async () => {
    const departments = [
      { code: 'TEAM', name: '苏无部', parentCode: null },
      { code: 'SZ', name: '苏州市部', parentCode: 'TEAM' },
      { code: 'WX', name: '无锡市部', parentCode: 'TEAM' },
      { code: 'WX1', name: '无锡一组', parentCode: 'WX' },
    ]
    api.filters.mockResolvedValue({
      departments,
      defaultDepartmentCode: 'TEAM',
      customerRegions: [{ code: 'CUSTOMER-SZ', name: '苏州客户', parentCode: null }],
    })
    api.overview.mockResolvedValue(meetingFixture().current)
    api.analysis.mockResolvedValue(meetingFixture().analysis)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/supply-chain/bi',
          component: DashboardView,
          meta: { title: '经营总览', dashboardSection: 'overview' },
        },
        {
          path: '/supply-chain/bi/city-operating',
          component: DashboardView,
          meta: { title: '部门经营', dashboardSection: 'city-operating' },
        },
      ],
    })
    await router.push('/supply-chain/bi?from=2026-09-01&to=2026-09-21')
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [router, ElementPlus],
        stubs: { EchartsChart: true, BiReceiptDetails: true },
      },
    })
    try {
      await flushPromises()
      expect(wrapper.findAll('.city-link').map((n) => n.text())).toEqual(['苏无部'])
      const regions = wrapper
        .findAllComponents(ElTreeSelect)
        .find(
          (e) =>
            e.attributes('aria-label') === '客户归属地区' ||
            e.props('ariaLabel') === '客户归属地区',
        )!
      regions.vm.$emit('update:modelValue', 'CUSTOMER-SZ')
      await flushPromises()
      await wrapper.get('.city-link').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.regionCode).toBe('TEAM')
      expect(wrapper.findAll('.child-departments strong').map((n) => n.text())).toEqual([
        '苏州市部',
        '无锡市部',
      ])
      await wrapper.findAll('.child-departments button')[1]!.trigger('click')
      await flushPromises()
      expect(wrapper.get('.child-departments strong').text()).toBe('无锡一组')
      await wrapper.get('.child-departments button').trigger('click')
      await flushPromises()
      expect(
        api.overview.mock.calls.some(
          ([q]) =>
            q.regionCode === 'WX1' &&
            q.customerRegionCode === 'CUSTOMER-SZ' &&
            q.from.startsWith('2026-09-01'),
        ),
      ).toBe(true)
      expect(wrapper.find('.child-departments').exists()).toBe(false)
      router.back()
      await flushPromises()
      expect(router.currentRoute.value.query).toMatchObject({
        regionCode: 'WX',
        customerRegionCode: 'CUSTOMER-SZ',
      })
    } finally {
      wrapper.unmount()
    }
  })
})
