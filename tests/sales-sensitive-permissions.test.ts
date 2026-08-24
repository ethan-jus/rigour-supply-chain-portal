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

vi.mock('@/api', () => ({ apiClient: api }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: (permission: string) => authPermissions.has(permission) }),
}))
vi.mock('element-plus', () => ({ ElMessage: messages }))

import SalesReviewQueue from '@/views/supply-chain/sales/SalesReviewQueue.vue'
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
const dialogStub = defineComponent({
  props: { modelValue: { type: Boolean, default: false } },
  template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
})

const reviewItem = {
  visitId: 'visit-1',
  salesProfileId: 'profile-1',
  salesNo: 'S001',
  storeName: '测试门店',
  checkedInAt: '2026-08-17T01:00:00Z',
  checkedOutAt: '2026-08-17T02:00:00Z',
  dwellMinutes: 60,
  minimumDwellMinutes: 30,
  uploadedRecordingSeconds: 120,
  verifiedRecordingSeconds: 120,
  minimumRecordingSeconds: 60,
  verifiedStorefrontPhotoCount: 1,
  requiredStorefrontPhotoCount: 1,
  contactOutcome: 'CONTACTED',
  kpName: '张三',
  intentionLevel: 'HIGH',
  resultNote: '已完成拜访',
  visitType: 'FIRST_VISIT',
  anomalyCodes: [],
}

function mountReviewQueue() {
  return mount(SalesReviewQueue, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElAlert: alertStub,
        ElButton: passthrough,
        ElCard: passthrough,
        ElDatePicker: emptyStub,
        ElDialog: dialogStub,
        ElEmpty: passthrough,
        ElForm: passthrough,
        ElFormItem: passthrough,
        ElIcon: passthrough,
        ElInput: emptyStub,
        ElOption: emptyStub,
        ElPagination: emptyStub,
        ElRadioButton: passthrough,
        ElRadioGroup: passthrough,
        ElResult: resultStub,
        ElSelect: passthrough,
        ElTable: passthrough,
        ElTableColumn: emptyStub,
        ElTag: passthrough,
        Loading: emptyStub,
      },
    },
  })
}

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

describe('销售复核敏感证据权限', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authPermissions.clear()
    api.get.mockImplementation((url: string) => {
      if (url === '/sales/management/review-queue') {
        return Promise.resolve({
          from: '2026-08-01', to: '2026-08-17', items: [reviewItem], page: 1, pageSize: 20, total: 1,
        })
      }
      if (url.endsWith('/evidence')) {
        return Promise.resolve({
          visitId: 'visit-1', requiredStorefrontPhotoCount: 1,
          verifiedStorefrontPhotoCount: 1, photos: [],
        })
      }
      if (url.endsWith('/recordings')) {
        return Promise.resolve({ visitId: 'visit-1', clipCount: 0, uploadedTotalDurationMs: 0, clips: [] })
      }
      return Promise.resolve(new Blob())
    })
  })

  it('无复核权限时显示无权状态，不请求队列或敏感证据', async () => {
    authPermissions.add('sales:evidence:sensitive:read')
    authPermissions.add('sales:recording:sensitive:play')
    const wrapper = mountReviewQueue()
    await flushPromises()

    expect(wrapper.text()).toContain('无拜访复核权限')
    expect(api.get).not.toHaveBeenCalled()

    const state = wrapper.vm as unknown as {
      load: () => Promise<void>
      openReview: (item: typeof reviewItem) => void
      saveReview: () => Promise<void>
    }
    await state.load()
    state.openReview(reviewItem)
    await state.saveReview()
    expect(api.get).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('只有复核权限时可读队列，但不请求照片或录音', async () => {
    authPermissions.add('sales:visit:review')
    const wrapper = mountReviewQueue()
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/sales/management/review-queue', expect.any(Object))
    const state = wrapper.vm as unknown as {
      openReview: (item: typeof reviewItem) => void
      loadPhoto: (photo: Record<string, unknown>) => Promise<void>
      loadClip: (clip: Record<string, unknown>) => Promise<void>
    }
    state.openReview(reviewItem)
    await state.loadPhoto({ evidenceId: 'photo-1' })
    await state.loadClip({ clipId: 'clip-1' })
    await flushPromises()

    expect(wrapper.text()).toContain('无现场照片查看权限')
    expect(wrapper.text()).toContain('无现场录音播放权限')
    expect(api.get).not.toHaveBeenCalledWith('/sales/management/visits/visit-1/evidence')
    expect(api.get).not.toHaveBeenCalledWith('/sales/management/visits/visit-1/recordings')
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/evidence/photos/'),
      expect.anything(),
    )
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/recordings/clips/'),
      expect.anything(),
    )
  })

  it.each([
    ['sales:evidence:sensitive:read', '/sales/management/visits/visit-1/evidence', '/sales/management/visits/visit-1/recordings'],
    ['sales:recording:sensitive:play', '/sales/management/visits/visit-1/recordings', '/sales/management/visits/visit-1/evidence'],
  ])('按独立权限 %s 仅请求对应敏感证据', async (permission, allowedUrl, deniedUrl) => {
    authPermissions.add('sales:visit:review')
    authPermissions.add(permission)
    const wrapper = mountReviewQueue()
    await flushPromises()

    const state = wrapper.vm as unknown as { openReview: (item: typeof reviewItem) => void }
    state.openReview(reviewItem)
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith(allowedUrl)
    expect(api.get).not.toHaveBeenCalledWith(deniedUrl)
  })
})

describe('销售精确轨迹权限', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authPermissions.clear()
    api.get.mockImplementation((url: string) => {
      if (url === '/sales/management/dashboard') {
        return Promise.resolve({ people: [{ salesProfileId: 'profile-1', salesNo: 'S001' }] })
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
    [['sales:dashboard:read']],
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
    authPermissions.add('sales:dashboard:read')
    authPermissions.add('sales:location:sensitive:read')
    const wrapper = mountTrackComparison()
    await flushPromises()

    expect(wrapper.text()).not.toContain('无精确轨迹查看权限')
    expect(api.get).toHaveBeenCalledWith('/sales/management/dashboard', expect.any(Object))
    expect(api.get).toHaveBeenCalledWith(
      '/sales/management/profiles/profile-1/track',
      expect.objectContaining({ params: expect.objectContaining({ date: expect.any(String) }) }),
    )
  })
})
