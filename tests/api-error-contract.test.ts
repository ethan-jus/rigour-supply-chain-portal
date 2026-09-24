import { afterEach, describe, expect, it, vi } from 'vitest'
import { Blob as NativeBlob } from 'node:buffer'
afterEach(() => vi.unstubAllGlobals())
import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/api/core/client'
import { ApiError } from '@/api/core/error'
import { requestFailureNotices } from '@/utils/request-feedback'

const failure = (status: number, data: unknown, headers = {}) => async (config: InternalAxiosRequestConfig) => {
  throw new AxiosError('raw transport error', 'ERR_BAD_RESPONSE', config, undefined,
    { status, statusText: 'error', data, headers, config })
}

describe('统一错误协议', () => {
  it.each([400, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503, 504])('裸 HTTP %s 保留状态并显示安全中文信息', async status => {
    const error = await apiClient.get('/test', {
      adapter: failure(status, '<html>proxy internal secret</html>', { 'x-request-id': 'server-trace' }),
    }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status, requestId: 'server-trace', response: { status } })
    expect(String(error)).not.toMatch(/secret|raw transport|NETWORK_ERROR|object Object/)
  })

  it('业务错误保留字段详情，未知服务器异常不泄露内部消息', async () => {
    await expect(apiClient.post('/test', {}, { adapter: failure(400, {
      code: 'VALIDATION_FAILED', message: '参数错误', requestId: 'validation',
      details: [{ field: 'code', message: '编码必填' }],
    }) })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: '参数错误', details: [{ field: 'code', message: '编码必填' }] })
    await expect(apiClient.get('/test', { adapter: failure(500, { code: 'UNKNOWN_SERVER', message: 'SQL secret' }) }))
      .rejects.toMatchObject({ status: 500, message: '服务器处理失败，请稍后重试' })
  })

  it('下载失败的 JSON Blob 也可显示业务原因', async () => {
    vi.stubGlobal('Blob', NativeBlob)
    const blob = new Blob([JSON.stringify({ code: 'EXPORT_REJECTED', message: '导出范围过大', requestId: 'export' })], { type: 'application/json' })
    await expect(apiClient.get('/export', { responseType: 'blob', adapter: failure(400, blob) }))
      .rejects.toMatchObject({ status: 400, code: 'EXPORT_REJECTED', message: '导出范围过大', requestId: 'export' })
  })

  it('超时与断网分别提示，取消请求不产生通知', async () => {
    for (const [transport, code] of [['ECONNABORTED', 'REQUEST_TIMEOUT'], ['ERR_NETWORK', 'NETWORK_ERROR']]) {
      await expect(apiClient.get('/test', { adapter: async config => { throw new AxiosError('raw', transport, config) } }))
        .rejects.toMatchObject({ code })
    }
    const before = JSON.stringify(requestFailureNotices.value)
    await expect(apiClient.get('/test', { adapter: async () => { throw new CanceledError() } })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(JSON.stringify(requestFailureNotices.value)).toBe(before)
  })

  it('协商统一响应外壳并保留分页载荷', async () => {
    const page = { items: [{ code: 'ORDER' }], total: 1 }
    const data = await apiClient.get('/test', { adapter: async config => {
      expect(config.headers.Accept).toContain('application/vnd.rigour.api+json')
      return { status: 200, statusText: 'OK', headers: {}, config,
        data: { code: 'OK', message: 'success', data: page, requestId: 'ok', timestamp: new Date().toISOString() } }
    } })
    expect(data).toEqual(page)
  })
})
