import { computed, ref, watch, type Ref } from 'vue'

export type CostEntryMode = 'LINKED' | 'MANUAL'

/** 仅缓存当前编辑会话的两份输入；业务模型始终只保存当前录入方式的数据。 */
export function useCostEntryMode<T extends object, S extends Partial<T>>(
  record: Ref<T>,
  options: {
    empty: S
    isLinked: (value: S) => boolean
    hasName: (value: S) => boolean
    toManual: (value: S) => S
  },
) {
  const current = ref<CostEntryMode>('LINKED')
  let drafts: Partial<Record<CostEntryMode, S>> = {}
  const snapshot = () =>
    Object.fromEntries(
      Object.keys(options.empty).map((key) => [key, record.value[key as keyof T]]),
    ) as S

  // 父级打开另一条记录时重置缓存，不能把上一条记录的名称或关联关系带入。
  watch(
    record,
    () => {
      const value = snapshot()
      current.value = options.isLinked(value) || !options.hasName(value) ? 'LINKED' : 'MANUAL'
      drafts = { [current.value]: value }
    },
    { immediate: true },
  )

  return computed<CostEntryMode>({
    get: () => current.value,
    set: (mode) => {
      if (mode === current.value) return
      const previous = snapshot()
      drafts[current.value] = previous
      const next = drafts[mode] ?? (mode === 'MANUAL' ? options.toManual(previous) : options.empty)
      current.value = mode
      Object.assign(record.value, next)
    },
  })
}
