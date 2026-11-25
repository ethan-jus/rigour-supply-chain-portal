import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}))
const authPermissions = vi.hoisted(() => new Set<string>())
const messages = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/core/client',()=>({apiClient:api}))
vi.mock('@/api', () => ({ apiClient: api }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: (permission: string) => authPermissions.has(permission) }),
}))
vi.mock('element-plus', () => ({ ElMessage: messages }))

import SalesTrackComparison from '@/views/supply-chain/sales/SalesTrackComparison.vue'

const passthrough = defineComponent({
  template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
})
const emptyStub = defineComponent({ template: '<span />' })
const resultStub = defineComponent({
  props: {
    title: { type: String, default: '' },
    subTitle: { type: String, default: '' },
  },
  template: '<div>{{ title }} {{ subTitle }}</div>',
})
const alertStub = defineComponent({
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  template: '<div>{{ title }} {{ description }}</div>',
})
function mountTrackComparison() {
  return mount(SalesTrackComparison, {
    global: {
      stubs: {
        ElAlert: alertStub,
        ElButton: passthrough,
        ElCard: passthrough,
        ElDatePicker: emptyStub,
        ElEmpty: passthrough,
        ElIcon: passthrough,
        ElOption: emptyStub,
        ElResult: resultStub,
        ElSelect: passthrough,
        ElTag: passthrough,
        Loading: emptyStub,
      },
    },
  })
}

describe('销售精确轨迹权限', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authPermissions.clear()
    api.get.mockImplementation((url: string) => {
      if (url === '/sales/management/fieldwork/report') {
        return Promise.resolve({ people: [{ id: 'profile-1', name:'测试销售' }] })
      }
      if (url.includes('/track')) {
        return Promise.resolve({
          workDayId: 'work-day-1', businessDate: '2026-08-17', status: 'FINISHED',
          totalDistanceMeters: 1200, trackedDurationMinutes: 60, points: [], visits: [],
        })
      }
      return Promise.resolve(null)
    })
  })

  it.each([
    [[] as string[]],
    [['sales:fieldwork:read']],
    [['sales:location:sensitive:read']],
  ])('权限组合 %j 不完整时显示无权状态且不发请求', async (permissions) => {
    permissions.forEach((permission) => authPermissions.add(permission))
    const wrapper = mountTrackComparison()
    await flushPromises()

    expect(wrapper.text()).toContain('无精确轨迹查看权限')
    expect(api.get).not.toHaveBeenCalled()

    const state = wrapper.vm as unknown as {
      loadPeople: () => Promise<void>
      loadTracks: () => Promise<void>
    }
    await state.loadPeople()
    await state.loadTracks()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('同时具备看板和敏感位置权限时才读取人员与轨迹', async () => {
    authPermissions.add('sales:fieldwork:read')
    authPermissions.add('sales:location:sensitive:read')
    const wrapper = mountTrackComparison()
    await flushPromises()

    expect(wrapper.text()).not.toContain('无精确轨迹查看权限')
    expect(api.get).toHaveBeenCalledWith('/sales/management/fieldwork/report', expect.any(Object))
    expect(api.get).toHaveBeenCalledWith(
      '/sales/management/profiles/profile-1/track',
      expect.objectContaining({ params: expect.objectContaining({ date: expect.any(String) }) }),
    )
  })
})
