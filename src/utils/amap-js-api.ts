/** CRM与销售轨迹统一使用后台的浏览器端配置；不读取或下发后端Web服务Key。 */
interface AmapJsApi {
  Map: new (...args: never[]) => unknown
}

export function isAmapJsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_AMAP_JS_KEY?.trim())
}

let sdkPromise: Promise<AmapJsApi> | null = null
let loadAttempt = 0

export function loadAmapJsApi(): Promise<AmapJsApi> {
  if (typeof (window.AMap as AmapJsApi | undefined)?.Map === 'function')
    return Promise.resolve(window.AMap as AmapJsApi)
  if (sdkPromise) return sdkPromise
  const key = import.meta.env.VITE_AMAP_JS_KEY?.trim()
  if (!key) return Promise.reject(new Error('地图暂未配置，请联系管理员。'))
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim()
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode }
  sdkPromise = new Promise<AmapJsApi>((resolve, reject) => {
    const script = document.createElement('script')
    const callbackName = `__rigourAmapReady${++loadAttempt}`
    const callbacks = window as unknown as Record<string, unknown>
    const fail = (message = '地图加载失败，请重试。') => {
      clearTimeout(timer)
      script.remove()
      delete callbacks[callbackName]
      reject(new Error(message))
    }
    const timer = setTimeout(() => fail(), 15000)
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&callback=${callbackName}`
    script.async = true
    script.onerror = () => fail()
    // The async bootstrap's load event can precede AMap.Map. Wait for the SDK callback.
    callbacks[callbackName] = (result?: { status?: string; info?: string }) => {
      clearTimeout(timer)
      delete callbacks[callbackName]
      if (result?.status === '0') {
        fail(
          result.info === 'USER_KEY_RECYCLED'
            ? '地图服务密钥已失效，请管理员更新配置。'
            : '地图服务暂不可用，请联系管理员检查配置。',
        )
        return
      }
      if (typeof (window.AMap as AmapJsApi | undefined)?.Map === 'function')
        resolve(window.AMap as AmapJsApi)
      else fail()
    }
    document.head.appendChild(script)
  }).catch((error) => {
    sdkPromise = null
    throw error
  })
  return sdkPromise
}
