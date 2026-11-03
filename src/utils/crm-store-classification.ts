import type { CascaderOption } from 'element-plus'
import type { DictItemView } from '@/api/core/business-settings'

interface ClassificationOption extends CascaderOption {
  value: string
  label: string
  disabled: boolean
  children?: ClassificationOption[]
}

export function storeClassificationCatalog(items: DictItemView[], includeDisabled = false) {
  const byCode = new Map(items.map((item) => [item.dictionaryItemCode, item]))
  const paths = new Map<string, string>()
  const options = new Map<string, ClassificationOption>()
  for (const item of items) {
    const chain: DictItemView[] = []
    let current: DictItemView | undefined = item
    const seen = new Set<string>()
    while (current && !seen.has(current.dictionaryItemCode)) {
      chain.unshift(current)
      seen.add(current.dictionaryItemCode)
      current = current.parentDictionaryItemCode
        ? byCode.get(current.parentDictionaryItemCode)
        : undefined
    }
    if (current || chain[0]?.parentDictionaryItemCode) continue
    paths.set(item.dictionaryItemCode, chain.map((entry) => entry.dictionaryItemName).join(' / '))
    if (!item.canonicalItemCode)
      options.set(item.dictionaryItemCode, {
        value: item.dictionaryItemCode,
        label: item.dictionaryItemName,
        disabled:
          !includeDisabled &&
          chain.some((entry) => entry.enabled === false || !!entry.canonicalItemCode),
      })
  }
  const roots: ClassificationOption[] = []
  for (const item of [...items].sort((a, b) => a.ordinal - b.ordinal)) {
    const node = options.get(item.dictionaryItemCode)
    if (!node) continue
    const parent = item.parentDictionaryItemCode ? options.get(item.parentDictionaryItemCode) : null
    if (parent) (parent.children ??= []).push(node)
    else if (!item.parentDictionaryItemCode) roots.push(node)
  }
  return { options: roots, paths, byCode }
}
