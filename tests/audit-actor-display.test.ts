import { it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
const auth = vi.hoisted(() => ({ value: 'Bearer test-session-one' }))
vi.mock('@/utils/token', () => ({ getAuthorizationHeader: () => auth.value }))
vi.mock('@/api/core/client', () => ({ apiClient: { post: vi.fn() } }))
import { apiClient } from '@/api/core/client'
import { auditActorLabel } from '@/utils/audit-actor'
it('批量查询姓名，缓存不跨登录身份复用，缺失时不展示编码', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  vi.mocked(apiClient.post).mockResolvedValueOnce({ [id]: '张三' })
  expect(auditActorLabel(id)).toBe('加载中')
  expect(auditActorLabel(id)).toBe('加载中')
  await flushPromises()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(auditActorLabel(id)).toBe('张三')
  auth.value = 'Bearer test-session-two'
  vi.mocked(apiClient.post).mockResolvedValueOnce({})
  expect(auditActorLabel(id)).toBe('加载中')
  await flushPromises()
  expect(auditActorLabel(id)).toBe('姓名未记录')
  expect(auditActorLabel('SYSTEM')).toBe('系统同步')
})
