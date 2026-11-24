import { afterEach, expect, it, vi } from 'vitest'
import { loadReleases, scanLink } from '@/utils/sales-downloads'

const android = { version: '0.2.18', url: '/downloads/sales/app.apk' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('offers published platforms and keeps the QR independent of the package version', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ android, ios: null, harmony: null }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  vi.stubEnv('VITE_SALES_DOWNLOAD_ORIGIN', 'http://192.168.1.8:5100')
  expect(await loadReleases()).toEqual({
    android: { version: android.version, url: location.origin + android.url },
  })
  expect(fetch.mock.calls[1]).toEqual([
    location.origin + android.url,
    { method: 'HEAD', cache: 'no-cache' },
  ])
  expect(scanLink('android')).toBe('http://192.168.1.8:5100/sales-download/?platform=android')
})

it.each([
  new Response(null, { status: 404 }),
  new Response(null, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
])(
  'suppresses a missing APK while keeping other released platforms available',
  async (response) => {
    const ios = { version: '1.0', url: 'https://testflight.apple.com/join/example' }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ android, ios }))
        .mockResolvedValueOnce(response),
    )
    expect(await loadReleases()).toEqual({ ios })
  },
)

it('reports a manifest load failure for retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))
  await expect(loadReleases()).rejects.toThrow()
})

it.each(['http://example.org/release.json5', 'https://example.org/app.hap'])(
  'rejects an unsupported Harmony descriptor URL %s',
  async (url) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ harmony: { version: '1', url } })),
    )
    await expect(loadReleases('harmony')).rejects.toThrow('鸿蒙安装描述文件地址无效')
  },
)
