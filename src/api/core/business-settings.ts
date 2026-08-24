import { apiClient } from './client'

/** 字典定义；前端只展示后端 DictView 返回的字段。 */
export interface DictView {
  /** 字典主键。 */
  id: string
  /** 字典编码，调用方按该编码直接读取。 */
  dictionaryCode: string
  /** 面向业务人员的字典名称。 */
  dictionaryName: string
  /** 字典类型；用于后端归类，业务页面不按该字段做主视觉分组。 */
  dictionaryType: string | null
  /** 字典说明。 */
  remark: string | null
  /** 乐观锁版本。 */
  revision: number
}

/** 字典项；层级和父子关系由后端 View 明确返回。 */
export interface DictItemView {
  /** 字典项主键。 */
  id: string
  /** 所属字典编码。 */
  dictionaryCode: string
  /** 字典项层级，根节点为 1。 */
  dictionaryItemLevel: number
  /** 父字典项编码，根节点为空。 */
  parentDictionaryItemCode: string | null
  /** 字典项编码。 */
  dictionaryItemCode: string
  /** 面向业务人员的字典项名称。 */
  dictionaryItemName: string
  /** 字典项说明。 */
  remark: string | null
  /** 展示顺序。 */
  ordinal: number
  /** 乐观锁版本。 */
  revision: number
}

/** 新增或修改字典的请求；字段与后端 DictCommand 对齐。 */
export interface DictCommand {
  dictionaryCode: string
  dictionaryName: string
  dictionaryType: string | null
  remark: string | null
  revision: number
}

/** 新增或修改字典项的请求；字段与后端 DictItemCommand 对齐。 */
export interface DictItemCommand {
  dictionaryCode: string
  parentDictionaryItemCode: string | null
  dictionaryItemCode: string
  dictionaryItemName: string
  remark: string | null
  ordinal: number
  revision: number
}

/** 当前身份最终生效的整本字典。 */
export interface EffectiveDictView {
  dictionary: DictView
  items: DictItemView[]
}

const BASE_PATH = '/business-settings/dictionaries'

/** 查询当前身份可见的字典。 */
export function getBizDicts(params: {
  dictionaryType?: string
  dictionaryCode?: string
}) {
  return apiClient.get<DictView[]>(BASE_PATH, { params, stayOnUnauthorized: true })
}

/** 查询指定字典的全部条目。 */
export function getBizDictItems(dictId: string | number) {
  return apiClient.get<DictItemView[]>(`${BASE_PATH}/${encodeURIComponent(String(dictId))}/items`, {
    stayOnUnauthorized: true,
  })
}

/** 由服务端按当前身份解析最终生效字典。 */
export function getEffectiveBizDict(dictionaryCode: string) {
  return apiClient.get<EffectiveDictView>(`${BASE_PATH}/effective`, {
    params: { dictionaryCode },
    stayOnUnauthorized: true,
  })
}

/** 解析历史业务数据；返回可用于历史记录显示的整本字典。 */
export function resolveBizDict(dictionaryCode: string) {
  return apiClient.get<EffectiveDictView>(`${BASE_PATH}/resolve`, {
    params: { dictionaryCode },
    stayOnUnauthorized: true,
  })
}

/** 新增字典。 */
export function createBizDict(command: DictCommand) {
  return apiClient.post<DictView>(BASE_PATH, command)
}

/** 修改字典。 */
export function updateBizDict(dictId: string | number, command: DictCommand) {
  return apiClient.put<DictView>(`${BASE_PATH}/${encodeURIComponent(String(dictId))}`, command)
}

/** 新增字典项。 */
export function createBizDictItem(dictId: string | number, command: DictItemCommand) {
  return apiClient.post<DictItemView>(`${BASE_PATH}/${encodeURIComponent(String(dictId))}/items`, command)
}

/** 修改字典项。 */
export function updateBizDictItem(itemId: string | number, command: DictItemCommand) {
  return apiClient.put<DictItemView>(`${BASE_PATH}/items/${encodeURIComponent(String(itemId))}`, command)
}
