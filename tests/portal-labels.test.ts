import { describe, expect, it } from 'vitest'
import {
  formatPortalActorScope,
  formatPortalApplicationScope,
  formatPortalAuditResult,
  formatPortalLaunchMode,
  formatPortalOrganizationType,
  formatPortalPublishStatus,
  formatPortalResourceType,
  formatPortalRoleType,
  formatPortalScopeType,
  formatPortalStatus,
  formatPortalTargetType,
} from '@/utils/portal-labels'

describe('Portal 管理枚举展示', () => {
  it('将状态、类型和方式转换成中文', () => {
    expect(formatPortalStatus('ACTIVE')).toBe('启用')
    expect(formatPortalStatus('SCHEDULED')).toBe('待生效')
    expect(formatPortalResourceType('API')).toBe('接口')
    expect(formatPortalRoleType('SYSTEM')).toBe('系统保护')
    expect(formatPortalScopeType('MY_STORES')).toBe('所属门店')
    expect(formatPortalApplicationScope('TENANT')).toBe('租户')
    expect(formatPortalLaunchMode('EXTERNAL_URL')).toBe('HTTPS 外链')
    expect(formatPortalOrganizationType('DEPARTMENT')).toBe('部门')
    expect(formatPortalPublishStatus('DRAFT')).toBe('草稿')
    expect(formatPortalActorScope('TENANT')).toBe('租户')
    expect(formatPortalTargetType('PACKAGE_VERSION')).toBe('套餐版本')
    expect(formatPortalAuditResult('SUCCESS')).toBe('成功')
  })

  it('未知值保留编码但使用中文兜底', () => {
    expect(formatPortalStatus('FUTURE')).toBe('未知状态（FUTURE）')
    expect(formatPortalScopeType('NEW_SCOPE')).toBe('未知数据范围（NEW_SCOPE）')
  })
})
