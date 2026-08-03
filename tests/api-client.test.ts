import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { apiClient, registerUnauthorizedSessionHandler } from '@/api'

function adapter(data: unknown) {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => ({
    data, status: 200, statusText: 'OK', headers: {}, config,
  } as AxiosResponse)
}

function unauthorizedAdapter() {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const response = {
      data: {
        code: 'IAM_UNAUTHORIZED', message: '登录状态已失效', data: null,
        requestId: 'request-401', timestamp: '2026-08-03T00:00:00Z',
      },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    } as AxiosResponse
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response)
  }
}

let unregisterUnauthorizedHandler: (() => void) | undefined

afterEach(() => {
  unregisterUnauthorizedHandler?.()
  unregisterUnauthorizedHandler = undefined
  window.location.hash = ''
  vi.restoreAllMocks()
})

describe('API响应解包', () => {
  it('不把业务对象自身的code字段误判为错误码', async () => {
    const application = { id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理' }
    const response = await apiClient.get('/management/platform/applications/app-1', {
      adapter: adapter(application),
    })
    expect(response).toEqual(application)
  })

  it('仅解包结构完整的统一ApiResponse', async () => {
    const response = await apiClient.get('/wrapped', {
      adapter: adapter({
        code: 'OK', message: 'success', data: { id: 'tenant-1' },
        requestId: 'request-1', timestamp: '2026-07-31T00:00:00Z',
      }),
    })
    expect(response).toEqual({ id: 'tenant-1' })
  })

  it('401时调用统一会话清理器并进入登录页', async () => {
    const clearSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(clearSession)

    await expect(apiClient.get('/expired-session', {
      adapter: unauthorizedAdapter(),
    })).rejects.toMatchObject({ response: { status: 401 } })

    expect(clearSession).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('#/login')
  })
})
