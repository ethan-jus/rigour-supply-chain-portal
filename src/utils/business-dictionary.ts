import { reactive } from 'vue'
import {
  resolveBizDict,
  type BizDictItem,
  type EffectiveBizDict,
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
  items: BizDictItem[]
}

const snapshots = reactive<Record<string, DictionarySnapshot>>({})
const requests = new Map<string, Promise<void>>()

function normalizedKey(moduleCode: string, code: string) {
  return `${moduleCode.trim().toUpperCase()}.${code.trim().toUpperCase()}`
}

function snapshot(moduleCode: string, code: string): DictionarySnapshot {
  const key = normalizedKey(moduleCode, code)
  return snapshots[key] ??= { loading: false, loaded: false, failed: false, items: [] }
}

function applySnapshot(target: DictionarySnapshot, result: EffectiveBizDict) {
  target.items = [...result.items]
    .filter((item) => item.value !== null && item.value.trim() !== '')
    .sort((left, right) => left.sortNo - right.sortNo || left.code.localeCompare(right.code))
  target.loaded = true
  target.failed = false
}

/**
 * 批量预载业务页面需要的字典。单本字典失败不会阻断业务数据查询，
 * 页面会明确展示“字典未配置”，不会回退到前端猜测映射。
 */
export async function loadBusinessDictionaries(refs: BusinessDictionaryRef[]): Promise<void> {
  const unique = new Map(refs.map((item) => [normalizedKey(item.moduleCode, item.code), item]))
  await Promise.all([...unique.entries()].map(async ([key, item]) => {
    const current = snapshot(item.moduleCode, item.code)
    if (current.loaded || requests.has(key)) return requests.get(key)
    current.loading = true
    current.failed = false
    const request = resolveBizDict(item.moduleCode, item.code)
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

function findItem(items: BizDictItem[], rawValue: string) {
  const exact = items.find((item) => item.value === rawValue)
  if (exact) return exact
  const normalized = rawValue.toUpperCase()
  const matches = items.filter((item) => item.value?.toUpperCase() === normalized)
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
  if (item) return item.name
  if (current.loading) return `字典加载中（${rawValue}）`
  return `${subject}未配置（${rawValue}）`
}

/** 返回启用字典项，供筛选器与业务表格共用同一份服务端配置。 */
export function businessDictionaryOptions(moduleCode: string, code: string): BusinessDictionaryOption[] {
  return snapshot(moduleCode, code).items
    .filter((item) => item.status === 'ACTIVE' && item.value !== null)
    .map((item) => ({ label: item.name, value: item.value as string }))
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
  items: Array<Pick<BizDictItem, 'code' | 'name' | 'value' | 'status' | 'sortNo'>>,
) {
  const current = snapshot(moduleCode, code)
  current.items = items.map((item, index) => ({
    id: `test-${index}`,
    dictId: 'test-dict',
    parentId: null,
    levelNo: 1,
    extraJson: null,
    version: 0,
    ...item,
  }))
  current.loaded = true
  current.loading = false
  current.failed = false
}
