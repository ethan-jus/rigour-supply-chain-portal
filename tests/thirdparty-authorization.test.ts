import { afterEach, expect, it, vi } from 'vitest'
import { waitForAuthorization } from '@/utils/thirdparty-authorization'
afterEach(() => vi.useRealTimers())
it('等待后端完成，不接触授权码；企业待核验不误报成功', async () => {
  vi.useFakeTimers()
  const read = vi
    .fn()
    .mockResolvedValueOnce({ status: 'PENDING_VERIFICATION', message: '核验中' })
    .mockResolvedValueOnce({ status: 'SUCCEEDED', message: null })
  const progress = vi.fn()
  const pending = waitForAuthorization(read, new AbortController().signal, progress)
  await vi.advanceTimersByTimeAsync(2000)
  expect((await pending).status).toBe('SUCCEEDED')
  expect(read).toHaveBeenCalledTimes(2)
  expect(progress).toHaveBeenCalledWith('核验中')
})
it('关闭后停止轮询，不再发送后续请求', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const read = vi.fn().mockResolvedValue({ status: 'REDIRECTED', message: null })
  const pending = waitForAuthorization(read, controller.signal, vi.fn())
  const checked = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(0)
  controller.abort()
  await checked
  await vi.advanceTimersByTimeAsync(10_000)
  expect(read).toHaveBeenCalledTimes(1)
})
it('失败返回真实会话状态，不能把原有已授权连接当作本次成功', async () => {
  const read = vi.fn().mockResolvedValue({ status: 'UNCERTAIN', message: '需重新授权' })
  expect((await waitForAuthorization(read, new AbortController().signal, vi.fn())).status).toBe(
    'UNCERTAIN',
  )
})
