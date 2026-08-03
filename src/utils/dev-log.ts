/**
 * 门户开发期诊断日志。
 *
 * 只在 Vite 开发模式输出，且调用方只能传递请求路径、状态和数量等诊断信息；
 * 不记录 Bearer Token、密码、Cookie、请求体或密钥。
 */
export function devInfo(message: string, details?: unknown): void {
  if (!import.meta.env.DEV) return
  if (details === undefined) console.info(`[门户] ${message}`)
  else console.info(`[门户] ${message}`, details)
}

export function devWarn(message: string, details?: unknown): void {
  if (!import.meta.env.DEV) return
  if (details === undefined) console.warn(`[门户] ${message}`)
  else console.warn(`[门户] ${message}`, details)
}
