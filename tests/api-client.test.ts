import { describe, expect, it } from 'vitest'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { apiClient } from '@/api'

function adapter(data: unknown) {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => ({
    data, status: 200, statusText: 'OK', headers: {}, config,
  } as AxiosResponse)
}

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
})
