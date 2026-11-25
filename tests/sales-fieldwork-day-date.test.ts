import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it, vi } from 'vitest'
import Fieldwork from '@/views/supply-chain/sales/SalesFieldwork.vue'
import FieldworkDatePicker from '@/views/supply-chain/sales/FieldworkDatePicker.vue'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/core/client', () => ({ apiClient: { get } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))

it('从拜访地图跨日仍查询同一人，清除原站点并保留返回地址', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/team', name: 'SupplySalesDashboard', component: Fieldwork },
      { path: '/visits', name: 'SupplySalesVisitsRecords', component: { template: '<div />' } },
    ],
  })
  const ledgerBack = '/visits?page=2'
  await router.push({ path: '/team', query: { view: 'map', selected: 'employee', visit: 'old-stop', ledgerBack, date: '2026-03-01' } })
  get.mockImplementation((_url, { params }) => Promise.resolve({
    date: params.date, asOf: params.date, total: 0, items: [], people: [{ id: 'employee', name: '测试员' }],
    departments: [], cities: [],
  }))
  const page = mount(Fieldwork, {
    shallow: true,
    global: { plugins: [router], stubs: { FieldworkDatePicker: false } },
  })
  await flushPromises()
  await page.get('button[aria-label="前一日"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.query).toEqual({ view: 'map', date: '2026-02-28', selected: 'employee', ledgerBack })
  expect(get).toHaveBeenLastCalledWith('/sales/management/fieldwork/report', expect.objectContaining({
    params: expect.objectContaining({ person: 'employee', date: '2026-02-28' }),
  }))
  expect(page.get('.team-back').attributes('href')).toContain(ledgerBack)
  await page.get('input[type="date"]').setValue('2026-02-12')
  await flushPromises()
  expect(router.currentRoute.value.query.date).toBe('2026-02-12')
  page.unmount()
})

it('当天禁用后一日，清空日期恢复当前值', async () => {
  const picker = mount(FieldworkDatePicker, { props: { id: 'day', date: '2026-11-23', max: '2026-11-23' } })
  expect(picker.get('button[aria-label="后一日"]').element.hasAttribute('disabled')).toBe(true)
  await picker.get('input').setValue('')
  expect(picker.get('input').element.value).toBe('2026-11-23')
  expect(picker.emitted('change')).toBeUndefined()
  picker.unmount()
})
