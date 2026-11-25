import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'

const markup = readFileSync('sales-download/index.html', 'utf8')

afterEach(() => {
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

async function openPage(platform: string) {
  vi.resetModules()
  document.documentElement.innerHTML = markup
  history.replaceState(null, '', '/sales-download/?platform=' + platform)
  await import('../src/sales-download-page')
}

it('opens a direct Android download from the stable landing page', async () => {
  const url = '/downloads/sales/test.apk'
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ android: { version: '1.0', url } }))
      .mockResolvedValueOnce(new Response(null)),
  )
  await openPage('android')
  const link = document.querySelector<HTMLAnchorElement>('#download')!
  await vi.waitFor(() => expect(link.hidden).toBe(false))
  expect(link.href).toBe(location.origin + url)
  expect(link.hasAttribute('download')).toBe(true)
  expect(document.querySelector('#status')?.textContent).toContain('1.0')
})

it('opens the HTTPS installation manifest on a registered iPhone', async () => {
  const url = 'https://download.example.org/sales/218/manifest.plist?build=218'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ios: { version: '0.2.18', url } })))
  await openPage('ios')
  const link = document.querySelector<HTMLAnchorElement>('#download')!
  await vi.waitFor(() => expect(link.hidden).toBe(false))
  expect(link.href).toBe('itms-services://?action=download-manifest&url=' + encodeURIComponent(url))
  expect(document.querySelector('#help')?.textContent).toContain('已登记的测试 iPhone')
})

it.each(['ios', 'harmony', 'unknown'])('hides the install link for unavailable %s', async (id) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
  await openPage(id)
  await vi.waitFor(() =>
    expect(document.querySelector('#status')?.textContent).toMatch(/暂未开放|入口无效/),
  )
  expect(document.querySelector<HTMLAnchorElement>('#download')?.hidden).toBe(true)
})

it('opens a forwarded Harmony link with no session or login request', async () => {
  const url = 'https://download.example.org/sales/v1/manifest.json5'
  const fetch = vi.fn().mockResolvedValue(Response.json({ harmony: { version: '1.0', url } }))
  vi.stubGlobal('fetch', fetch)
  await openPage('harmony')
  const link = document.querySelector<HTMLAnchorElement>('#download')!
  await vi.waitFor(() => expect(link.hidden).toBe(false))
  expect(link.href).toBe('store://enterprise/manifest?url=' + encodeURIComponent(url))
  expect(document.querySelector('#help')?.textContent).toContain('华为浏览器')
  expect(document.querySelector('form')).toBeNull()
  expect(fetch.mock.calls).toEqual([['/downloads/sales/releases.json', { cache: 'no-store' }]])
})
