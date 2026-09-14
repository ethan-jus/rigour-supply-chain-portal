import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { apiClient, registerUnauthorizedSessionHandler } from '@/api'
import * as token from '@/utils/token'

function adapter(data: unknown) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    data, status: 200, statusText: 'OK', headers: {}, config,
  })
}

function okApiResponseAdapter(data: unknown) {
  return adapter({
    code: 'OK', message: 'success', data,
    requestId: 'request-ok', timestamp: '2026-08-17T00:00:00Z',
  })
}

function unauthorizedAdapter(options: {
  marker?: string
  bodyCode?: string
  path?: string
  status?: number
} = {}) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const status = options.status || 401
    const data = options.bodyCode
      ? {
          code: options.bodyCode, message: '请求未授权', data: null,
          requestId: 'request-401', timestamp: '2026-08-17T00:00:00Z',
        }
      : {
          timestamp: '2026-08-17T00:00:00Z', status,
          error: 'Unauthorized', path: options.path || config.url,
        }
    const response = {
      data,
      status,
      statusText: 'Unauthorized',
      headers: options.marker ? { 'x-rigour-auth-failure': options.marker } : {},
      config,
    }
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response)
  }
}

const originalDefaultAdapter = apiClient.defaults.adapter
let unregisterUnauthorizedHandler: (() => void) | undefined

afterEach(() => {
  apiClient.defaults.adapter = originalDefaultAdapter
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
      adapter: okApiResponseAdapter({ id: 'tenant-1' }),
    })
    expect(response).toEqual({ id: 'tenant-1' })
  })
})

describe('API 401分类与会话恢复', () => {
  it('IAM_TOKEN_INVALID即使请求声明stayOnUnauthorized也必须恢复会话', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)

    await expect(apiClient.get('/orders/sales', {
      stayOnUnauthorized: true,
      adapter: unauthorizedAdapter({ marker: 'IAM_TOKEN_INVALID' }),
    })).rejects.toMatchObject({
      code: 'IAM_TOKEN_INVALID',
      response: { status: 401 },
    })

    expect(recoverSession).toHaveBeenCalledOnce()
  })

  it('兼容旧IAM_UNAUTHORIZED JSON code并恢复会话', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)

    await expect(apiClient.get('/expired-session', {
      adapter: unauthorizedAdapter({ bodyCode: 'IAM_UNAUTHORIZED' }),
    })).rejects.toMatchObject({ code: 'IAM_TOKEN_INVALID' })

    expect(recoverSession).toHaveBeenCalledOnce()
  })

  it('兼容旧IAM_INVALID_TOKEN JSON code并恢复会话', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)

    await expect(apiClient.get('/expired-session', {
      adapter: unauthorizedAdapter({ bodyCode: 'IAM_INVALID_TOKEN' }),
    })).rejects.toMatchObject({ code: 'IAM_TOKEN_INVALID' })

    expect(recoverSession).toHaveBeenCalledOnce()
  })

  it('TRUSTED_CONTEXT_INVALID保留当前页且不误判Token失效', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)
    window.location.hash = '#/supply-chain/order/sales-orders?tab=pending'

    await expect(apiClient.get('/orders/sales', {
      adapter: unauthorizedAdapter({ marker: 'TRUSTED_CONTEXT_INVALID' }),
    })).rejects.toMatchObject({
      code: 'TRUSTED_CONTEXT_INVALID',
      response: { status: 401 },
    })

    expect(recoverSession).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/supply-chain/order/sales-orders?tab=pending')
  })

  it.each([
    ['IAM_FORBIDDEN', 403],
    ['IAM_SESSION_CHECK_UNAVAILABLE', 503],
  ])('%s响应头marker保留结构化错误且不清理会话', async (marker, status) => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)

    await expect(apiClient.get('/portal/navigation/SUPPLY_CHAIN', {
      adapter: unauthorizedAdapter({ marker, status }),
    })).rejects.toMatchObject({ code: marker, response: { status } })

    expect(recoverSession).not.toHaveBeenCalled()
  })

  it('裸业务401并发时single-flight复核/me，会话有效则保留页面', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)
    let releaseProbe: (() => void) | undefined
    const probeGate = new Promise<void>((resolve) => { releaseProbe = resolve })
    const probeAdapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      await probeGate
      return okApiResponseAdapter({ id: 'u-1' })(config)
    })
    apiClient.defaults.adapter = probeAdapter

    const first = apiClient.get('/business/one', { adapter: unauthorizedAdapter() })
    const second = apiClient.get('/business/two', { adapter: unauthorizedAdapter() })
    await vi.waitFor(() => expect(probeAdapter).toHaveBeenCalledOnce())
    releaseProbe?.()

    const results = await Promise.allSettled([first, second])
    expect(results).toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'BUSINESS_UNAUTHORIZED' }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'BUSINESS_UNAUTHORIZED' }),
      }),
    ])
    expect(recoverSession).not.toHaveBeenCalled()
  })

  it('/me明确返回TRUSTED_CONTEXT_INVALID时裸业务401仍保留当前页', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)
    apiClient.defaults.adapter = unauthorizedAdapter({ marker: 'TRUSTED_CONTEXT_INVALID' })

    await expect(apiClient.get('/business/orders', {
      adapter: unauthorizedAdapter(),
    })).rejects.toMatchObject({ code: 'BUSINESS_UNAUTHORIZED' })

    expect(recoverSession).not.toHaveBeenCalled()
  })

  it('/me裸401时视为Token失效并且只恢复一次', async () => {
    const recoverSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(recoverSession)
    apiClient.defaults.adapter = unauthorizedAdapter()

    const results = await Promise.allSettled([
      apiClient.get('/business/one', { adapter: unauthorizedAdapter() }),
      apiClient.get('/business/two', { adapter: unauthorizedAdapter() }),
    ])

    expect(results).toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'IAM_TOKEN_INVALID' }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'IAM_TOKEN_INVALID' }),
      }),
    ])
    expect(recoverSession).toHaveBeenCalledOnce()
  })

  it('BI接口401不误报订单服务故障，并保持当前查询页面', async () => {
    const clearSession = vi.fn()
    unregisterUnauthorizedHandler = registerUnauthorizedSessionHandler(clearSession)
    window.location.hash = '#/supply-chain/bi'
    await expect(apiClient.get('/analytics/supply-dashboard/effective-scope', {
      stayOnUnauthorized: true,
      adapter: unauthorizedAdapter(),
    })).rejects.toMatchObject({
      code: 'BUSINESS_UNAUTHORIZED',
      message: '当前业务接口暂时无法访问，请稍后重试；如持续出现，请提供请求 ID 排查',
      response: { status: 401 },
    })
    expect(clearSession).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/supply-chain/bi')
  })
})
