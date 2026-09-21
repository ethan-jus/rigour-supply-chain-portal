import { reactive } from 'vue'

export interface ColumnSetting {
  key: string
  label: string
  /** 默认是否显示，缺省为 true。 */
  defaultVisible?: boolean
  /** 锁定列不可隐藏。 */
  locked?: boolean
}

const STORAGE_PREFIX = 'scdp.column-settings.v1'

/** 表格列显示偏好：按页面隔离持久化到本地，新列自动回退到默认值。 */
export function useColumnSettings(storageKey: string, columns: ColumnSetting[]) {
  const storageName = `${STORAGE_PREFIX}.${storageKey}`
  const visibility = reactive<Record<string, boolean>>(resolve())

  function resolve(): Record<string, boolean> {
    const stored = loadStored()
    const result: Record<string, boolean> = {}
    for (const column of columns) {
      const fallback = column.locked ? true : column.defaultVisible !== false
      const value = stored[column.key]
      result[column.key] = column.locked ? true : typeof value === 'boolean' ? value : fallback
    }
    return result
  }

  function loadStored(): Record<string, unknown> {
    try {
      const raw = window.localStorage.getItem(storageName)
      if (!raw) return {}
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(storageName, JSON.stringify({ ...visibility }))
    } catch {
      // 本地存储不可用时仅当前会话生效
    }
  }

  function isVisible(key: string): boolean {
    return visibility[key] !== false
  }

  function setVisible(key: string, visible: boolean) {
    const column = columns.find((item) => item.key === key)
    if (!column || column.locked) return
    visibility[key] = visible
    persist()
  }

  function reset() {
    for (const column of columns) {
      visibility[column.key] = column.locked ? true : column.defaultVisible !== false
    }
    persist()
  }

  return { columns, visibility, isVisible, setVisible, reset }
}
