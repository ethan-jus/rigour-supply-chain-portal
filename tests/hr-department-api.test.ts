import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hrOrganizationApi, type HrDepartmentCommand } from '@/api/core/hr'
import { apiClient } from '@/api/core/client'
vi.mock('@/api/core/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
const department = {
  id: 1,
  parentId: null,
  departmentCode: 'DEP1',
  departmentName: '总部',
  sortOrder: 0,
  statusCode: 'ACTIVE',
  revision: 1,
}
const command: HrDepartmentCommand = {
  parentId: null,
  departmentName: '总部',
  sortOrder: 0,
  statusCode: 'ACTIVE',
  revision: 0,
  leaderEmployeeCode: null,
  contactPhone: null,
  establishedDate: null,
}
beforeEach(() => vi.resetAllMocks())
describe('HR 部门接口返回契约', () => {
  it('新建和修改返回真实记录，列表读取相同结构', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(department)
    vi.mocked(apiClient.put).mockResolvedValue({ ...department, revision: 2 })
    vi.mocked(apiClient.get).mockResolvedValue([department])
    expect(await hrOrganizationApi.saveDepartment(null, command)).toEqual(department)
    expect(apiClient.post).toHaveBeenCalledWith('/hr/departments', command)
    expect((await hrOrganizationApi.saveDepartment(1, { ...command, revision: 1 })).revision).toBe(
      2,
    )
    expect(await hrOrganizationApi.departments()).toEqual([department])
  })
  it.each([null, {}, '<html>wrong proxy</html>', { success: true }])(
    '未知保存响应 %j 不能冒充保存成功',
    async (value) => {
      vi.mocked(apiClient.post).mockResolvedValue(value)
      await expect(hrOrganizationApi.saveDepartment(null, command)).rejects.toThrow(
        '未返回有效记录',
      )
    },
  )
  it('未知列表契约不能当作无部门', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] })
    await expect(hrOrganizationApi.departments()).rejects.toThrow('列表响应异常')
  })
})
