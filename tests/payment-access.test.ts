import { describe, expect, it, vi } from 'vitest'
import { constantRoutes } from '@/router/routes'
import { getPaymentFilterOptions } from '@/api/core/payment-filter-options'
import { usePaymentFilterOptions } from '@/composables/usePaymentFilterOptions'
import { useOrderProductFilters } from '@/composables/useOrderProductFilters'
import { reactive, effectScope } from 'vue'

vi.mock('@/api/core/payment-filter-options', () => ({ getPaymentFilterOptions: vi.fn() }))
vi.mock('@/api/core/erp-product', () => ({ getErpManagedProducts: vi.fn(() => { throw new Error('禁止直接读取 ERP') }) }))
vi.mock('@/api/core/erp-internal', () => ({ getErpProductCategories: vi.fn(() => { throw new Error('禁止直接读取 ERP') }) }))

describe('财务回款独立权限', () => {
  it('回款使用专属权限，订单页面仍要求订单查看', () => {
    const routes = constantRoutes.find(row => row.path === '/supply-chain')!.children!
    expect(routes.find(row => row.path === 'order/invoices')?.meta?.permission).toBe('order:invoice:read')
    expect(routes.find(row => row.name === 'SupplyOrderSalesPayments')?.meta?.permission).toBe('order:payment:read')
    expect(routes.find(row => row.path === 'order/register')?.meta?.permission ?? routes.find(row => row.name === 'SupplyOrderRegister')?.meta?.permission).not.toBe('order:payment:read')
  })
  it('人员、地区和商品筛选仅通过回款选项接口且保留商品规格交集', async () => {
    vi.mocked(getPaymentFilterOptions).mockResolvedValue({
      areas: [{ code: 'BJ', name: '北京' }],
      departments: [{ id: 1, parentId: null, departmentName: '北京', sortOrder: 0 }],
      employees: [{ employeeCode: 'E1', employeeName: '张三', regionCode: 'BJ' },
        { employeeCode: 'E2', employeeName: '李四', regionCode: 'SH' }],
      creators: ['创建人'],
      categories: [{ id: '1', parentId: null, categoryName: '食品' }],
      products: [{ id: '10', productCode: 'P10', productName: '商品', categoryId: '1',
        variants: [{ id: '20', specificationSnapshot: '规格' }] }],
    })
    const options = usePaymentFilterOptions()
    await Promise.all([options.loadOptions(), options.loadOptions()])
    expect(getPaymentFilterOptions).toHaveBeenCalledTimes(1)
    await options.searchEmployees('张', 'BJ')
    expect(options.employeeOptions.value.map(row => row.employeeCode)).toEqual(['E1'])
    expect(options.areaLabel('BJ')).toBe('北京')
    const scope = effectScope()
    const filters = reactive({ categoryIds: ['1'], productIds: ['10'], productVariantIds: [] as string[] })
    const products = scope.run(() => useOrderProductFilters(filters, options.productSources))!
    expect(await products.resolveProductIds()).toEqual([10])
    await products.loadVariants()
    expect(products.variantGroups.value[0].variants[0].id).toBe('20')
    scope.stop()
  })
})
