import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DepartmentAnalysis from '@/views/supply-chain/bi/cost/CostDepartmentAnalysis.vue'
const api = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/api/core/bi-cost-dashboard', () => ({ getCostDepartments: api.load }))
describe('部门采购与物流成本', () => {
  it('部门金额与业务员清晰展示，采购和人员下钻保留各自归属条件', async () => {
    api.load.mockResolvedValue([
      {
        departmentId: 'department:10',
        departmentName: '武汉销售部',
        purchaseGoods: '100.10',
        purchaseFreight: '12.30',
        logistics: '40.50',
        transportTypes: [
          { key: 'dict:COST_TRANSPORT_PURPOSE:DELIVERY', label: '销售订单配送', amount: '30.50' },
          { key: 'dict:COST_TRANSPORT_PURPOSE:TRANSFER', label: '仓间调拨', amount: '10.00' },
        ],
        people: [
          { employeeCode: 'employee:E1', employeeName: '张三', role: '业务员', amount: '40.50' },
        ],
      },
    ])
    const w = mount(DepartmentAnalysis, {
      props: { query: { year: 2026, month: 11, city: 'WH', snapshotId: 'snapshot-one' } },
    })
    await flushPromises()
    expect(api.load).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: 'snapshot-one', city: 'WH' }),
      expect.any(AbortSignal),
    )
    expect(w.text()).toContain('112.40')
    expect(w.text()).toContain('30.50')
    expect(w.text()).toContain('10.00')
    await w
      .findAll('button')
      .find((b) => b.text() === '112.40')!
      .trigger('click')
    expect(w.emitted('detail')![0]![0]).toMatchObject({
      scope: 'purchase',
      category: 'purchase',
      department: 'department:10',
    })
    await w
      .findAll('button')
      .find((b) => b.text() === '按人员展开')!
      .trigger('click')
    expect(w.text()).toContain('张三')
    expect(w.text()).toContain('业务员')
    await w
      .findAll('button')
      .find((b) => b.text() === '查看单据')!
      .trigger('click')
    expect(w.emitted('detail')![1]![0]).toMatchObject({
      scope: 'opex',
      category: 'freight',
      department: 'department:10',
      dimension: 'employee',
      dimensionKey: 'employee:E1',
    })
    w.unmount()
  })
  it('筛选变化后不显示上一批旧数据，旧请求返回也不会覆盖新结果', async () => {
    let finish: (rows: unknown[]) => void = () => {}
    api.load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce([])
    const w = mount(DepartmentAnalysis, { props: { query: { year: 2026, month: 11 } } })
    await w.setProps({ query: { year: 2026, month: 10 } })
    await flushPromises()
    finish([
      {
        departmentId: 'old',
        departmentName: '旧部门',
        purchaseGoods: '0',
        purchaseFreight: '0',
        logistics: '10',
        people: [],
      },
    ])
    await flushPromises()
    expect(w.text()).not.toContain('旧部门')
    expect(w.text()).toContain('暂无已确认')
    w.unmount()
  })
})
