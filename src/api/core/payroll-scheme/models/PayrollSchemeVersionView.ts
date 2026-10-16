import type { PayrollSchemeDefinition } from './PayrollSchemeDefinition'

export interface PayrollSchemeVersionView {
  id: string
  schemeId: string
  version: number
  revision: number
  status: string
  definition: PayrollSchemeDefinition
  reason: string
  createdBy: string
  publishedBy: string
  updatedTime: string
  stopFrom?: string | null
  publishedTime: string
}
