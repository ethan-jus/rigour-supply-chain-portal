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

  it('选中城市时按去掉“市”后缀的城市名级联业务员', async () => {
    const options = useOrderRegisterOptions()
    await options.loadOptions()
    mocks.getEmployees.mockClear()

    await options.searchEmployees('', 'WH')

    expect(mocks.getEmployees).toHaveBeenCalledTimes(1)
    expect(mocks.getEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ cityName: '武汉' }),
    )
    expect(options.employeeOptions.value.map((item) => item.employeeCode)).toEqual(['EMP-武汉'])
  })

  it('选中省份时汇总其下属城市并合并去重', async () => {
    const options = useOrderRegisterOptions()
    await options.loadOptions()
    mocks.getEmployees.mockClear()

    await options.searchEmployees('', 'ZJ')

    const cities = mocks.getEmployees.mock.calls.map((call) => call[0].cityName).sort()
    expect(cities).toEqual(['杭州', '金华'])
    expect(options.employeeOptions.value).toHaveLength(2)
  })
})
