export interface AuthorizationProgress {
  status: string
  message: string | null
}
/** 页面仅查询无凭据的会话结果，不接触第三方授权码和 Token。 */
export async function waitForAuthorization<T extends AuthorizationProgress>(
  read: () => Promise<T>,
  signal: AbortSignal,
  progress: (message: string | null) => void,
): Promise<T> {
  const deadline = Date.now() + 10 * 60_000
  while (!signal.aborted) {
    const result = await read()
    if (signal.aborted) throw new DOMException('已关闭授权查询', 'AbortError')
    progress(result.message)
    if (!['CREATED', 'REDIRECTED', 'EXCHANGING', 'PENDING_VERIFICATION'].includes(result.status))
      return result
    if (Date.now() >= deadline) throw new Error('本次授权已超时，请关闭后重新发起授权')
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', done)
        resolve()
      }
      const timer = setTimeout(done, 2000)
      signal.addEventListener('abort', done, { once: true })
      if (signal.aborted) done()
    })
  }
  throw new DOMException('已关闭授权查询', 'AbortError')
}
