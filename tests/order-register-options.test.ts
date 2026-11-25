import { describe, expect, it, vi } from 'vitest'
import { usePaymentFilterOptions } from '@/composables/usePaymentFilterOptions'
import { getPaymentFilterOptions } from '@/api/core/payment-filter-options'

vi.mock('@/api/core/payment-filter-options', () => ({ getPaymentFilterOptions: vi.fn() }))

describe('台账菜单内的筛选', () => {
  it('商品明细只请求本页选项，历史销售与跨市回款人分别可选', async () => {
    vi.mocked(getPaymentFilterOptions).mockResolvedValue({
      areas: [{ code: 'SZ', name: '苏州' }],
      departments: [{ id: 20, parentId: 1, departmentName: '无锡市部', sortOrder: 0 }],
      employees: [{ employeeCode: 'ZS', employeeName: '张三', regionCode: 'SZ' }],
      paymentEmployees: [{ employeeCode: 'LS', employeeName: '李四', regionCode: null }],
      creators: [], categories: [], products: [{id:'71', productCode:'A',productName:'商品A',categoryId:null,variants:[]}],
    })
    const filters=usePaymentFilterOptions('lines')
    await filters.loadOptions()
    expect(getPaymentFilterOptions).toHaveBeenCalledWith('lines')
    expect(filters.departmentOptionsTree.value.map(row => row.id)).toEqual([20])
    await filters.searchEmployees('张')
    expect(filters.employeeOptions.value.map(row => row.employeeCode)).toEqual(['ZS'])
    await filters.searchCollectors('李')
    expect(filters.collectorOptions.value.map(row => row.employeeCode)).toEqual(['LS'])
    expect((await filters.productSources.products({begin:0,step:20,productCode:'A'})).items).toHaveLength(1)
  })
})
