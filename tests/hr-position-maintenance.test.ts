import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import View from '@/views/supply-chain/hr/HrPositionManagementView.vue'
import {
  getHrPositions,
  createHrPosition,
  updateHrPosition,
  deleteHrPosition,
  type HrPositionRecord,
} from '@/api/core/hr'
vi.mock('@/api/core/hr', () => ({
  getHrPositions: vi.fn(),
  createHrPosition: vi.fn(),
  updateHrPosition: vi.fn(),
  deleteHrPosition: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/utils/audit-actor', () => ({ auditActorLabel: () => '张三' }))
let wrapper: VueWrapper
const row: HrPositionRecord = {
  id: '1',
  positionCode: 'SALES',
  positionName: '业务员',
  sortOrder: 0,
  statusCode: 'ACTIVE',
  remark: '客户维护',
  revision: 2,
  createdBy: 'a',
  createdTime: '2026-09-16T00:00:00Z',
  updatedBy: 'a',
  updatedTime: '2026-09-16T00:00:00Z',
}
beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(getHrPositions).mockResolvedValue({ items: [row], total: 1, begin: 0, step: 20 })
  vi.mocked(createHrPosition).mockResolvedValue(row)
  vi.mocked(updateHrPosition).mockResolvedValue(row)
  vi.mocked(deleteHrPosition).mockResolvedValue(undefined)
  wrapper = mount(View, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true,
        ElSelect: { template: '<div><slot /></div>' },
        ElOption: true,
        ElPagination: true, SupplyPageTitle: { template: '<h1><slot /></h1>' } },
    },
  })
  await flushPromises()
})
afterEach(() => {
  wrapper.unmount()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
function button(label: string) {
  return wrapper
    .findAll('button')
    .find((x) => x.text() === label && !x.element.closest('.hidden-columns'))!
}
it('新增弹窗只有岗位字段，提交编码、顺序和岗位职责', async () => {
  await button('新增岗位').trigger('click')
  await flushPromises()
  const dialog = wrapper.find('.el-dialog')
  expect(dialog.text()).toContain('岗位职责')
  expect(dialog.text()).not.toContain('类型')
  expect(dialog.text()).not.toContain('来源')
  await dialog.find('input[placeholder="请输入岗位名称"]').setValue('平台运营')
  await dialog.find('input[placeholder="字母、数字、下划线或短横线"]').setValue('OPS')
  await dialog.find('textarea').setValue('运营职责')
  await button('确定').trigger('click')
  await flushPromises()
  expect(createHrPosition).toHaveBeenCalledWith(
    expect.objectContaining({
      positionName: '平台运营',
      positionCode: 'OPS',
      sortOrder: 0,
      statusCode: 'ACTIVE',
      remark: '运营职责',
    }),
  )
  const sent = vi.mocked(createHrPosition).mock.calls[0][0]
  expect(sent).not.toHaveProperty('positionType')
  expect(sent).not.toHaveProperty('sourceSystem')
})
it('编辑保留编码和版本，更新岗位职责', async () => {
  await button('编辑').trigger('click')
  await flushPromises()
  await wrapper.find('.el-dialog textarea').setValue('客户跟进与销售')
  await button('确定').trigger('click')
  await flushPromises()
  expect(updateHrPosition).toHaveBeenCalledWith(
    '1',
    expect.objectContaining({ positionCode: 'SALES', revision: 2, remark: '客户跟进与销售' }),
  )
  expect(wrapper.text()).toContain('2026-09-16 08:00:00')
})
it('确认删除携带版本，刷新列表', async () => {
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>)
  await button('删除').trigger('click')
  await flushPromises()
  expect(deleteHrPosition).toHaveBeenCalledWith('1', 2)
  expect(getHrPositions).toHaveBeenCalledTimes(2)
})
