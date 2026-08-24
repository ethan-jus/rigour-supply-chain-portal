import { describe, expect, it } from 'vitest'
import positionViewSource from '@/views/admin/positions/IndexView.vue?raw'
import staffViewSource from '@/views/admin/staff/IndexView.vue?raw'

describe('人员与岗位管理页面', () => {
  it('岗位编码只展示不编辑，并调用IAM岗位接口', () => {
    expect(positionViewSource).toContain('/management/tenant/positions')
    expect(positionViewSource).toContain('岗位编码')
    expect(positionViewSource).toContain('v-model="form.code" disabled')
    expect(positionViewSource).not.toContain('code: form.code')
  })

  it('人员编码只展示不编辑，并维护我方组织岗位关系', () => {
    expect(staffViewSource).toContain('/management/tenant/staff')
    expect(staffViewSource).toContain('/management/tenant/organizations')
    expect(staffViewSource).toContain('/management/tenant/positions')
    expect(staffViewSource).toContain('员工编码')
    expect(staffViewSource).toContain('v-model="form.staffCode" disabled')
    expect(staffViewSource).toContain('primaryOrganizationId: form.primaryOrganizationId')
    expect(staffViewSource).toContain('primaryPositionId: form.primaryPositionId')
    expect(staffViewSource).not.toContain('staffCode: form.staffCode')
    expect(staffViewSource).not.toContain('sourceTitle: form')
    expect(staffViewSource).not.toContain('sourceBranchName: form')
  })
})
