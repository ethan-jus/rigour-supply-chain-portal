import { loadAmapJsApi } from './amap-js-api'
import type { StoreRow } from '@/api/core/crm-store'
import { storeMapUrl } from './crm-store'

export type MapPosition = [number, number]
export interface StoreMarker {
  setzIndex(value: number): void
}
export interface StoreMapInstance {
  add(markers: StoreMarker[]): void
  clearMap(): void
  setFitView(
    markers: StoreMarker[],
    immediately?: boolean,
    padding?: number[],
    maxZoom?: number,
  ): void
  setZoomAndCenter(zoom: number, center: MapPosition): void
  destroy(): void
}
export interface StoreMapSdk {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => StoreMapInstance
  Marker: new (options: Record<string, unknown>) => StoreMarker
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

/** Convert only the display positions. Never overwrite the company's source coordinates. */
export async function storeMapPositions(sdk: StoreMapSdk, rows: StoreRow[]) {
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
