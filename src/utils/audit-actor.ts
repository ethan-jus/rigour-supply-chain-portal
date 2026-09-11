const systemActorLabels: Record<string, string> = {
  SYSTEM: '系统同步',
  system: '系统同步',
  DHB_SYNC: '系统同步',
  '019fb700-0000-7000-8000-00000000d0b0': '系统同步',
}

export function auditActorLabel(value: string | null | undefined): string {
  const normalized = value?.trim()
  if (!normalized) return '-'
  return systemActorLabels[normalized] || systemActorLabels[normalized.toUpperCase()] || normalized
}
