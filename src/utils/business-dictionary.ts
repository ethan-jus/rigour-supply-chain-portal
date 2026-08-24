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
  loading: boolean
  loaded: boolean
  failed: boolean
  items: DictItemView[]
}

const snapshots = reactive<Record<string, DictionarySnapshot>>({})
const requests = new Map<string, Promise<void>>()

function normalizedKey(_moduleCode: string, code: string) {
  return code.trim().toUpperCase()
}

function snapshot(moduleCode: string, code: string): DictionarySnapshot {
  const key = normalizedKey(moduleCode, code)
  return snapshots[key] ??= { loading: false, loaded: false, failed: false, items: [] }
}

function applySnapshot(target: DictionarySnapshot, result: EffectiveDictView) {
  target.items = [...result.items]
    .filter((item) => item.dictionaryItemCode.trim() !== '')
    .sort((left, right) => left.ordinal - right.ordinal || left.dictionaryItemCode.localeCompare(right.dictionaryItemCode))
  target.loaded = true
  target.failed = false
}

/**
 * 批量预载业务页面需要的字典。单本字典失败不会阻断业务数据查询，
 * 页面展示遵循“后端字典优先、源值兜底”。
 */
export async function loadBusinessDictionaries(refs: BusinessDictionaryRef[]): Promise<void> {
  const unique = new Map(refs.map((item) => [normalizedKey(item.moduleCode, item.code), item]))
  await Promise.all([...unique.entries()].map(async ([key, item]) => {
    const current = snapshot(item.moduleCode, item.code)
    if (current.loaded || requests.has(key)) return requests.get(key)
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
        requests.delete(key)
      })
    requests.set(key, request)
    return request
  }))
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
export function businessDictionaryOptions(moduleCode: string, code: string): BusinessDictionaryOption[] {
  return snapshot(moduleCode, code).items
    .map((item) => ({ label: item.dictionaryItemName, value: item.dictionaryItemCode }))
}

/** 非枚举业务文本只做空值处理，不翻译、不猜测。 */
export function sourceText(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized || '-'
}

/** 测试隔离入口；生产代码不应主动清空已加载快照。 */
export function clearBusinessDictionariesForTest() {
  Object.keys(snapshots).forEach((key) => delete snapshots[key])
  requests.clear()
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
  current.loaded = true
  current.loading = false
  current.failed = false
}
