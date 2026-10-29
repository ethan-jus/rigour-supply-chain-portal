import type { AdminArea, StoreRow } from '@/api/core/crm-store'

export const GEO_REGIONS: Record<string, string> = {
  NORTH: '华北',
  NORTHEAST: '东北',
  EAST: '华东',
  CENTRAL: '华中',
  SOUTH: '华南',
  SOUTHWEST: '西南',
  NORTHWEST: '西北',
}
const municipalities = new Set(['110000', '120000', '310000', '500000'])

/** Only the authority-filtered catalog may enter these selectors. Parent labels do not grant scope. */
export function storeAreaOptions(
  areas: AdminArea[],
  region: string,
  province: string,
  city: string,
) {
  const index = new Map(areas.map((a) => [a.code, a]))
  const provinceOf = (a: AdminArea) => {
    const visited = new Set<string>()
    let node: AdminArea | undefined = a
    while (node && node.level !== 'PROVINCE' && !visited.has(node.code)) {
      visited.add(node.code)
      node = index.get(node.parentCode ?? '')
    }
    return node?.level === 'PROVINCE' ? node : undefined
  }
  const provinces = areas.filter(
    (a) => a.level === 'PROVINCE' && (!region || a.regionCode === region),
  )
  const provinceSet = new Set(provinces.map((a) => a.code))
  const permitted = (a: AdminArea) => {
    const p = provinceOf(a)
    return !!p && provinceSet.has(p.code) && (!province || p.code === province)
  }
  return {
    regions: [
      ...new Set(
        areas
          .filter((a) => a.level === 'PROVINCE')
          .map((a) => a.regionCode)
          .filter((c): c is string => !!c),
      ),
    ],
    provinces,
    cities: areas.filter(
      (a) => (a.level === 'PREFECTURE' || municipalities.has(a.code)) && permitted(a),
    ),
    counties: areas.filter(
      (a) => a.level === 'COUNTY' && permitted(a) && (!city || a.parentCode === city),
    ),
  }
}

/** The company coordinates drive the marker; POI availability is not required. */
export function storeMapUrl(
  store: Pick<StoreRow, 'name' | 'longitude' | 'latitude' | 'coordinateSystem'>,
): string | null {
  const { longitude, latitude, coordinateSystem } = store
  if (
    longitude == null ||
    latitude == null ||
    !Number.isFinite(Number(longitude)) ||
    !Number.isFinite(Number(latitude)) ||
    Math.abs(Number(longitude)) > 180 ||
    Math.abs(Number(latitude)) > 90 ||
    !['GCJ02', 'WGS84'].includes(coordinateSystem ?? '')
  )
    return null
  const params = new URLSearchParams({
    position: `${longitude},${latitude}`,
    name: store.name,
    coordinate: coordinateSystem === 'WGS84' ? 'wgs84' : 'gaode',
    callnative: '0',
    src: 'rigour-crm',
  })
  return `https://uri.amap.com/marker?${params.toString()}`
}

export function remainingTime(time: string | null, now = Date.now()): string {
  if (!time || !Number.isFinite(Date.parse(time))) return '—'
  const minutes = Math.ceil((Date.parse(time) - now) / 60000)
  if (minutes <= 0) return '已到期，待核验'
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.ceil(minutes / 60)
  return hours <= 48 ? `${hours}小时` : `${Math.ceil(hours / 24)}天`
}
