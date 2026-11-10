import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import View from '@/views/supply-chain/huolala/HuolalaIntegrationView.vue'
import type { HuolalaConnection } from '@/api/core/huolala'
const api = vi.hoisted(() => ({
  connection: vi.fn(),
  employees: vi.fn(),
  runs: vi.fn(),
  save: vi.fn(),
  authorize: vi.fn(),
  complete: vi.fn(),
  candidates: vi.fn(),
  bind: vi.fn(),
  sync: vi.fn(),
  issues: vi.fn(),
}))
vi.mock('@/api/core/huolala', () => ({ huolalaApi: api }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
let wrapper: VueWrapper
const connection = (): HuolalaConnection => ({
  id: 'C1',
  enterpriseId: '12345',
  enterpriseName: '示例企业',
  secretRef: 'env://HLL',
  sandbox: false,
  redirectUri: 'http://localhost:5100/huolala-authorized.html',
  enabled: false,
  intervalMinutes: 15,
  startDate: '2026-11-01',
  authStatus: 'UNAUTHORIZED',
  expiresAt: null,
  credentialsReady: false,
  revision: 1,
  lastSuccessAt: null,
  lastError: null,
})
const button = (name: string) => wrapper.findAll('button').find((b) => b.text() === name)!
async function open() {
  wrapper = mount(View, { global: { plugins: [ElementPlus] } })
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  api.connection.mockResolvedValue(connection())
  api.employees.mockResolvedValue([])
  api.runs.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
describe('货拉拉企业控制面', () => {
  it('尚未取得凭据时真实显示未授权，授权和同步按钮不可使用', async () => {
    await open()
    expect(wrapper.text()).toContain('未授权')
    expect(wrapper.text()).toContain('示例企业')
    expect(button('企业授权').attributes('disabled')).toBeDefined()
    expect(button('同步货拉拉数据').attributes('disabled')).toBeDefined()
    expect(api.authorize).not.toHaveBeenCalled()
    expect(api.sync).not.toHaveBeenCalled()
  })
  it('业务页面只提交同步偏好，企业与应用配置不由浏览器维护', async () => {
    api.save.mockResolvedValue(connection())
    await open()
    expect(
      wrapper.findAll('input').some((e) => e.attributes('placeholder')?.includes('企业编号')),
    ).toBe(false)
    expect(wrapper.text()).not.toContain('应用凭据引用')
    expect(wrapper.text()).not.toContain('授权回调地址')
    expect(wrapper.text()).not.toContain('沙箱环境')
    await button('保存设置').trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith({
      enabled: false,
      intervalMinutes: 15,
      startDate: '2026-11-01',
      revision: 1,
    })
  })
  it('同名员工不会自动落关联，需要业务确认', async () => {
    api.employees.mockResolvedValue([
      {
        staffId: '1',
        userId: '2',
        name: '李经理',
        phone: '13800000000',
        staffNo: 'S1',
        externalDepartmentId: 'D1',
        employeeCode: null,
        employeeName: null,
        departmentName: null,
        state: 'UNMATCHED',
        revision: 0,
      },
    ])
    api.candidates.mockResolvedValue([
      {
        id: 91,
        employeeCode: 'EMP91',
        employeeName: '李经理',
        mobile: '13800000000',
        departmentName: '销售部',
        employmentStatus: 'ACTIVE',
      },
    ])
    await open()
    await wrapper
      .findAll('[role="tab"]')
      .find((e) => e.text() === '员工关联')!
      .trigger('click')
    await flushPromises()
    await button('关联员工').trigger('click')
    await flushPromises()
    expect(api.candidates).toHaveBeenCalled()
    expect(api.bind).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('关联或变更原因')
  })
})
