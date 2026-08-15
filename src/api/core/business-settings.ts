import { apiClient } from './client'

/** 字典作用域：系统默认、业务模块默认或租户自定义。 */
export type DictScopeType = 'SYSTEM' | 'MODULE' | 'TENANT'

/** 字典及字典项使用的内部治理状态。 */
export type DictStatus = 'ACTIVE' | 'DISABLED'

/** 公共业务字典定义。 */
export interface BizDict {
  /** 字典主键。 */
  id: string
  /** 字典编码。 */
  code: string
  /** 字典中文名称。 */
  name: string
  /** 字典作用域。 */
  scopeType: DictScopeType
  /** 服务端计算的作用域标识。 */
  scopeId: string
  /** COMMON、ERP、CRM、ORDER等业务模块编码。 */
  moduleCode: string
  /** 租户级字典所属租户。 */
  tenantId: string | null
  /** 租户字典复制来源。 */
  baseDictId: string | null
  /** 字典治理状态。 */
  status: DictStatus
  /** 展示顺序。 */
  sortNo: number
  /** 维护说明。 */
  remark: string | null
  /** 乐观锁版本。 */
  version: number
  /** 整本字典内容版本；字典定义或任一条目变化时递增。 */
  revision: number
}

/** 公共业务字典项。 */
export interface BizDictItem {
  /** 字典项主键。 */
  id: string
  /** 所属字典主键。 */
  dictId: string
  /** 父字典项主键，根节点为空。 */
  parentId: string | null
  /** 服务端维护的树层级，根节点为1。 */
  levelNo: number
  /** 字典项业务编码。 */
  code: string
  /** 面向业务人员的显示名称。 */
  name: string
  /** 可选业务值。 */
  value: string | null
  /** 同级展示顺序。 */
  sortNo: number
  /** 字典项治理状态。 */
  status: DictStatus
  /** JSON格式的非核心展示扩展。 */
  extraJson: string | null
  /** 乐观锁版本。 */
  version: number
}

/** 新增或修改字典的请求。 */
export interface BizDictCommand {
  /** 字典编码；新增后不可修改。 */
  code: string
  /** 面向业务人员的字典名称。 */
  name: string
  /** 字典作用域；新增后不可修改。 */
  scopeType: DictScopeType
  /** 字典所属业务模块；新增后不可修改。 */
  moduleCode: string
  /** 租户级字典的租户ID；租户身份由服务端校验。 */
  tenantId: string | null
  /** 租户字典的可选复制来源。 */
  baseDictId: string | null
  /** 字典治理状态。 */
  status: DictStatus
  /** 字典展示顺序，数值越小越靠前。 */
  sortNo: number
  /** 字典用途和维护说明。 */
  remark: string | null
  /** 修改时的乐观锁版本；新增必须为0。 */
  version: number
}

/** 新增或修改字典项的请求，层级由服务端计算。 */
export interface BizDictItemCommand {
  /** 所属字典主键；必须与请求路径一致。 */
  dictId: string
  /** 父字典项主键；根节点为空。 */
  parentId: string | null
  /** 字典项业务编码。 */
  code: string
  /** 面向业务人员的显示名称。 */
  name: string
  /** 可选业务值；不用于保存第三方原始报文。 */
  value: string | null
  /** 同级展示顺序，数值越小越靠前。 */
  sortNo: number
  /** 字典项治理状态。 */
  status: DictStatus
  /** 颜色、图标、精度等非核心展示扩展，必须是合法JSON。 */
  extraJson: string | null
  /** 修改时的乐观锁版本；新增必须为0。 */
  version: number
}

/** 当前身份最终生效的整本字典。 */
export interface EffectiveBizDict {
  /** 按租户级、模块级、系统级优先级命中的字典。 */
  dictionary: BizDict
  /** 命中字典中全部启用的字典项。 */
  items: BizDictItem[]
}

const BASE_PATH = '/business-settings/dictionaries'

/** 查询当前身份可见的字典。 */
export function getBizDicts(params: {
  moduleCode?: string
  scopeType?: DictScopeType | ''
  tenantId?: string
  status?: DictStatus | ''
}) {
  return apiClient.get<BizDict[]>(BASE_PATH, { params, stayOnUnauthorized: true })
}

/** 查询指定字典的全部条目。 */
export function getBizDictItems(dictId: string) {
  return apiClient.get<BizDictItem[]>(`${BASE_PATH}/${dictId}/items`, {
    stayOnUnauthorized: true,
  })
}

/** 由服务端按 TENANT、MODULE、SYSTEM 优先级解析当前生效字典。 */
export function getEffectiveBizDict(moduleCode: string, code: string) {
  return apiClient.get<EffectiveBizDict>(`${BASE_PATH}/effective`, {
    params: { moduleCode, code },
    stayOnUnauthorized: true,
  })
}

/** 解析历史业务数据；返回启用和停用条目，避免旧记录失去显示名称。 */
export function resolveBizDict(moduleCode: string, code: string) {
  return apiClient.get<EffectiveBizDict>(`${BASE_PATH}/resolve`, {
    params: { moduleCode, code },
    stayOnUnauthorized: true,
  })
}

/** 新增字典。 */
export function createBizDict(command: BizDictCommand) {
  return apiClient.post<BizDict>(BASE_PATH, command)
}

/** 修改字典。 */
export function updateBizDict(dictId: string, command: BizDictCommand) {
  return apiClient.put<BizDict>(`${BASE_PATH}/${dictId}`, command)
}

/** 新增字典项。 */
export function createBizDictItem(dictId: string, command: BizDictItemCommand) {
  return apiClient.post<BizDictItem>(`${BASE_PATH}/${dictId}/items`, command)
}

/** 修改字典项。 */
export function updateBizDictItem(itemId: string, command: BizDictItemCommand) {
  return apiClient.put<BizDictItem>(`${BASE_PATH}/items/${itemId}`, command)
}
