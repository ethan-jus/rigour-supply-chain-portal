export const platforms = [
  { id: 'android', name: 'Android', method: 'APK 安装包' },
  { id: 'ios', name: 'iPhone', method: 'iOS 安装' },
  { id: 'harmony', name: '鸿蒙原生版', method: 'HarmonyOS NEXT' },
] as const

export type PlatformId = (typeof platforms)[number]['id']
export type Release = { version: string; url: string }
export type Releases = Partial<Record<PlatformId, Release>>

export async function loadReleases(platform?: PlatformId): Promise<Releases> {
  const response = await fetch('/downloads/sales/releases.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('下载信息暂时无法加载')
  const manifest = await response.json()
  const releases: Releases = {}
  for (const { id } of platforms) {
    if (platform && platform !== id) continue
    const item = manifest[id]
    if (!item) continue
    if (typeof item.version !== 'string' || typeof item.url !== 'string' || !item.url.trim()) {
      throw new Error('版本信息不完整')
    }
    const target = new URL(item.url, location.origin)
    if (id === 'ios' && target.pathname.endsWith('.plist')) {
      if (target.protocol !== 'https:') throw new Error('iPhone 安装清单需要 HTTPS 地址')
      releases.ios = {
        version: item.version,
        url: 'itms-services://?action=download-manifest&url=' + encodeURIComponent(target.href),
      }
      continue
    }
    if (id === 'harmony') {
      if (target.protocol !== 'https:' || !target.pathname.endsWith('.json5')) {
        throw new Error('鸿蒙安装描述文件地址无效')
      }
      releases[id] = {
        version: item.version,
        url: 'store://enterprise/manifest?url=' + encodeURIComponent(target.href),
      }
      continue
    }
    if (
      target.protocol !== 'https:' &&
      !(target.protocol === 'http:' && target.origin === location.origin)
    ) {
      throw new Error('安装地址无效')
    }
    if (id === 'android' && target.origin === location.origin) {
      const apk = await fetch(target.href, { method: 'HEAD', cache: 'no-cache' })
      if (apk.status === 404 || apk.headers.get('content-type')?.includes('text/html')) continue
      if (!apk.ok) throw new Error('安装包暂时无法访问')
    }
    releases[id] = { version: item.version, url: target.href }
  }
  return releases
}

export function scanLink(platform: PlatformId): string {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  const origin = local ? import.meta.env.VITE_SALES_DOWNLOAD_ORIGIN : location.origin
  if (!origin) return ''
  const url = new URL('/sales-download/', origin)
  url.searchParams.set('platform', platform)
  return url.href
}
