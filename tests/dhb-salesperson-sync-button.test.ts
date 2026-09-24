import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import Button from '@/components/supply/DhbSalespersonSyncButton.vue'

const mocks = vi.hoisted(() => ({ allowed: true, tasks: vi.fn(), start: vi.fn(), latest: vi.fn() }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => mocks.allowed }),
}))
vi.mock('@/api/core/dhb-orchestration', () => ({ getDhbSyncTasks: mocks.tasks }))
vi.mock('@/api/core/dhb-page-sync', () => ({
  latestDhbPageSyncJob: mocks.latest,
  getDhbPageSyncJob: vi.fn(),
  startDhbPageSyncJob: mocks.start,
}))
const job = (status = 'SUCCEEDED', scope = 'SALESPERSON') => ({
  jobId: 'job-1',
  connectorId: 'connector-1',
  scope,
  status,
  stage: '已结束',
  startedAt: new Date().toISOString(),
  heartbeatAt: new Date().toISOString(),
  result: {
    status: 'SUCCEEDED',
    tenants: [
      {
        steps: [
          { objectType: 'STAFF', fetched: 3, created: 1, updated: 1, duplicates: 1, rejected: 0 },
        ],
      },
    ],
  },
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed = true
  mocks.tasks.mockResolvedValue([{ connectorId: 'connector-1' }])
  mocks.latest.mockResolvedValue(null)
  mocks.start.mockResolvedValue(job())
})
it('只提交业务员后台任务，展示分类数量，完成弹窗只有关闭', async () => {
  const wrapper = mount(Button, { global: { plugins: [ElementPlus] } })
  expect(wrapper.get('button').text()).toBe('同步业务员')
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(mocks.start).toHaveBeenCalledWith(expect.any(String), {
    scope: 'SALESPERSON',
    connectorId: 'connector-1',
    incremental: true,
    maxPages: 100,
  })
  expect(wrapper.text()).toContain('新增关联')
  expect(wrapper.text()).toContain('保留全部档案')
  expect(wrapper.text()).toContain('业务员同步完成')
  expect(wrapper.emitted('completed')).toHaveLength(1)
  expect(wrapper.findAll('.el-dialog__footer button').map((b) => b.text())).toEqual(['关闭'])
  await wrapper.get('.el-dialog__footer button').trigger('click')
  expect(mocks.start).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
it('已有任务仅展示进度，不重复提交', async () => {
  mocks.latest.mockResolvedValue(job('RUNNING'))
  const wrapper = mount(Button, { global: { plugins: [ElementPlus] } })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(mocks.start).not.toHaveBeenCalled()
  expect(wrapper.get('button').text()).toBe('查看同步进度')
  await wrapper.get('button').trigger('click')
  expect(mocks.latest).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
it('部分完成保留待核对说明，不冒充全部成功', async () => {
  mocks.start.mockResolvedValue({
    ...job(),
    result: {
      status: 'SUCCEEDED_WITH_WARNINGS',
      tenants: [{ steps: [{ rejected: 1, message: '来源员工 s1 部门未匹配' }] }],
    },
  })
  const wrapper = mount(Button, { global: { plugins: [ElementPlus] } })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('仍有待核对项')
  expect(wrapper.text()).toContain('来源员工 s1 部门未匹配')
  expect(wrapper.findAll('.el-dialog__footer button').map((b) => b.text())).toEqual(['关闭'])
  wrapper.unmount()
})
it('缺少权限隐藏入口，多个来源不擅自选择', async () => {
  mocks.allowed = false
  const hidden = mount(Button, { global: { plugins: [ElementPlus] } })
  expect(hidden.find('button').exists()).toBe(false)
  hidden.unmount()
  mocks.allowed = true
  mocks.tasks.mockResolvedValue([{ connectorId: 'a' }, { connectorId: 'b' }])
  const wrapper = mount(Button, { global: { plugins: [ElementPlus] } })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(mocks.start).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('配置唯一')
  wrapper.unmount()
})
