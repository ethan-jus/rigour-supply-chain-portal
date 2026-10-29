import { afterEach, expect, it, vi } from 'vitest'
import type { StoreMapSdk } from '@/utils/crm-store-map'

afterEach(() => {
  delete window.AMap
  document.head
    .querySelectorAll('script[src*="webapi.amap.com/maps"]')
    .forEach((script) => script.remove())
  vi.unstubAllEnvs()
})
it('异步地图脚本的load事件不代表SDK可用，等待官方callback后才能创建地图', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_AMAP_JS_KEY', 'test-key-not-a-secret')
  const { loadStoreMapSdk } = await import('@/utils/crm-store-map')
  let ready = false
  const result = loadStoreMapSdk().then((sdk) => {
    ready = true
    return sdk
  })
  const script = document.head.querySelector<HTMLScriptElement>(
    'script[src*="webapi.amap.com/maps"]',
  )!
  script.dispatchEvent(new Event('load'))
  await Promise.resolve()
  expect(ready).toBe(false)
  const sdk = { Map: class {} } as unknown as StoreMapSdk
  window.AMap = sdk
  const callbackName = new URL(script.src).searchParams.get('callback')!
  ;(window as unknown as Record<string, () => void>)[callbackName]()
  expect(await result).toBe(sdk)
  expect(ready).toBe(true)
})
it('Key被回收时显示可处理的提示，不把密钥或服务原始响应显示到页面', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_AMAP_JS_KEY', 'test-key-not-a-secret')
  const { loadStoreMapSdk } = await import('@/utils/crm-store-map')
  const result = loadStoreMapSdk()
  const rejected = expect(result).rejects.toThrow('地图服务密钥已失效')
  const script = document.head.querySelector<HTMLScriptElement>(
    'script[src*="webapi.amap.com/maps"]',
  )!
  const callbackName = new URL(script.src).searchParams.get('callback')!
  ;(window as unknown as Record<string, (result: unknown) => void>)[callbackName]({
    status: '0',
    info: 'USER_KEY_RECYCLED',
    key: 'not-for-display',
  })
  await rejected
})

it('CRM与销售共用一个SDK加载请求和后台浏览器配置，忽略后端Web服务Key', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_AMAP_JS_KEY', 'shared-browser-key')
  vi.stubEnv('RIGOUR_AMAP_WEB_KEY', 'server-key-must-stay-private')
  const { loadAmapJsApi } = await import('@/utils/amap-js-api')
  const { loadStoreMapSdk } = await import('@/utils/crm-store-map')
  const sales = loadAmapJsApi()
  const crm = loadStoreMapSdk()
  const scripts = document.head.querySelectorAll<HTMLScriptElement>(
    'script[src*="webapi.amap.com/maps"]',
  )
  expect(scripts).toHaveLength(1)
  const url = new URL(scripts[0].src)
  expect(url.searchParams.get('key')).toBe('shared-browser-key')
  expect(scripts[0].src).not.toContain('server-key-must-stay-private')
  const sdk = { Map: class {} } as unknown as StoreMapSdk
  window.AMap = sdk
  ;(window as unknown as Record<string, () => void>)[url.searchParams.get('callback')!]()
  expect(await crm).toBe(await sales)
})
