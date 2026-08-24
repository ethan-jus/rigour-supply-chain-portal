import { describe, expect, it } from 'vitest'
import roleViewSource from '@/views/admin/roles/IndexView.vue?raw'

describe('角色权限管理页面', () => {
  it('使用新角色权限接口并由后端生成角色编码', () => {
    expect(roleViewSource).toContain('/management/tenant/role-permissions/roles')
    expect(roleViewSource).toContain('/management/tenant/role-permissions/grantable-resources')
    expect(roleViewSource).toContain('角色编码')
    expect(roleViewSource).toContain('v-model="form.code" disabled')
    expect(roleViewSource).not.toContain('code: form.code')
    expect(roleViewSource).not.toContain('/management/tenant/roles')
  })

  it('角色列表保持序号、首个业务列和操作列规范', () => {
    expect(roleViewSource).toContain('type="index" label="序号"')
    expect(roleViewSource).toContain('prop="code" label="角色编码"')
    expect(roleViewSource).toContain('fixed="left"')
    expect(roleViewSource).toContain('label="操作"')
    expect(roleViewSource).toContain('fixed="right"')
  })

  it('授权选择会处理父子资源关系', () => {
    expect(roleViewSource).toContain('selectedResourceIds')
    expect(roleViewSource).toContain('ancestorIds(resource)')
    expect(roleViewSource).toContain('descendantIds(resource)')
  })
})
