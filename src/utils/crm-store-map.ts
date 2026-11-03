import { loadAmapJsApi } from './amap-js-api'
import type { StoreRow, StoreMapBounds } from '@/api/core/crm-store'
import { storeMapUrl } from './crm-store'

export type MapPosition = [number, number]
export interface StoreMarker {
  setzIndex(value: number): void
}
export interface StoreMapInstance {
  add(markers: StoreMarker[]): void
  remove(markers: StoreMarker[]): void
  clearMap(): void
  setFitView(
    markers: StoreMarker[],
    immediately?: boolean,
    padding?: number[],
    maxZoom?: number,
  ): void
  setZoomAndCenter(zoom: number, center: MapPosition): void
  getBounds(): {
    getSouthWest(): { getLng(): number; getLat(): number }
    getNorthEast(): { getLng(): number; getLat(): number }
  }
  getZoom(): number
  on(event: 'moveend' | 'zoomend' | 'resize', handler: () => void): void
  off(event: 'moveend' | 'zoomend' | 'resize', handler: () => void): void
  destroy(): void
}
export interface StoreMapSdk {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => StoreMapInstance
  Marker: new (options: Record<string, unknown>) => StoreMarker
  plugin(names: string[], callback: () => void): void
  DistrictLayer?: {
    Country: new (options: Record<string, unknown>) => StoreMarker
    Province: new (options: Record<string, unknown>) => StoreMarker
  }
  convertFrom(
    points: MapPosition[],
    type: 'gps',
    callback: (
      status: string,
      result: {
        locations?: { getLng(): number; getLat(): number }[]
      },
    ) => void,
  ): void
}
export async function loadStoreMapSdk(): Promise<StoreMapSdk> {
  return (await loadAmapJsApi()) as unknown as StoreMapSdk
}

export async function loadStoreDistrictLayers(sdk: StoreMapSdk) {
  if (sdk.DistrictLayer?.Country && sdk.DistrictLayer?.Province) return sdk.DistrictLayer
  return new Promise<NonNullable<StoreMapSdk['DistrictLayer']>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('行政区边界加载超时')), 10000)
    sdk.plugin(['AMap.DistrictLayer'], () => {
      clearTimeout(timer)
      if (sdk.DistrictLayer?.Country && sdk.DistrictLayer?.Province) resolve(sdk.DistrictLayer)
      else reject(new Error('行政区边界图层不可用'))
    })
  })
}

/** Convert only the display positions. Never overwrite the company's source coordinates. */
export async function storeMapPositions(
  sdk: StoreMapSdk,
  rows: Pick<StoreRow, 'id' | 'name' | 'longitude' | 'latitude' | 'coordinateSystem'>[],
) {
  const valid = rows.filter((row) => storeMapUrl(row))
  const positions = new Map<string, MapPosition>()
  valid
    .filter((row) => row.coordinateSystem === 'GCJ02')
    .forEach((row) => {
      positions.set(row.id, [Number(row.longitude), Number(row.latitude)])
    })
  const gps = valid.filter((row) => row.coordinateSystem === 'WGS84')
  if (!gps.length) return { positions, conversionFailed: false }
  const converted = await new Promise<MapPosition[] | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000)
    try {
      sdk.convertFrom(
        gps.map((row) => [Number(row.longitude), Number(row.latitude)]),
        'gps',
        (status, result) => {
          clearTimeout(timer)
          resolve(
            status === 'complete' && result.locations?.length === gps.length
              ? result.locations.map((p) => [p.getLng(), p.getLat()])
              : null,
          )
        },
      )
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
  converted?.forEach((point, index) => {
    if (point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
      positions.set(gps[index].id, point)
  })
  return { positions, conversionFailed: gps.some((row) => !positions.has(row.id)) }
}

export function storeMapViewport(map: StoreMapInstance): StoreMapBounds & { zoom: number } {
  const bounds = map.getBounds(),
    sw = bounds.getSouthWest(),
    ne = bounds.getNorthEast()
  // 世界视图跨越日期变更线时查询全经度，避免 west > east 产生空结果。
  const crosses = sw.getLng() > ne.getLng()
  return {
    west: crosses ? -180 : Math.max(-180, sw.getLng()),
    east: crosses ? 180 : Math.min(180, ne.getLng()),
    south: Math.max(-90, sw.getLat()),
    north: Math.min(90, ne.getLat()),
    zoom: Math.min(20, Math.max(2, map.getZoom())),
  }
}

/** Web Mercator bounds fitting; use the actual canvas size, including a newly mounted map. */
export function fitStoreMapBounds(bounds: StoreMapBounds, width: number, height: number) {
  const mercator = (latitude: number) => {
    const sin = Math.sin((Math.max(-85.051129, Math.min(85.051129, latitude)) * Math.PI) / 180)
    return Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  }
  const south = mercator(bounds.south),
    north = mercator(bounds.north)
  const spanX = Math.max((bounds.east - bounds.west) / 360, 1e-9)
  const spanY = Math.max(north - south, 1e-9)
  const zoom = Math.max(
    2,
    Math.min(
      16,
      Math.log2(
        Math.min(
          Math.max(1, width - 96) / (256 * spanX),
          Math.max(1, height - 112) / (256 * spanY),
        ),
      ),
    ),
  )
  const center: MapPosition = [
    (bounds.west + bounds.east) / 2,
    (Math.atan(Math.sinh((south + north) * Math.PI)) * 180) / Math.PI,
  ]
  return { zoom, center }
}

/** Offset only region labels; their map anchors and counts never change. */
export function layoutStoreMapLabels(
  labels: { x: number; y: number; width: number; height: number }[],
  width: number,
  height: number,
) {
  const placed: typeof labels = []
  return labels.map((label) => {
    if (
      label.x + label.width < 0 ||
      label.x > width ||
      label.y + label.height < 0 ||
      label.y > height
    )
      return { x: 0, y: 0 }
    let best = label,
      bestOverlap = Infinity
    // Search nearest free space first; retain every region even in an unusually crowded viewport.
    for (let radius = 0; radius <= 360; radius += 18) {
      const steps = radius === 0 ? 1 : 16
      for (let step = 0; step < steps; step++) {
        const angle = (step * Math.PI * 2) / steps
        const candidate = {
          ...label,
          x: Math.max(8, Math.min(width - label.width - 8, label.x + Math.cos(angle) * radius)),
          y: Math.max(8, Math.min(height - label.height - 8, label.y + Math.sin(angle) * radius)),
        }
        const overlap = placed.reduce(
          (sum, other) =>
            sum +
            Math.max(
              0,
              Math.min(candidate.x + candidate.width + 6, other.x + other.width + 6) -
                Math.max(candidate.x, other.x),
            ) *
              Math.max(
                0,
                Math.min(candidate.y + candidate.height + 6, other.y + other.height + 6) -
                  Math.max(candidate.y, other.y),
              ),
          0,
        )
        if (overlap < bestOverlap) {
          best = candidate
          bestOverlap = overlap
        }
        if (overlap === 0) break
      }
      if (bestOverlap === 0) break
    }
    placed.push(best)
    return { x: best.x - label.x, y: best.y - label.y }
  })
}
