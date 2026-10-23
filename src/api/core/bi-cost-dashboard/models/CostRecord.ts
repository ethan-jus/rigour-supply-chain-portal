import type { CostCategory } from './CostCategory'

export interface CostRecord {
  costMonth?: string
  periodBasis?: 'MONTH' | 'DAY'
  costTreatment?: 'DIRECT' | 'LINKED' | 'REVIEW'
  source: string
  sourceId: string
  documentNo: string
  title: string
  category: CostCategory
  city: string
  cityName: string
  date: string
  amount: string | null
  status: string
  payment: string
  sourceSystem: string | null
  employeeName: string | null
}
