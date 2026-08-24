import { describe, expect, it } from 'vitest'
import organizationViewSource from '@/views/admin/organizations/IndexView.vue?raw'

describe('组织管理页面', () => {
  it('使用组织架构下钻页面，而不是通用CRUD列表', () => {
    expect(organizationViewSource).toContain('组织架构')
    expect(organizationViewSource).toContain('下级')
    expect(organizationViewSource).toContain('本级人员')
    expect(organizationViewSource).toContain('organizationUserCounts')
    expect(organizationViewSource).toContain('/management/tenant/organizations')
    expect(organizationViewSource).toContain('/management/tenant/users')
    expect(organizationViewSource).toContain('/management/tenant/roles')
    expect(organizationViewSource).not.toContain('ManagementCrudPage')
  })
})
