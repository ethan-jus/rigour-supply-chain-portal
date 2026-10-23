import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Source from '@/views/supply-chain/cost/CostRelatedSource.vue'
import { getCost, type CostCommand, type CostRecord } from '@/api/core/cost'
import { costSourceLabel, relatedCostCategory } from '@/views/supply-chain/cost/cost-source'

const access = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => access.allowed }),
}))
vi.mock('@/api/core/cost', () => ({ getCost: vi.fn() }))
const data = () =>
  ({
    expense: {
      costCategory: 'freight',
      relatedCost: { source: 'ORDER', category: 'LOGISTICS', id: 'original-id', revision: 2 },
    },
  }) as CostCommand
beforeEach(() => {
  vi.clearAllMocks()
  access.allowed = true
})

describe('reimbursement original cost trace', () => {
  it('uses the original service and business document instead of exposing a UUID as the source', async () => {
    vi.mocked(getCost).mockResolvedValue({
      id: 'original-id',
      documentNo: 'CST001',
      revision: 2,
      statusCode: 'CONFIRMED',
      data: { title: '门店配送', cityName: '武汉市', costDate: '2026-10-21', amount: 35 },
    } as CostRecord)
    const wrapper = mount(Source, { props: { data: data() } })
    await flushPromises()
    expect(getCost).toHaveBeenCalledWith('logistics', 'original-id')
    expect(wrapper.text()).toContain('CST001 · 门店配送')
    expect(wrapper.get('a').attributes('href')).toBe(
      '#/supply-chain/cost/logistics?sourceId=original-id',
    )
    expect(costSourceLabel({ data: data() } as CostRecord)).toBe('报销登记 · 已关联原费用')
    wrapper.unmount()
  })
  it('does not request a restricted source and explains changed source records', async () => {
    access.allowed = false
    const denied = mount(Source, { props: { data: data() } })
    await flushPromises()
    expect(getCost).not.toHaveBeenCalled()
    expect(denied.text()).toContain('无原费用查看权限')
    denied.unmount()
    access.allowed = true
    vi.mocked(getCost).mockResolvedValue({
      id: 'original-id',
      documentNo: 'CST001',
      revision: 3,
      statusCode: 'DRAFT',
      data: { title: '门店配送', cityName: '武汉市', costDate: '2026-10-21', amount: 40 },
    } as CostRecord)
    const changed = mount(Source, { props: { data: data() } })
    await flushPromises()
    expect(changed.text()).toContain('原费用已变更')
    expect(changed.text()).toContain('待确认')
    changed.unmount()
  })
  it('keeps warehouse and office sources distinct and rejects unsupported source categories', () => {
    const rental = data()
    rental.expense!.relatedCost = { source: 'ERP', category: 'RENTAL', id: 'rent', revision: 1 }
    rental.expense!.costCategory = 'warehouse'
    expect(relatedCostCategory(rental)).toBe('warehouse-rentals')
    rental.expense!.costCategory = 'office'
    expect(relatedCostCategory(rental)).toBe('office-rentals')
    rental.expense!.relatedCost.category = 'PAYROLL'
    expect(relatedCostCategory(rental)).toBeNull()
  })
})
