import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * Mock 处理器注册接口
 *
 * 每个 handler 对应一个 API 路径和方法，返回模拟响应数据。
 * Mock Adapter 在 Axios 请求拦截器中通过覆盖 adapter 函数
 * 直接返回模拟响应，不会让请求落到真实网络。
 */
export interface MockHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** API 路径，不含 baseURL，如 "/auth/login" */
  path: string
  /** 模拟响应生成函数，可接收请求体参数 */
  handler: (params?: Record<string, unknown>) => unknown
}

const handlers: MockHandler[] = []

/**
 * 注册一个 Mock Handler
 *
 * 在模块顶层调用，handler 在 import 时即注册。
 * 仅当 `VITE_ENABLE_MOCK=true` 时生效。
 */
export function registerMock(handler: MockHandler): void {
  handlers.push(handler)
}

/**
 * 获取全部已注册 handler
 */
export function getMockHandlers(): MockHandler[] {
  return handlers
}

/**
 * 在 Axios 实例中注入 Mock 拦截器
 *
 * 通过覆盖每个匹配请求的 `adapter` 函数，直接返回模拟响应对象，
 * 完全跳过真实 HTTP 请求。
 * 只在 VITE_ENABLE_MOCK=true 时启用。
 *
 * 匹配策略：精确匹配 method + path。
 * 未匹配的请求正常透传给默认 adapter。
 */
export function setupMockAdapter(client: AxiosInstance): void {
  if (import.meta.env.VITE_ENABLE_MOCK !== 'true') return

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = (config.method || 'GET').toUpperCase()
    const path = config.url || ''

    const matched = handlers.find(
      (h) => h.method.toUpperCase() === method && h.path === path,
    )

    if (matched) {
      // 覆盖 adapter，直接返回模拟响应，跳过网络
      // 原始 adapter 保存在 config 中以备 fallback
      const originalAdapter = config.adapter
      config.adapter = (adapterConfig: InternalAxiosRequestConfig) => {
        try {
          const data = matched.handler(
            adapterConfig.data
              ? typeof adapterConfig.data === 'string'
                ? JSON.parse(adapterConfig.data)
                : adapterConfig.data
              : undefined,
          )
          const response: AxiosResponse = {
            data,
            status: 200,
            statusText: 'OK',
            headers: { 'x-mock': 'true' } as unknown as AxiosResponse['headers'],
            config: adapterConfig,
          }
          return Promise.resolve(response)
        } catch {
          // handler 出错时回退到原始 adapter
          if (originalAdapter) {
            return originalAdapter(adapterConfig)
          }
          return Promise.reject(new Error('Mock handler failed'))
        }
      }
    }

    return config
  })

  console.log(`[Mock] Adapter ready, ${handlers.length} handlers registered`)
}
