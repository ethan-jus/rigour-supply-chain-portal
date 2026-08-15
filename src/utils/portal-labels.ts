type LabelValue = string | number | boolean | null | undefined

function mapLabel(value: LabelValue, labels: Record<string, string>, unknown: string): string {
  if (value === null || value === undefined || value === '') return '-'
  const normalized = String(value).trim()
  if (!normalized) return '-'
  if (/[\u3400-\u9fff]/.test(normalized)) return normalized
  return labels[normalized.toUpperCase()] || `${unknown}（${normalized}）`
}

export function formatPortalStatus(value: LabelValue): string {
  return mapLabel(value, {
    ACTIVE: '启用', ENABLED: '启用', INACTIVE: '停用', DISABLED: '停用',
    LOCKED: '锁定', SUSPENDED: '暂停', EXPIRED: '已过期', CLOSED: '已关闭',
    PENDING: '待处理', RUNNING: '运行中', PAUSED: '已暂停', FAILED: '失败',
    SUCCESS: '成功', SUCCEEDED: '成功', COMPLETED: '已完成', COMPLETE: '已完成',
    SCHEDULED: '待生效', TERMINATED: '已终止', DRAFT: '草稿', PUBLISHED: '已发布',
    ARCHIVED: '已归档',
  }, '未知状态')
}

export function formatPortalResourceType(value: LabelValue): string {
  return mapLabel(value, {
    APPLICATION: '应用', MENU: '目录', PAGE: '页面', BUTTON: '按钮', API: '接口',
  }, '未知资源类型')
}

export function formatPortalRoleType(value: LabelValue): string {
  return mapLabel(value, { SYSTEM: '系统保护', CUSTOM: '自定义' }, '未知角色类型')
}

export function formatPortalScopeType(value: LabelValue): string {
  return mapLabel(value, {
    SELF: '本人', MY_STORES: '所属门店', MY_CITY: '所属城市', MY_REGION: '所属区域', ALL: '全部',
  }, '未知数据范围')
}

export function formatPortalApplicationScope(value: LabelValue): string {
  return mapLabel(value, { PLATFORM: '平台', TENANT: '租户' }, '未知应用范围')
}

export function formatPortalApplicationType(value: LabelValue): string {
  return mapLabel(value, { INTERNAL: '内部', EXTERNAL: '外部' }, '未知应用类型')
}

export function formatPortalLaunchMode(value: LabelValue): string {
  return mapLabel(value, {
    INTERNAL_ROUTE: '内部路由', OIDC_CLIENT: 'OIDC 客户端', EXTERNAL_URL: 'HTTPS 外链',
    FEISHU_DEEPLINK: '飞书', SSO_PROVIDER: '外部 SSO',
  }, '未知启动方式')
}

export function formatPortalOrganizationType(value: LabelValue): string {
  return mapLabel(value, {
    COMPANY: '公司', REGION: '区域', CITY: '城市', DEPARTMENT: '部门', TEAM: '团队',
  }, '未知组织类型')
}

export function formatPortalStaffType(value: LabelValue): string {
  return mapLabel(value, {
    SALES: '销售', SALESMAN: '销售', MANAGER: '管理员', ADMIN: '管理员',
    FINANCE: '财务', PURCHASING: '采购', WAREHOUSE: '仓库', OTHER: '其他',
  }, '未知员工类型')
}

export function formatPortalPublishStatus(value: LabelValue): string {
  return mapLabel(value, { DRAFT: '草稿', PUBLISHED: '已发布', ARCHIVED: '已归档' }, '未知发布状态')
}

export function formatPortalActorScope(value: LabelValue): string {
  return mapLabel(value, { PLATFORM: '平台', TENANT: '租户', SYSTEM: '系统' }, '未知主体范围')
}

export function formatPortalTargetType(value: LabelValue): string {
  return mapLabel(value, {
    APPLICATION: '应用', RESOURCE: '资源', MENU: '菜单', USER: '用户', ROLE: '角色',
    ORGANIZATION: '组织', PACKAGE: '套餐', PACKAGE_VERSION: '套餐版本', SUBSCRIPTION: '订阅',
    DATA_SCOPE: '数据范围', DICTIONARY_TYPE: '字典类型', DICTIONARY_ITEM: '字典条目', SETTING: '系统设置',
  }, '未知目标类型')
}

export function formatPortalAuditResult(value: LabelValue): string {
  return mapLabel(value, { SUCCESS: '成功', SUCCEEDED: '成功', FAILURE: '失败', FAILED: '失败' }, '未知审计结果')
}

export function formatPortalColumnValue(key: string, value: LabelValue): string {
  switch (key) {
    case 'status': return formatPortalStatus(value)
    case 'scope': return formatPortalApplicationScope(value)
    case 'type': return formatPortalApplicationType(value)
    case 'launchMode': return formatPortalLaunchMode(value)
    case 'organizationType': return formatPortalOrganizationType(value)
    default: return value === null || value === undefined || value === '' ? '-' : String(value)
  }
}
