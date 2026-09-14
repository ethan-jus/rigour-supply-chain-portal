import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { apiClient, registerUnauthorizedSessionHandler } from '@/api'
import * as token from '@/utils/token'

function adapter(data: unknown) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    data, status: 200, statusText: 'OK', headers: {}, config,
  })
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
    }
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response)
  }
}

function gatewayUnauthorizedAdapter() {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const response = {
      data: {
        timestamp: '2026-08-03T00:00:00Z', status: 401,
        error: 'Unauthorized', path: '/api/v1/orders/dhb',
      },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    }
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
  const invoice = { id: '9007199254740993', amount: '123.40' }
  const envelope = (data: unknown) => ({
    code: 'OK', message: 'success', data,
    requestId: 'request-typed', timestamp: '2026-09-14T00:00:00Z',
  })

  it('单泛型、双泛型、request与直接调用都返回业务body并保留原始值', async () => {
    const config = { adapter: adapter(envelope(invoice)) }
    const results = await Promise.all([
      apiClient.get<typeof invoice>('/invoice', config),
      apiClient.get<typeof invoice, typeof invoice>('/invoice', config),
      apiClient.request<typeof invoice>({ url: '/invoice', ...config }),
      apiClient<typeof invoice>({ url: '/invoice', ...config }),
      apiClient<typeof invoice>('/invoice', config),
    ])
    results.forEach((result) => expect(result).toEqual(invoice))
  })

  it.each(['post', 'put', 'patch', 'postForm', 'putForm', 'patchForm', 'query'] as const)(
    '%s保留请求载荷并解包返回值', async (method) => {
      const inspect = vi.fn(adapter(envelope(invoice)))
      expect(await apiClient[method]<typeof invoice>('/invoice', { amount: invoice.amount }, {
        adapter: inspect, env: { FormData },
      })).toEqual(invoice)
      const [config] = inspect.mock.calls[0]!
      expect(config.method).toBe(method.replace('Form', '').toLowerCase())
      const data: unknown = config.data
      if (method.endsWith('Form')) {
        expect(data).toBeInstanceOf(FormData)
        if (data instanceof FormData) expect(data.get('amount')).toBe(invoice.amount)
      } else {
        expect(typeof data).toBe('string')
        if (typeof data === 'string') expect(JSON.parse(data)).toEqual({ amount: invoice.amount })
      }
    },
  )

  it.each(['delete', 'head', 'options'] as const)('%s返回body而非AxiosResponse', async (method) => {
    expect(await apiClient[method]<typeof invoice>('/invoice', { adapter: adapter(envelope(invoice)) })).toEqual(invoice)
  })

  it('Blob响应保持原对象，空body和数组不额外包装', async () => {
    const blob = new Blob(['original,123.40'], { type: 'text/csv' })
    expect(await apiClient.get<Blob>('/export', { responseType: 'blob', adapter: adapter(blob) })).toBe(blob)
    expect(await apiClient.get<null>('/empty', { adapter: adapter(envelope(null)) })).toBeNull()
    expect(await apiClient.delete<void>('/void', { adapter: adapter(undefined) })).toBeUndefined()
    expect(await apiClient.get<typeof invoice[]>('/list', { adapter: adapter(envelope([invoice])) })).toEqual([invoice])
  })

  it('保留认证/追踪请求头及可移除的请求与响应拦截器', async () => {
    vi.spyOn(token, 'getAuthorizationHeader').mockReturnValue('Bearer test-token')
    const inspect = vi.fn(adapter(envelope(invoice)))
    const onBody = vi.fn((body: unknown) => body)
    const requestId = apiClient.interceptors.request.use((config) => {
      config.headers.set('X-Test', 'client-contract')
      return config
    })
    const responseId = apiClient.interceptors.response.use(onBody)
    try {
      await apiClient.get<typeof invoice>('/invoice', { adapter: inspect })
      const [config] = inspect.mock.calls[0]!
      expect(config.headers.get('Authorization')).toBe('Bearer test-token')
      expect(config.headers.get('X-Request-Id')).toEqual(expect.any(String))
      expect(config.headers.get('X-Test')).toBe('client-contract')
      expect(onBody).toHaveBeenCalledWith(invoice)
    } finally {
      apiClient.interceptors.request.eject(requestId)
      apiClient.interceptors.response.eject(responseId)
    }
    await apiClient.get('/invoice', { adapter: inspect })
    expect(inspect.mock.calls[1]![0].headers.has('X-Test')).toBe(false)
    expect(onBody).toHaveBeenCalledOnce()
  })

  it('非OK业务错误仍拒绝，网络错误保持统一错误契约', async () => {
    const failure = { ...envelope(null), code: 'BUSINESS_REJECTED', message: '业务拒绝' }
    await expect(apiClient.post('/invoice', {}, { adapter: adapter(failure) })).rejects.toEqual(failure)
    await expect(apiClient.get('/offline', {
      adapter: async (config) => { throw new AxiosError('Network unavailable', 'ERR_NETWORK', config) },
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'Network unavailable' })
  })

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

  it('订货宝接口401时保留当前页面并返回业务错误', async () => {
    const clearSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(clearSession)
    window.location.hash = '#/supply-chain/order/orders'

    await expect(apiClient.get('/orders/dhb', {
      stayOnUnauthorized: true,
      adapter: gatewayUnauthorizedAdapter(),
    })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      response: { status: 401 },
    })

    expect(clearSession).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/supply-chain/order/orders')
  })

  it('BI接口401不误报订单服务故障，并保持当前查询页面', async () => {
    const clearSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(clearSession)
    window.location.hash = '#/supply-chain/bi'
    await expect(apiClient.get('/analytics/supply-dashboard/effective-scope', {
      stayOnUnauthorized: true,
      adapter: gatewayUnauthorizedAdapter(),
    })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: '当前请求未通过身份校验，请重新登录；若仍失败，请联系管理员检查服务认证配置',
      response: { status: 401 },
    })
    expect(clearSession).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/supply-chain/bi')
  })
})
