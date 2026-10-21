import type { PayrollRecord } from '../../payroll'

export interface PayrollBatchItem {
  record: PayrollRecord
  status: 'WAITING' | 'SKIPPED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED'
  message: string
}
