import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAreas: vi.fn(),
  getEmployees: vi.fn(),
  getDepartments: vi.fn(),
  getCreators: vi.fn(),
}))

vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: mocks.getAreas }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: mocks.getEmployees,
  hrOrganizationApi: { departments: mocks.getDepartments },
}))
vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterCreators: mocks.getCreators,
}))

import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'

function employee(code: string, name: string, cityName: string | null) {
  return {
    id: code,
    employeeCode: code,
    employeeName: name,
    mobile: null,
    email: null,
    employmentStatus: 'ACTIVE',
    jobCategory: null,
    positionCode: null,
    positionName: null,
    departmentName: null,
    leaderEmployeeCode: null,
    leaderName: null,
    regionName: null,
    cityName,
    sourceSystem: null,
    sourceDocumentNo: null,
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    entryDate: null,
    leaveDate: null,
    remark: null,
    revision: 0,
    createdBy: null,
    createdTime: null,
    updatedBy: null,
    updatedTime: null,
  }
}

describe('订单主数据选项级联', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAreas.mockResolvedValue([
      { id: '1', code: 'ROOT', name: '全国', parentCode: null, status: 'ACTIVE' },
      { id: '2', code: 'ZJ', name: '浙江省', parentCode: 'ROOT', status: 'ACTIVE' },
      { id: '3', code: 'HZ', name: '杭州市', parentCode: 'ZJ', status: 'ACTIVE' },
      { id: '4', code: 'JH', name: '金华市', parentCode: 'ZJ', status: 'ACTIVE' },
      { id: '5', code: 'WH', name: '武汉市', parentCode: 'ROOT', status: 'ACTIVE' },
    ])
    mocks.getDepartments.mockResolvedValue([])
    mocks.getCreators.mockResolvedValue([])
    mocks.getEmployees.mockImplementation(async (params: { cityName?: string; keyword?: string }) => ({
      total: 1,
      begin: 0,
      step: 50,
      items: [employee(`EMP-${params.cityName ?? 'ALL'}`, `业务员-${params.cityName ?? '全部'}`, params.cityName ?? null)],
    }))
  })

  it('未选归属地区时按关键词全量搜索业务员', async () => {
    const options = useOrderRegisterOptions()
    await options.loadOptions()

    await options.searchEmployees('张')

    expect(mocks.getEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '张' }),
    )
    const lastCall = mocks.getEmployees.mock.calls.at(-1)![0]
    expect(lastCall.cityName).toBeUndefined()
  })

  it('销售部门选项去掉上级和职能部门，保留多层销售组织与原始部门编号', async () => {
    const department = (id: number, parentId: number | null, departmentName: string, sortOrder = 0, statusCode = 'ACTIVE') =>
      ({ id, parentId, departmentName, departmentCode: `D${id}`, sortOrder, statusCode })
    mocks.getDepartments.mockResolvedValue([
      department(1, null, '公司'), department(2, 1, '总经办'),
      department(3, 2, '销售部'), department(4, 2, '财务部'),
      department(5, 3, '浙江区域', 2), department(6, 5, '杭州市'),
      department(7, 3, '北京市', 1), department(8, 4, '杭州市'),
      department(9, 3, '已停用城市', 3, 'INACTIVE'),
    ])
    const sales = useOrderRegisterOptions({ salesDepartmentsOnly: true })
    await sales.loadOptions()

    expect(sales.departmentOptionsTree.value.map(row => row.id)).toEqual([7, 5])
    expect(sales.departmentOptionsTree.value[1].children.map(row => row.id)).toEqual([6])
    expect(sales.departmentLabel(4)).toBe('财务部')

    const all = useOrderRegisterOptions()
    await all.loadOptions()
    expect(all.departmentOptionsTree.value.map(row => row.id)).toEqual([1])
  })

  it('没有销售部时不把其他部门作为销售查询选项', async () => {
    mocks.getDepartments.mockResolvedValue([
      { id: 1, parentId: null, departmentName: '公司', sortOrder: 0, statusCode: 'ACTIVE' },
      { id: 2, parentId: 1, departmentName: '运营部', sortOrder: 0, statusCode: 'ACTIVE' },
    ])
    const options = useOrderRegisterOptions({ salesDepartmentsOnly: true })
    await options.loadOptions()
    expect(options.departmentOptionsTree.value).toEqual([])
  })

  it('搜索历史业务员包括已离职员工', async () => {
    const options = useOrderRegisterOptions()
    await options.loadOptions()
    const staff = [
      employee('EMP-ACTIVE', '测试在职', '武汉'),
      { ...employee('EMP-LEFT', '测试离职', '武汉'), employmentStatus: 'LEFT' },
    ]
    mocks.getEmployees.mockImplementation(async (params: { employmentStatus?: string }) => ({
      total: staff.length, begin: 0, step: 50,
      items: staff.filter(item => !params.employmentStatus || item.employmentStatus === params.employmentStatus),
    }))

    await options.searchEmployees('测试')

    expect(options.employeeOptions.value.map(item => item.employeeCode)).toEqual(['EMP-ACTIVE', 'EMP-LEFT'])
    const params = mocks.getEmployees.mock.calls.at(-1)![0]
    expect(params.keyword).toBe('测试')
    expect(params.employmentStatus).toBeUndefined()
    expect(params.cityName).toBeUndefined()
  })

  it('跨市成交可以按无锡员工张三搜索，不加员工所在城市条件', async () => {
    const options = useOrderRegisterOptions()
    mocks.getEmployees.mockResolvedValue({ items: [employee('WX-1', '张三', '无锡')] })
    await options.searchEmployees('张三')
    expect(mocks.getEmployees).toHaveBeenLastCalledWith({ begin: 0, step: 50, keyword: '张三' })
    expect(options.employeeOptions.value[0]?.employeeCode).toBe('WX-1')
  })
})
