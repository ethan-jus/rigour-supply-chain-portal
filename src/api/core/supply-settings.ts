import { apiClient } from '@/api'

export const SUPPLY_SETTINGS_BASE = '/management/supply'
export interface SupplyContext {
  initialized: boolean
  canInitialize: boolean
  mode: 'PREPARING' | 'ACTIVE'
  version: number
  permissions: string[]
}
export interface SupplyMenuNode {
  id: string
  parentId: string | null
  type: 'MENU' | 'PAGE' | 'BUTTON'
  resourceId: string | null
  name: string
  iconKey: string | null
  sortOrder: number
  visible: boolean
  status: 'ACTIVE' | 'DISABLED'
  protectedNode: boolean
  version: number
  resourceCode: string | null
  permissionCode: string | null
  routeKey: string | null
  routePath: string | null
  componentPath: string | null
}
export type SupplyMenuCommand = Pick<
  SupplyMenuNode,
  | 'parentId'
  | 'type'
  | 'resourceId'
  | 'name'
  | 'iconKey'
  | 'sortOrder'
  | 'visible'
  | 'status'
  | 'version'
  | 'routeKey'
  | 'routePath'
  | 'componentPath'
  | 'permissionCode'
>
export interface MenuImpact {
  id: string
  version: number
  roleNames: string[]
  userCount: number
  childCount: number
}
export interface SettingsAudit {
  id: string
  actor: string
  action: string
  targetId: string
  result: string
  summary: string
  occurredAt: string
}
export interface SettingsAuditPage {
  items: SettingsAudit[]
  total: number
  page: number
  pageSize: number
}
export interface SupplyPermissionPreview {
  userId: string
  username: string
  applicationVersion: number
  permissions: string[]
  selectedAction: string | null
  unavailableReason: string | null
  policy: null | {
    employeeCode: string | null
    functionAllowed: boolean
    clauses: {
      roleId: string
      objectType: string
      scopeMode: string
      departments: { mode: string; references: string[] }
      regions: { mode: string; references: string[] }
      warehouses: { mode: string; references: string[] }
      includeDescendants: boolean
    }[]
    regionLimit: { mode: string; references: string[] }
    warehouseLimit: { mode: string; references: string[] }
  }
}
export const supplySettingsApi = {
  permissionPreview: (userId: string, action?: string) =>
    apiClient.get(SUPPLY_SETTINGS_BASE + '/permission-preview', {
      params: { userId, action },
    }) as Promise<SupplyPermissionPreview>,
  context: () => apiClient.get(SUPPLY_SETTINGS_BASE + '/context') as Promise<SupplyContext>,
  initialize: () => apiClient.post(SUPPLY_SETTINGS_BASE + '/initialize') as Promise<SupplyContext>,
  menus: () => apiClient.get(SUPPLY_SETTINGS_BASE + '/menus') as Promise<SupplyMenuNode[]>,
  catalog: () => apiClient.get(SUPPLY_SETTINGS_BASE + '/menu-catalog') as Promise<SupplyMenuNode[]>,
  saveMenu: (id: string | null, data: SupplyMenuCommand) =>
    (id
      ? apiClient.put(SUPPLY_SETTINGS_BASE + '/menus/' + encodeURIComponent(id), data)
      : apiClient.post(SUPPLY_SETTINGS_BASE + '/menus', data)) as Promise<SupplyMenuNode>,
  menuImpact: (id: string) =>
    apiClient.get(
      SUPPLY_SETTINGS_BASE + '/menus/' + encodeURIComponent(id) + '/impact',
    ) as Promise<MenuImpact>,
  deleteMenu: (id: string, version: number, revokeGrants: boolean) =>
    apiClient.delete(SUPPLY_SETTINGS_BASE + '/menus/' + encodeURIComponent(id), {
      params: { version, revokeGrants },
    }),
  audits: (params: { action?: string; keyword?: string; page: number; pageSize: number }) =>
    apiClient.get(SUPPLY_SETTINGS_BASE + '/audits', { params }) as Promise<SettingsAuditPage>,
}

export type ScopeDimension = 'DEPARTMENT' | 'REGION' | 'WAREHOUSE'
export interface ScopeReference {
  key: string
  name: string
  parentKey: string | null
  status: string
  revision: number
}
export interface ScopeRule {
  id: string | null
  actionCode: string
  objectType: string
  scopeMode: string
  departmentMode: string
  regionMode: string
  warehouseMode: string
  includeDescendants: boolean
  references: Partial<Record<ScopeDimension, string[]>>
}
export interface RoleDataScope {
  mode: 'ALL' | 'CUSTOM' | 'DEPARTMENT' | 'SELF'
  departmentIds: string[]
}
export interface SupplyRole {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  protectedRole: boolean
  version: number
  userCount: number
  menuNodeIds: string[]
  rules: ScopeRule[]
  dataScope?: RoleDataScope | null
}
export type SupplyRoleCommand = Pick<
  SupplyRole,
  'code' | 'name' | 'description' | 'status' | 'version' | 'menuNodeIds' | 'rules'
> & { dataScope: RoleDataScope }

export interface RoleAssignment {
  roleId: string
  parameters: Record<string, Partial<Record<ScopeDimension, string[]>>>
}
export interface SupplyEmployee {
  id: number
  employeeCode: string
  employeeName: string
  employmentStatus: string
  departmentId: number | null
  departmentName: string | null
  positionName: string | null
  employeeRevision: number
  accessVersion: number
  usable: boolean
  unavailableReason: string | null
}
export interface SupplyRoleImpact {
  id: string
  version: number
  status: string
  userCount: number
  usernames: string[]
  activeUserCount: number
  lastRoleUsernames: string[]
  managementEntryUsernames: string[]
  canDisable: boolean
  canDelete: boolean
}
export interface SupplyMember {
  createdByName?: string | null
  createdTime?: string | null
  updatedByName?: string | null
  updatedTime?: string | null
  id: string
  username: string
  name: string
  kind: string
  status: string
  remark: string | null
  version: number
  employeeCode: string | null
  employee: SupplyEmployee | null
  roles: RoleAssignment[]
  usable: boolean
  unavailableReason: string | null
}
export interface SupplyMemberCommand {
  existingUserId: string | null
  username: string
  initialPassword: string | null
  employeeCode: string
  status: string
  remark: string | null
  version: number
  roles: RoleAssignment[]
  bindingReason: string | null
}
export interface BatchRoleCommand {
  mode: 'APPEND' | 'REMOVE' | 'REPLACE'
  members: { id: string; version: number }[]
  roles: RoleAssignment[]
  applicationVersion: number
}
export const supplyAccessApi = {
  references: (dimension: ScopeDimension) =>
    apiClient.get<ScopeReference[]>(SUPPLY_SETTINGS_BASE + '/scope-references', {
      params: { dimension },
    }),
  roles: () => apiClient.get<SupplyRole[]>(SUPPLY_SETTINGS_BASE + '/roles'),
  memberRoles: () => apiClient.get<SupplyRole[]>(SUPPLY_SETTINGS_BASE + '/member-role-catalog'),
  menus: () => apiClient.get<SupplyMenuNode[]>(SUPPLY_SETTINGS_BASE + '/role-menu-catalog'),
  saveRole: (id: string | null, data: SupplyRoleCommand) =>
    id
      ? apiClient.put<SupplyRole>(SUPPLY_SETTINGS_BASE + '/roles/' + id + '/unified', data)
      : apiClient.post<SupplyRole>(SUPPLY_SETTINGS_BASE + '/roles/unified', data),
  roleImpact: (id: string) =>
    apiClient.get<SupplyRoleImpact>(SUPPLY_SETTINGS_BASE + '/roles/' + id + '/impact'),
  deleteRole: (id: string, version: number) =>
    apiClient.delete(SUPPLY_SETTINGS_BASE + '/roles/' + id, { params: { version } }),
  members: (keyword: string, page: number, pageSize: number, departmentId?: number) =>
    apiClient.get<{ items: SupplyMember[]; total: number; page: number; pageSize: number }>(
      SUPPLY_SETTINGS_BASE + '/users',
      { params: { keyword, page, pageSize, departmentId } },
    ),
  accounts: (keyword: string) =>
    apiClient.get<{ id: string; username: string; status: string }[]>(
      SUPPLY_SETTINGS_BASE + '/account-candidates',
      { params: { keyword } },
    ),
  employees: (keyword: string, begin = 0, step = 20) =>
    apiClient.get<{ items: SupplyEmployee[]; total: number; begin: number; step: number }>(
      SUPPLY_SETTINGS_BASE + '/employee-candidates',
      { params: { keyword, begin, step } },
    ),
  saveMember: (id: string | null, data: SupplyMemberCommand) =>
    id
      ? apiClient.put<SupplyMember>(SUPPLY_SETTINGS_BASE + '/users/' + id, data)
      : apiClient.post<SupplyMember>(SUPPLY_SETTINGS_BASE + '/users', data),
  memberStatus: (id: string, status: string, version: number) =>
    apiClient.put(SUPPLY_SETTINGS_BASE + '/users/' + id + '/status', {
      status,
      version,
      reason: null,
    }),
  deleteMember: (id: string, version: number) =>
    apiClient.delete(SUPPLY_SETTINGS_BASE + '/users/' + id, { params: { version } }),
  previewBatch: (data: BatchRoleCommand) =>
    apiClient.post<{
      applicationVersion: number
      members: { id: string; version: number }[]
      mode: string
      roleCount: number
    }>(SUPPLY_SETTINGS_BASE + '/users/batch-roles/preview', data),
  assignBatch: (data: BatchRoleCommand) =>
    apiClient.post(SUPPLY_SETTINGS_BASE + '/users/batch-roles', data),
  resetPassword: (id: string, password: string, version: number) =>
    apiClient.post(SUPPLY_SETTINGS_BASE + '/users/' + id + '/password', { password, version }),
}
