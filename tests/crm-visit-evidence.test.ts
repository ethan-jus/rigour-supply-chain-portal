import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Evidence from '@/views/supply-chain/crm/CrmVisitEvidence.vue'
import { apiClient } from '@/api/core/client'
vi.mock('@/api/core/client', () => ({ apiClient: { get: vi.fn() } }))
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:test-photo')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
it('无敏感证据权限时不展示入口，也不读取数据', async () => {
  wrapper = mount(Evidence, {
    props: { captureId: 'capture-1', permissions: [] },
    global: { plugins: [ElementPlus] },
  })
  expect(wrapper.find('button').exists()).toBe(false)
  expect(apiClient.get).not.toHaveBeenCalled()
})
it('按权限读取照片目录，点击后才取照片并在离开时释放本地地址', async () => {
  vi.mocked(apiClient.get)
    .mockResolvedValueOnce({
      requiredStorefrontPhotoCount: 1,
      verifiedStorefrontPhotoCount: 1,
      photos: [
        {
          evidenceId: 'photo-1',
          capturedAt: '2026-10-28T05:00:00Z',
          distanceToTargetMeters: 3,
          evidenceStatus: 'TECHNICALLY_VERIFIED',
        },
      ],
    })
    .mockResolvedValueOnce(new Blob(['photo']))
  wrapper = mount(Evidence, {
    attachTo: document.body,
    props: { captureId: 'capture-1', permissions: ['sales:evidence:sensitive:read'] },
    global: { plugins: [ElementPlus] },
  })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(apiClient.get).toHaveBeenCalledTimes(1)
  expect(apiClient.get).toHaveBeenCalledWith('/sales/management/visits/capture-1/evidence', {
    stayOnUnauthorized: true,
  })
  const button = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('查看照片'),
  )!
  button.click()
  await flushPromises()
  expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:test-photo')
  expect(apiClient.get).toHaveBeenCalledTimes(2)
  wrapper.unmount()
  wrapper = undefined
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-photo')
})
