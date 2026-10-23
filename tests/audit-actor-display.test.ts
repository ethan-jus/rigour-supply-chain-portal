import { beforeEach, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
const auth = vi.hoisted(() => ({ value: 'Bearer test-session-one' }))
vi.mock('@/utils/token', () => ({ getAuthorizationHeader: () => auth.value }))
vi.mock('@/api/core/client', () => ({ apiClient: { post: vi.fn() } }))
import { apiClient } from '@/api/core/client'
import { auditActorLabel, loadAuditActorNames } from '@/utils/audit-actor'
import { displayDateTime } from '@/utils/business-date'
let session = 0
beforeEach(() => {
  vi.resetAllMocks()
  auth.value = `Bearer audit-test-${++session}`
})
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

it('导出等待所有姓名查询完成，每批最多100人并复用页面中的请求', async () => {
  const ids = Array.from({ length: 205 }, (_, index) => `EMP${index}`)
  vi.mocked(apiClient.post).mockImplementation(async (_url, body) =>
    Object.fromEntries((body as string[]).map((id) => [id, `员工${id.slice(3)}`])),
  )
  expect(auditActorLabel(ids[0])).toBe('加载中')
  await loadAuditActorNames([...ids, ...ids])
  expect(vi.mocked(apiClient.post).mock.calls.map((call) => (call[1] as string[]).length)).toEqual([
    100, 100, 5,
  ])
  expect(ids.map(auditActorLabel)).toEqual(ids.map((_, index) => `员工${index}`))
  await loadAuditActorNames(ids)
  expect(apiClient.post).toHaveBeenCalledTimes(3)
})

it('姓名缺失、查询失败和未登录时提供明确状态，不使用UUID或当前用户冒充操作人', async () => {
  vi.mocked(apiClient.post).mockResolvedValueOnce({})
  await loadAuditActorNames(['unknown-user'])
  expect(auditActorLabel('unknown-user')).toBe('姓名未记录')
  vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('IAM unavailable'))
  await loadAuditActorNames(['failed-user'])
  expect(auditActorLabel('failed-user')).toBe('姓名暂不可用')
  expect(auditActorLabel(null)).toBe('未记录')
  expect(auditActorLabel('测试员工')).toBe('测试员工')
  auth.value = ''
  expect(auditActorLabel('unknown-user')).toBe('姓名暂不可用')
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})

it('身份切换后丢弃旧请求的姓名，并中止旧身份的导出', async () => {
  let complete!: (value: Record<string, string>) => void
  vi.mocked(apiClient.post).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const oldExport = loadAuditActorNames(['same-user'])
  const rejected = expect(oldExport).rejects.toThrow('登录身份已变化')
  auth.value = 'Bearer another-tenant'
  vi.mocked(apiClient.post).mockResolvedValueOnce({ 'same-user': '新租户员工' })
  expect(auditActorLabel('same-user')).toBe('加载中')
  complete({ 'same-user': '旧租户员工' })
  await rejected
  expect(auditActorLabel('same-user')).toBe('新租户员工')
})

it('操作时间统一北京时间到秒，保留日期字段语义并容忍历史缺失数据', () => {
  expect(displayDateTime('2026-10-19T03:52:49.014886Z')).toBe('2026-10-19 11:52:49')
  expect(displayDateTime('2026-10-19T06:02:28.392666Z')).toBe('2026-10-19 14:02:28')
  expect(displayDateTime('2026-10-19T14:02:28.392666+08:00')).toBe('2026-10-19 14:02:28')
  expect(displayDateTime('2026-12-31T16:00:00Z')).toBe('2027-01-01 00:00:00')
  for (const value of [undefined, null, '', 'invalid', '2026-10-19T03:52:49'])
    expect(displayDateTime(value)).toBe('—')
})
