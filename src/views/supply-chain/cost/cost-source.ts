import type { CostRecord, CostExternalDocument, CostSource } from '@/api/core/cost'

export const externalSourceName = (system: string | null | undefined) =>
  system === 'DHB' || system === 'DINGHUOBAO'
    ? '订货宝'
    : system === 'MANUAL'
      ? '纸质或人工单据'
      : system === 'SYSTEM' || !system
        ? '本系统'
        : system === 'UNKNOWN'
          ? '来源待核对'
          : '其他系统'

export function externalDocuments(row: CostRecord): CostExternalDocument[] {
  if (row.data.logistics) return row.data.logistics.externalDocuments ?? []
  if (row.data.goods?.externalDocument) return [row.data.goods.externalDocument]
  return row.data.externalDocuments ?? []
}

export function sourceLabel(source: CostSource): string {
  return `${externalSourceName(source.sourceSystem ?? 'UNKNOWN')} · 已关联`
}

export function costSourceLabel(row: CostRecord): string {
  const docs = externalDocuments(row)
  const linked = new Set(docs.filter((d) => d.linkedId).map((d) => d.linkedId))
  const labels = [
    ...(row.sources || []).filter((s) => !linked.has(s.id)).map(sourceLabel),
    ...docs.map(
      (d) => `${externalSourceName(d.sourceSystem)} · ${d.linkedId ? '已关联本系统' : '手工补录'}`,
    ),
  ]
  return labels.length ? [...new Set(labels)].join('；') : '手工登记 · 无来源单据'
}

export function costSourceNumbers(row: CostRecord): string {
  const documents = externalDocuments(row)
  const linked = new Set(documents.filter((d) => d.linkedId).map((d) => d.linkedId))
  return [
    ...(row.sources || [])
      .filter((s) => !linked.has(s.id))
      .map((s) => s.originalNo || s.documentNo),
    ...documents.map((d) => d.documentNo),
  ]
    .filter(Boolean)
    .join('；')
}
