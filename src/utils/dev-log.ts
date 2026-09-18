/**
 * SCDP开发期诊断日志。
 *
 * 只在 Vite 开发模式输出，且调用方只能传递请求路径、状态和数量等诊断信息；
 * 不记录 Bearer Token、密码、Cookie、请求体或密钥。
 */
export function devInfo(message: string, details?: unknown): void {
  if (!import.meta.env.DEV) return
  if (details === undefined) console.info(`[SCDP] ${message}`)
  else console.info(`[SCDP] ${message}`, details)
}

export function devWarn(message: string, details?: unknown): void {
  if (!import.meta.env.DEV) return
  if (details === undefined) console.warn(`[SCDP] ${message}`)
  else console.warn(`[SCDP] ${message}`, details)
}
