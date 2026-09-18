import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage, ElMessageBox, ElTreeSelect } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import DepartmentView from '@/views/supply-chain/hr/HrDepartmentManagementView.vue'
import { hrOrganizationApi, type HrDepartment } from '@/api/core/hr'
import {
  departmentTree,
  filterDepartmentTree,
  departmentParentTree,
} from '@/utils/hr-department-tree'
const permission = vi.hoisted(() => ({ write: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => permission.write }),
}))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: vi.fn().mockResolvedValue({items:[],total:0}),
  hrOrganizationApi: { departments: vi.fn(), saveDepartment: vi.fn(), deleteDepartment: vi.fn() },
}))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ getNavigation: () => [] }) }))
let rows: HrDepartment[], wrapper: VueWrapper | undefined
const row = (
  id: number,
  name: string,
  parentId: number | null = null,
  sortOrder = 0,
): HrDepartment => ({
  id,
  departmentName: name,
  parentId,
  sortOrder,
  departmentCode: `DEP${id}`,
  statusCode: 'ACTIVE',
  revision: 1,
  leaderName: null,
  contactPhone: null,
  establishedDate: null,
  createdTime: '2026-09-16T02:00:00Z',
  createdBy: 'user-1',
  createdByName: '管理员',
  updatedTime: '2026-09-16T02:00:00Z',
  updatedBy: 'user-1',
  updatedByName: '管理员',
})
const Dialog = defineComponent({
  props: ['modelValue', 'title'],
  setup:
    (p, { slots }) =>
    () =>
      p.modelValue
        ? h('aside', { role: 'dialog' }, [h('h2', p.title), slots.default?.(), slots.footer?.()])
        : null,
})
const button = (name: string) => wrapper!.findAll('button').find((b) => b.text() === name)!
async function render() {
  wrapper = mount(DepartmentView, {
    attachTo: document.body,
    global: { plugins: [createPinia(), ElementPlus], stubs: { ElDialog: Dialog } },
  })
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  setActivePinia(createPinia())
  permission.write = true
  rows = [row(1, '瑞盖'), row(2, '销售部', 1), row(3, '杭州市', 2), row(4, '财务部', 1, 10)]
  vi.mocked(hrOrganizationApi.departments).mockImplementation(async () =>
    rows.map((r) => ({ ...r })),
  )
  vi.spyOn(ElMessage, 'success').mockReturnValue({ close: vi.fn() })
  vi.spyOn(ElMessage, 'warning').mockReturnValue({ close: vi.fn() })
  vi.spyOn(ElMessage, 'error').mockReturnValue({ close: vi.fn() })
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(
    'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('部门维护：真实表格与表单交互', () => {
  it('展示多级部门并可展开收起，搜索子部门保留祖先链', async () => {
    await render()
    expect(wrapper!.findAll('tr.el-table__row').filter((r) => r.isVisible())).toHaveLength(4)
    await button('收起全部').trigger('click')
    await flushPromises()
    expect(wrapper!.findAll('tr.el-table__row').filter((r) => r.isVisible())).toHaveLength(1)
    await button('展开全部').trigger('click')
    await flushPromises()
    expect(wrapper!.findAll('tr.el-table__row').filter((r) => r.isVisible())).toHaveLength(4)
    await wrapper!.get('input[aria-label="搜索部门"]').setValue('杭州')
    await flushPromises()
    const content = wrapper!.get('.el-table').text()
    expect(content).toContain('瑞盖')
    expect(content).toContain('销售部')
    expect(content).toContain('杭州市')
    expect(content).not.toContain('财务部')
  })
  it('新增子部门保存后清除筛选，读取服务端列表并展示新节点', async () => {
    vi.mocked(hrOrganizationApi.saveDepartment).mockImplementation(async (_id, c) => {
      const saved = { ...row(5, c.departmentName, c.parentId), ...c, revision: 1 }
      rows.push(saved)
      return saved
    })
    await render()
    await wrapper!.get('input[aria-label="搜索部门"]').setValue('杭州')
    await flushPromises()
    const target = wrapper!.findAll('tr.el-table__row').find((r) => r.text().includes('杭州市'))!
    await target
      .findAll('button')
      .find((b) => b.text() === '新增子部门')!
      .trigger('click')
    await wrapper!.get('input[placeholder="例如：销售部、浙江区域、杭州市"]').setValue('西湖销售组')
    await button('确定').trigger('click')
    await flushPromises()
    expect(hrOrganizationApi.saveDepartment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ parentId: 3, departmentName: '西湖销售组', revision: 0 }),
    )
    expect((wrapper!.get('input[aria-label="搜索部门"]').element as HTMLInputElement).value).toBe(
      '',
    )
    expect(wrapper!.get('.el-table').text()).toContain('西湖销售组')
    expect(wrapper!.find('[role="dialog"]').exists()).toBe(false)
    expect(ElMessage.success).toHaveBeenCalledWith('部门已保存')
  })
  it('居中弹窗保存负责人电话和设立日期，审计信息只读且不进入请求', async () => {
    vi.mocked(hrOrganizationApi.saveDepartment).mockImplementation(async (_id, command) => {
      const saved = { ...row(5, command.departmentName), ...command, revision: 1 }
      rows.push(saved)
      return saved
    })
    await render()
    await button('新增部门').trigger('click')
    await wrapper!.get('input[placeholder="例如：销售部、浙江区域、杭州市"]').setValue('运营部')
    wrapper!.findAllComponents({name:'ElSelect'}).find(c=>c.props('placeholder')==='搜索并选择在职员工')!.vm.$emit('update:modelValue','EMP1')
    await wrapper!.get('input[placeholder="请输入联系电话"]').setValue('0571-12345678')
    wrapper!.getComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', '2020-05-06')
    await button('确定').trigger('click')
    await flushPromises()
    const command = vi.mocked(hrOrganizationApi.saveDepartment).mock.calls[0][1]
    expect(command).toMatchObject({
      leaderEmployeeCode: 'EMP1',
      contactPhone: '0571-12345678',
      establishedDate: '2020-05-06',
    })
    expect(command).not.toHaveProperty('createdBy')
    expect(command).not.toHaveProperty('updatedBy')
    expect(command).not.toHaveProperty('createdTime')
    expect(wrapper!.get('.el-table').text()).toContain('2020-05-06')
    expect(wrapper!.get('.el-table').text()).toContain('管理员')
    const savedRow = wrapper!.findAll('tr.el-table__row').find((r) => r.text().includes('运营部'))!
    await savedRow
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.get('[role="dialog"]').text()).toContain('创建时间')
    expect(wrapper!.get('[role="dialog"]').text()).toContain('管理员')
    expect(wrapper!.findAllComponents({name:'ElSelect'}).find(c=>c.props('placeholder')==='搜索并选择在职员工')!.props('modelValue')).toBe('EMP1')
  })
  it('保存失败保留表单和服务端错误，不假报成功', async () => {
    vi.mocked(hrOrganizationApi.saveDepartment).mockRejectedValue({
      code: 'NOT_FOUND',
      message: '资源不存在',
    })
    await render()
    await button('新增部门').trigger('click')
    await wrapper!.get('input[placeholder="例如：销售部、浙江区域、杭州市"]').setValue('区域部')
    await button('确定').trigger('click')
    await flushPromises()
    expect(wrapper!.get('[role="dialog"]').text()).toContain('资源不存在')
    expect(ElMessage.success).not.toHaveBeenCalled()
  })
  it('保存成功但重读失败：保留真实返回记录并提示已保存，避免重复新增', async () => {
    await render()
    await button('新增部门').trigger('click')
    vi.mocked(hrOrganizationApi.saveDepartment).mockResolvedValue(row(5, '区域部'))
    vi.mocked(hrOrganizationApi.departments).mockRejectedValue({ message: 'HR 服务暂不可用' })
    await wrapper!.get('input[placeholder="例如：销售部、浙江区域、杭州市"]').setValue('区域部')
    await button('确定').trigger('click')
    await flushPromises()
    expect(wrapper!.text()).toContain('部门已保存，但列表未完成更新')
    expect(wrapper!.get('.el-table').text()).toContain('区域部')
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper!.find('[role="dialog"]').exists()).toBe(false)
  })
  it('加载失败展示明确错误，不能显示成正常空列表', async () => {
    vi.mocked(hrOrganizationApi.departments).mockRejectedValue({ message: '资源不存在' })
    await render()
    expect(wrapper!.get('.el-alert').text()).toContain('资源不存在')
    expect(wrapper!.text()).not.toContain('还没有部门')
  })
  it('编辑保留版本；自身和后代不能作为上级', async () => {
    await render()
    const target = wrapper!.findAll('tr.el-table__row').find((r) => r.text().includes('销售部'))!
    await target
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    const data = wrapper!.findComponent(ElTreeSelect).props('data') as ReturnType<
      typeof departmentParentTree
    >
    expect(data[0]!.disabled).toBe(false)
    expect(data[0]!.children[0]).toMatchObject({ id: 2, disabled: true })
    expect(data[0]!.children[0]!.children[0]).toMatchObject({ id: 3, disabled: true })
    vi.mocked(hrOrganizationApi.saveDepartment).mockResolvedValue({
      ...rows[1]!,
      departmentName: '销售中心',
      revision: 2,
    })
    await wrapper!.get('input[placeholder="例如：销售部、浙江区域、杭州市"]').setValue('销售中心')
    await button('确定').trigger('click')
    await flushPromises()
    expect(hrOrganizationApi.saveDepartment).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ revision: 1, parentId: 1 }),
    )
  })
  it('无写权限只显示组织树，不显示维护入口', async () => {
    permission.write = false
    await render()
    expect(button('新增部门')).toBeUndefined()
    expect(button('编辑')).toBeUndefined()
    expect(button('删除')).toBeUndefined()
    expect(wrapper!.text()).toContain('杭州市')
  })
  it('未停用部门不发送删除请求', async () => {
    await render()
    await button('删除').trigger('click')
    await flushPromises()
    expect(hrOrganizationApi.deleteDepartment).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('请先通过编辑停用部门，再执行删除')
  })
})
describe('部门层级边界', () => {
  it('搜索上级时保留整个匹配分支，并按排序值展示同级', () => {
    const tree = departmentTree([
      row(1, '总部'),
      row(2, '浙江', 1, 10),
      row(3, '杭州', 2),
      row(4, '北京', 1, 1),
    ])
    expect(tree[0]!.children.map((n) => n.id)).toEqual([4, 2])
    expect(filterDepartmentTree(tree, '浙江')[0]!.children[0]!.children[0]!.departmentName).toBe(
      '杭州',
    )
  })
  it('循环层级给出明确错误而不是渲染空树', () => {
    expect(() => departmentTree([row(1, '甲', 2), row(2, '乙', 1)])).toThrow('部门层级存在循环')
  })
})
