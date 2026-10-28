import { computed, shallowRef } from 'vue'
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'

// Separate buffers prevent a row copy from replacing the last copied group, and vice versa.
const group = shallowRef<PayrollMetricStep[] | null>(null)
const interval = shallowRef<PayrollMetricStep | null>(null)
export const hasCopiedPayrollIntervalGroup = computed(() => group.value !== null)
export const hasCopiedPayrollInterval = computed(() => interval.value !== null)

function clone(row: PayrollMetricStep): PayrollMetricStep {
  return {
    lower: row.lower,
    upper: row.upper,
    lowerInclusive: row.lowerInclusive,
    upperInclusive: row.upperInclusive,
    mode: row.mode,
    coefficient: row.coefficient,
  }
}

export function copyPayrollIntervalGroup(steps: PayrollMetricStep[]) {
  group.value = steps.length ? steps.map(clone) : null
}
export function readCopiedPayrollIntervalGroup(): PayrollMetricStep[] | null {
  return group.value?.map(clone) ?? null
}
export function copyPayrollInterval(row: PayrollMetricStep) {
  interval.value = clone(row)
}
export function readCopiedPayrollInterval(): PayrollMetricStep | null {
  return interval.value ? clone(interval.value) : null
}
/** Copies live for the current page session and must not survive an identity change. */
export function clearPayrollIntervalCopies() {
  group.value = null
  interval.value = null
}
