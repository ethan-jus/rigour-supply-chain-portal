/** Shares only in-flight reads. No business response survives completion or a mutation. */
export class QueryFlights {
  private epoch = 0
  private pending = new Map<string, Promise<unknown>>()
  invalidate() { this.epoch++; this.pending.clear() }
  run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const id = `${this.epoch}:${key}`
    const existing = this.pending.get(id) as Promise<T> | undefined
    if (existing) return existing.then(value => structuredClone(value))
    const result = load()
    if (this.pending.size < 256) this.pending.set(id, result)
    void result.finally(() => {
      if (this.pending.get(id) === result) this.pending.delete(id)
    }).catch(() => undefined)
    return result.then(value => structuredClone(value))
  }
}

export function stableQueryKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item))
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    return item
  })
}
