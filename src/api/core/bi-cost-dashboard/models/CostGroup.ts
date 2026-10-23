export interface CostGroup {
  key: string
  label: string
  current: string
  previous: string | null
  delta: string | null
  growth: string | null
  share: string | null
  count: number
  missing: boolean
}
