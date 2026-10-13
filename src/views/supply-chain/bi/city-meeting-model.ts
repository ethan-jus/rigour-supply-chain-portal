import { personalGoal } from './sales-dashboard-model'
import { aggregateGoals } from './overview-model'
import { businessDate } from '@/utils/business-date'
import type { MeetingSnapshot } from './meeting-model'
import { finite, meetingMetric, rate } from './meeting-model'

export function customerRetention(snapshot: MeetingSnapshot | null) {
  const source = snapshot?.analysis?.customerRetention
  const ready = meetingMetric(snapshot?.current, 'cooperated_customer_count') != null
  const customers = ready ? finite(source?.orderingCustomerCount) : null
  const returning = ready
    ? finite(
        isAnnualCity(snapshot)
          ? source?.annualReturningCustomerCount
          : source?.returningCustomerCount,
      )
    : null
  // Unknown history must not be substituted with the older in-period two-orders metric.
  return { customers, returning, rate: rate(returning, customers) }
}

export function isAnnualCity(snapshot: MeetingSnapshot | null) {
  return (
    !!snapshot &&
    businessDate(snapshot.query.from || snapshot.current.from).slice(0, 7) !==
      businessDate(snapshot.query.to || snapshot.current.to).slice(0, 7)
  )
}
export function cityGoals(snapshot: MeetingSnapshot | null) {
  return aggregateGoals(
    snapshot?.analysis ?? null,
    !snapshot || isAnnualCity(snapshot)
      ? null
      : Number(businessDate(snapshot.query.from || snapshot.current.from).slice(5, 7)),
  )
}
export function cityMeetingRows(snapshot: MeetingSnapshot | null) {
  if (!snapshot) return []
  const data = snapshot.current
  const salesReady = meetingMetric(data, 'sales_amount') != null
  const receiptsReady =
    meetingMetric(data, 'receipt_amount') != null && snapshot.analysis?.cityReceipts != null
  const orders = new Map(data.citySalesRanking.map((row) => [row.dimensionCode, row]))
  const receipts = new Map(
    (snapshot.analysis?.cityReceipts || []).map((row) => [row.regionCode, row]),
  )
  const targets = data.cityTargetCompletions || []
  const goals = cityGoals(snapshot)
  const codes = new Set(
    goals
      ? goals.cities.keys()
      : [...orders.keys(), ...receipts.keys(), ...targets.map((row) => row.dimensionCode)],
  )
  return [...codes].map((code) => {
    const order = orders.get(code)
    const receipt = receipts.get(code)
    const target = (metric: string) => {
      const row = targets.find((item) => item.dimensionCode === code && item.metricCode === metric)
      return row && row.targetValue > 0 ? finite(row.targetValue) : null
    }
    const sales = salesReady ? (order ? finite(order.salesAmount) : 0) : null
    const received = receiptsReady ? (receipt ? finite(receipt.receiptAmount) : 0) : null
    const salesTarget = goals?.cities.get(code)?.sales ?? target('SALES_AMOUNT')
    const receiptTarget = goals?.cities.get(code)?.receipt ?? target('RECEIPT_AMOUNT')
    return {
      code,
      name:
        order?.dimensionName ||
        receipt?.regionName ||
        goals?.cities.get(code)?.name ||
        targets.find((t) => t.dimensionCode === code)?.dimensionName ||
        '归属待核对',
      sales,
      receipts: received,
      orders: salesReady ? (order ? finite(order.orderCount) : 0) : null,
      salesTarget,
      receiptTarget,
      salesRate: rate(sales, salesTarget),
      receiptRate: rate(received, receiptTarget),
      selectable: !['UNKNOWN', 'MULTI', 'OUTSIDE_CITY', ''].includes(code.trim().toUpperCase()),
    }
  })
}
export type CityMeetingRow = ReturnType<typeof cityMeetingRows>[number]
export function rankCities(rows: CityMeetingRow[], metric: 'sales' | 'receipts' | 'orders') {
  return [...rows].sort(
    (a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity) || a.code.localeCompare(b.code),
  )
}

/** The snapshot is already city/scoped by the server. Never use cohort paid as cash inflow. */
export function citySalesRows(snapshot: MeetingSnapshot | null, receipt: boolean, annual: boolean) {
  if (!snapshot) return []
  const salesReady = meetingMetric(snapshot.current, 'sales_amount') != null
  const paidReady = meetingMetric(snapshot.current, 'paid_amount') != null
  const cashReady =
    meetingMetric(snapshot.current, 'receipt_amount') != null &&
    snapshot.analysis?.salesReceipts != null
  const sales = new Map(snapshot.current.salesRanking.map((row) => [row.dimensionCode, row]))
  const receipts = new Map(
    (snapshot.analysis?.salesReceipts || []).map((row) => [row.ownerStaffCode, row]),
  )
  const people = new Map(
    [
      ...(snapshot.previousAnalysis?.salesPeople || []),
      ...(snapshot.analysis?.salesPeople || []),
    ].map((row) => [row.ownerStaffCode, row]),
  )
  const previousSales = new Map(
    (snapshot.previous?.salesRanking || []).map((row) => [row.dimensionCode, row]),
  )
  const previousReceipts = new Map(
    (snapshot.previousAnalysis?.salesReceipts || []).map((row) => [row.ownerStaffCode, row]),
  )
  const previousReady = receipt
    ? meetingMetric(snapshot.previous, 'receipt_amount') != null &&
      snapshot.previousAnalysis?.salesReceipts != null
    : meetingMetric(snapshot.previous, 'sales_amount') != null
  const targets = snapshot.current.salesTargetCompletions || []
  const codes = new Set([
    ...people.keys(),
    ...previousSales.keys(),
    ...previousReceipts.keys(),
    ...sales.keys(),
    ...receipts.keys(),
    ...targets.map((row) => row.dimensionCode),
  ])
  return [...codes]
    .filter((code) => !['', 'UNKNOWN', 'MULTI'].includes(code.trim().toUpperCase()))
    .map((code) => {
      const order = sales.get(code),
        cash = receipts.get(code)
      const configured = targets.find(
        (row) =>
          row.dimensionCode === code &&
          row.metricCode === (receipt ? 'RECEIPT_AMOUNT' : 'SALES_AMOUNT'),
      )
      const configuredValue = finite(configured?.targetValue)
      const effective = snapshot.personalGoals
        ? personalGoal(
            snapshot.personalGoals,
            code,
            receipt ? 'RECEIPT_AMOUNT' : 'SALES_AMOUNT',
            annual
              ? null
              : Number(businessDate(snapshot.query.from || snapshot.current.from).slice(5, 7)),
          )
        : null
      const target =
        snapshot.personalGoals === null
          ? null
          : effective
            ? effective.value
            : configured?.periodMonthCount === (annual ? 12 : 1)
              ? configuredValue
              : null
      return {
        code,
        name:
          order?.dimensionName ||
          cash?.ownerStaffName ||
          people.get(code)?.ownerStaffName ||
          configured?.dimensionName ||
          previousSales.get(code)?.dimensionName ||
          previousReceipts.get(code)?.ownerStaffName ||
          code,
        employmentStatus: people.get(code)?.employmentStatus,
        amount: receipt
          ? cashReady
            ? cash
              ? finite(cash.paidAmount)
              : 0
            : null
          : salesReady
            ? order
              ? finite(order.salesAmount)
              : 0
            : null,
        previous: previousReady
          ? receipt
            ? finite(previousReceipts.get(code)?.paidAmount ?? 0)
            : finite(previousSales.get(code)?.salesAmount ?? 0)
          : null,
        paid: paidReady ? (order ? finite(order.paidAmount) : 0) : null,
        target,
      }
    })
    .filter((row) => !(row.employmentStatus === 'LEFT' && row.amount === 0))
    .sort(
      (a, b) => (b.amount ?? -Infinity) - (a.amount ?? -Infinity) || a.code.localeCompare(b.code),
    )
}
