export interface NavigationNode {
  id: string
  parentId: string | null
  code: string
  type: 'MENU' | 'PAGE'
  displayName: string
  permissionCode: string | null
  routeKey: string
  routePath: string | null
  iconKey: string | null
  sortOrder: number
  visible: boolean
  keepAlive: boolean
  children: NavigationNode[]
}

export interface ApplicationRecord {
  id: string; code: string; name: string; scope: string; type: string; iconKey: string | null
  sortOrder: number; launchMode: string; targetUri: string | null; status: string; version: number
}
export interface ResourceRecord {
  id: string; applicationId: string; parentId: string | null; code: string; type: string
  permissionCode: string | null; displayName: string; sortOrder: number; status: string
  routeKey: string | null; routePath: string | null; iconKey: string | null
  visible: boolean; keepAlive: boolean; version: number
}
export interface TenantMenuRecord {
  resourceId: string; applicationId: string; applicationCode: string; applicationName: string
  parentId: string | null; code: string; type: 'MENU' | 'PAGE'
  originalDisplayName: string; displayName: string
  originalSortOrder: number; sortOrder: number
  originalIconKey: string | null; iconKey: string | null
  platformVisible: boolean; visible: boolean; parentGroupId: string | null
  configured: boolean; version: number
}
export interface TenantMenuGroupRecord {
  id: string; applicationId: string; applicationCode: string; applicationName: string
  parentId: string | null; code: string; displayName: string; iconKey: string | null
  sortOrder: number; visible: boolean; status: string; version: number
}
export interface TenantRecord {
  id: string; code: string; companyName: string; status: string; policyVersion: number; version: number
}
export interface SubscriptionRecord {
  id: string; tenantId: string; packageVersionId: string; packageName: string; versionNo: number
  effectiveFrom: string; effectiveTo: string; userLimit: number; status: string; version: number
}
export interface PackageRecord {
  id: string; code: string; name: string; description: string | null; status: string; version: number
}
export interface PackageVersionRecord {
  id:string;packageId:string;versionNo:number;publishStatus:string;defaultUserLimit:number
  changeNote:string|null;version:number;resourceIds:string[]
}
export interface OrganizationRecord {
  id: string; parentId: string | null; code: string; name: string; type: string
  path: string; sortOrder: number; status: string; version: number
}
export interface UserRecord {
  id: string; username: string; displayName: string; status: string
  securityVersion: number; version: number; roleIds: string[]
  organizationIds: string[]
}
export interface RoleRecord {
  id: string; code: string; name: string; type: string; status: string; version: number; resourceIds: string[]
}
export interface DataScopeRecord {
  id: string; roleId: string; applicationId: string; scopeKey: string
  scopeType: string; status: string; version: number
}
export interface SettingRecord { key: string; valueJson: string; version: number }
export interface DictionaryTypeRecord {
  id: string; tenantId: string | null; code: string; name: string
  description: string | null; status: string; version: number
}
export interface DictionaryItemRecord {
  id: string; typeId: string; tenantId: string | null; code: string; label: string
  value: string | null; sortOrder: number; status: string; version: number
}
export interface AuditRecord {
  id: string; tenantId: string | null; actorScope: string; actorId: string | null
  action: string; targetType: string; targetId: string | null; result: string; occurredAt: string
}
