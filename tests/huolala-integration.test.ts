import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createRouter, createMemoryHistory } from 'vue-router'
import View from '@/views/supply-chain/huolala/HuolalaIntegrationView.vue'
import ConsoleTabPane from '@/components/console/ConsoleTabPane.vue'
import type { HuolalaConnection } from '@/api/core/huolala'
const api = vi.hoisted(() => ({
  connection: vi.fn(),
  employees: vi.fn(),
  runs: vi.fn(),
  save: vi.fn(),
  authorize: vi.fn(),
  authorizationStatus: vi.fn(),
  cancelAuthorization: vi.fn(),
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
  redirectUri: 'http://localhost:26882/api/v1/integration/huolala/oauth/callback',
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
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})
describe('货拉拉企业控制面', () => {
  it('同步完成后自动刷新员工和连接结果，保留尚未保存的同步设置', async () => {
    vi.useFakeTimers()
    api.runs
      .mockResolvedValueOnce([{ id: 'R1', status: 'RUNNING', scope: 'ALL', startedAt: null }])
      .mockResolvedValue([{ id: 'R1', status: 'SUCCEEDED', scope: 'ALL', startedAt: null }])
    const synced = {
      ...connection(),
      authStatus: 'AUTHORIZED',
      lastSuccessAt: '2026-11-11T09:00:00Z',
    }
    api.connection.mockResolvedValueOnce(connection()).mockResolvedValue(synced)
    api.employees
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          staffId: 'S1',
          name: '新同步员工',
          phone: '',
          staffNo: '',
          state: 'UNMATCHED',
          revision: 0,
        },
      ])
    api.save.mockResolvedValue(synced)
    await open()
    await wrapper.get('input[role="spinbutton"]').setValue('16')
    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()
    expect(api.connection).toHaveBeenCalledTimes(2)
    expect(api.employees).toHaveBeenCalledTimes(2)
    await button('保存设置').trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ intervalMinutes: 16 }))
    await wrapper
      .findAll('[role="tab"]')
      .find((e) => e.text() === '员工关联')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('货拉拉员工 1 人')
    expect(wrapper.text()).toContain('新同步员工')
    expect(api.bind).not.toHaveBeenCalled()
  })
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
  it('授权窗口进入后端，页面只轮询会话结果，不再录入或交换授权码', async () => {
    const popup = { location: { href: '' }, close: vi.fn(), opener: window }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    api.connection
      .mockResolvedValueOnce({ ...connection(), credentialsReady: true })
      .mockResolvedValue({ ...connection(), credentialsReady: true, authStatus: 'AUTHORIZED' })
    api.authorize.mockResolvedValue({
      id: 'session-1',
      url: 'http://192.168.9.90:26882/api/v1/integration/huolala/oauth/start?ticket=one-time',
      expiresAt: '2099-01-01',
    })
    api.authorizationStatus.mockResolvedValue({
      id: 'session-1',
      status: 'SUCCEEDED',
      expiresAt: '2099-01-01',
      message: null,
    })
    await open()
    await button('企业授权').trigger('click')
    await flushPromises()
    expect(popup.location.href).toContain('/oauth/start?ticket=')
    expect(popup.opener).toBeNull()
    expect(api.authorizationStatus).toHaveBeenCalledWith('session-1')
    expect(api.cancelAuthorization).not.toHaveBeenCalled()
    expect(popup.close).toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('临时授权码')
    expect(wrapper.text()).toContain('已授权')
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
      {
        id: 92,
        employeeCode: 'EMP92',
        employeeName: '李经理',
        mobile: '13800000000',
        departmentName: '运营部',
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
    expect(wrapper.find('output[aria-label="本系统所属部门"]').text()).toBe('-')
    await wrapper.get('input[type="radio"][value="91"]').setValue()
    await flushPromises()
    expect(wrapper.find('output[aria-label="本系统所属部门"]').text()).toBe('销售部')
    expect(wrapper.text()).not.toContain('平台部门')
    expect(wrapper.text()).not.toContain('更改关联原因')
    api.bind.mockResolvedValue([])
    await button('确认关联').trigger('click')
    await flushPromises()
    expect(api.bind).toHaveBeenCalledWith('1', 91, 0, '首次关联')
  })
  it('复用已打开页面时按入口切换到员工关联、同步记录或连接设置', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/huolala', component: View },
        { path: '/logistics', component: { template: '<div />' } },
      ],
    })
    await router.push('/huolala?tab=runs')
    await router.isReady()
    wrapper = mount(ConsoleTabPane, {
      props: { active: true, route: router.currentRoute.value },
      global: { plugins: [ElementPlus, router] },
    })
    await flushPromises()
    const activeTab = () => wrapper.find('[role="tab"][aria-selected="true"]').text()
    expect(activeTab()).toBe('同步记录')
    await router.push('/huolala?tab=employees')
    await wrapper.setProps({ route: router.currentRoute.value })
    await flushPromises()
    expect(activeTab()).toBe('员工关联')
    await wrapper
      .findAll('[role="tab"]')
      .find((t) => t.text() === '同步记录')!
      .trigger('click')
    expect(activeTab()).toBe('同步记录')
    await wrapper.setProps({ active: false })
    await router.push('/logistics')
    await router.push('/huolala?tab=employees')
    await wrapper.setProps({ active: true, route: router.currentRoute.value })
    await flushPromises()
    expect(activeTab()).toBe('员工关联')
    await router.push('/huolala?tab=connection')
    await wrapper.setProps({ route: router.currentRoute.value })
    await flushPromises()
    expect(activeTab()).toBe('企业授权与同步设置')
    expect(api.sync).not.toHaveBeenCalled()
    expect(api.bind).not.toHaveBeenCalled()
  })
})
