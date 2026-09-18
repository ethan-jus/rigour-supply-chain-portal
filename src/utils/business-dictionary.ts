import { reactive } from 'vue'
import {
  resolveBizDict,
  type DictItemView,
  type EffectiveDictView,
} from '@/api/core/business-settings'

/** 业务页面需要解析的服务端字典。 */
export interface BusinessDictionaryRef {
  moduleCode: string
  code: string
}

export interface BusinessDictionaryOption {
  label: string
  value: string
}

interface DictionarySnapshot {
  loadedAt: number
  loading: boolean
  loaded: boolean
  failed: boolean
  items: DictItemView[]
}

const snapshots = reactive<Record<string, DictionarySnapshot>>({})
const requests = new Map<string, Promise<void>>()
let tenantContext = '',
  generation = 0
/** 登录身份切换时清空租户字典，迟到的旧请求只能写入已废弃对象。 */
export function setBusinessDictionaryTenant(tenantId?: string | null) {
  const next = tenantId ?? ''
  if (next !== tenantContext) {
    tenantContext = next
    clearBusinessDictionaries()
  }
}
export function clearBusinessDictionaries() {
  generation++
  Object.keys(snapshots).forEach((key) => delete snapshots[key])
  requests.clear()
}
export async function refreshBusinessDictionary(code: string) {
  const key = normalizedKey('', code)
  delete snapshots[key]
  requests.delete(key)
  await loadBusinessDictionaries([{ moduleCode: '', code }])
}

function normalizedKey(_moduleCode: string, code: string) {
  return `${tenantContext}:${generation}:${code.trim().toUpperCase()}`
}

function snapshot(moduleCode: string, code: string): DictionarySnapshot {
  const key = normalizedKey(moduleCode, code)
  return (snapshots[key] ??= {
    loadedAt: 0,
    loading: false,
    loaded: false,
    failed: false,
    items: [],
  })
}

function applySnapshot(target: DictionarySnapshot, result: EffectiveDictView) {
  const seen = new Set<string>()
  target.items = [...result.items]
    .filter((item) => item.dictionaryItemCode.trim() !== '')
    .sort(
      (left, right) =>
        left.ordinal - right.ordinal ||
        left.dictionaryItemCode.localeCompare(right.dictionaryItemCode),
    )
    .filter((item) => {
      const key = item.dictionaryItemCode.trim().toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  target.loadedAt = Date.now()
  target.loaded = true
  target.failed = false
}

/**
 * 批量预载业务页面需要的字典。单本字典失败不会阻断业务数据查询，
 * 页面展示遵循“后端字典优先、源值兜底”。
 */
export async function loadBusinessDictionaries(refs: BusinessDictionaryRef[]): Promise<void> {
  const unique = new Map(refs.map((item) => [normalizedKey(item.moduleCode, item.code), item]))
  await Promise.all(
    [...unique.entries()].map(async ([key, item]) => {
      const current = snapshot(item.moduleCode, item.code)
      if ((current.loaded && Date.now() - current.loadedAt < 60_000) || requests.has(key))
        return requests.get(key)
      current.loading = true
      current.failed = false
      const request = resolveBizDict(item.code)
        .then((result) => applySnapshot(current, result))
        .catch(() => {
          current.items = []
          current.loaded = false
          current.failed = true
        })
        .finally(() => {
          current.loading = false
          if (requests.get(key) === request) requests.delete(key)
        })
      requests.set(key, request)
      return request
    }),
  )
}

function findItem(items: DictItemView[], rawValue: string) {
  const exact = items.find((item) => item.dictionaryItemCode === rawValue)
  if (exact) return exact
  const normalized = rawValue.toUpperCase()
  const matches = items.filter((item) => item.dictionaryItemCode.toUpperCase() === normalized)
  return matches.length === 1 ? matches[0] : undefined
}

/** 从当前租户最终生效的服务端字典解析显示名称。 */
export function businessDictionaryLabel(
  moduleCode: string,
  code: string,
  value: string | number | null | undefined,
  subject = '字典值',
): string {
  if (value === null || value === undefined || value === '') return '-'
  const rawValue = String(value).trim()
  if (!rawValue) return '-'
  const current = snapshot(moduleCode, code)
  const item = findItem(current.items, rawValue)
  if (item) return item.dictionaryItemName
  void subject
  return rawValue
}

/** 返回启用字典项，供筛选器与业务表格共用同一份服务端配置。 */
export function businessDictionaryOptions(
  moduleCode: string,
  code: string,
): BusinessDictionaryOption[] {
  const items = snapshot(moduleCode, code).items
  // 每条父链独立检查，历史标签仍可读取完整 items。
  const byCode = new Map(items.map((item) => [item.dictionaryItemCode, item]))
  return items
    .filter((item) => {
      const seen = new Set<string>()
      let current: DictItemView | undefined = item
      while (current) {
        if (current.enabled === false || current.canonicalItemCode || seen.has(current.dictionaryItemCode)) return false
        seen.add(current.dictionaryItemCode)
        if (current.parentDictionaryItemCode && !byCode.has(current.parentDictionaryItemCode))
          return false
        current = current.parentDictionaryItemCode
          ? byCode.get(current.parentDictionaryItemCode)
          : undefined
      }
      return true
    })
    .map((item) => ({ label: item.dictionaryItemName, value: item.dictionaryItemCode }))
}

/** 非枚举业务文本只做空值处理，不翻译、不猜测。 */
export function sourceText(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized || '-'
}

/** 治理保存后重载当前租户已读取的字典；旧请求只能更新废弃快照。 */
export async function refreshBusinessDictionaries(): Promise<void> {
  const codes = Object.keys(snapshots).map((key) => key.slice(key.lastIndexOf(':') + 1))
  clearBusinessDictionaries()
  await loadBusinessDictionaries(codes.map((code) => ({ moduleCode: '', code })))
}

/** 测试隔离入口。 */
export function clearBusinessDictionariesForTest() {
  clearBusinessDictionaries()
}

/** 测试装载入口，用于验证所有展示函数确实读取服务端字典快照。 */
export function seedBusinessDictionaryForTest(
  moduleCode: string,
  code: string,
  items: Array<{
    code?: string
    name?: string
    value?: string | null
    status?: string
    sortNo?: number
    dictionaryItemCode?: string
    dictionaryItemName?: string
    ordinal?: number
  }>,
) {
  const current = snapshot(moduleCode, code)
  current.items = items.map((item, index) => ({
    id: `test-${index}`,
    dictionaryCode: code,
    dictionaryItemLevel: 1,
    parentDictionaryItemCode: null,
    dictionaryItemCode: item.dictionaryItemCode || item.value || item.code || '',
    dictionaryItemName: item.dictionaryItemName || item.name || item.value || item.code || '',
    remark: null,
    ordinal: item.ordinal ?? item.sortNo ?? index,
    revision: 0,
  }))
  current.loadedAt = Date.now()
  current.loaded = true
  current.loading = false
  current.failed = false
}
