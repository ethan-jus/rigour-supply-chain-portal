import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DepartmentAnalysis from '@/views/supply-chain/bi/cost/CostDepartmentAnalysis.vue'
import { clearBusinessDictionariesForTest } from '@/utils/business-dictionary'
const api = vi.hoisted(() => ({ load: vi.fn(), dictionary: vi.fn() }))
vi.mock('@/api/core/bi-cost-dashboard', () => ({ getCostDepartments: api.load }))
vi.mock('@/api/core/business-settings', () => ({ resolveBizDict: api.dictionary }))

beforeEach(() => {
  clearBusinessDictionariesForTest()
  api.dictionary.mockReset().mockResolvedValue({ items: [] })
})

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
    expect(w.get('thead').text()).toContain('订单配送')
    expect(w.get('thead').text()).not.toContain('销售订单配送')
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
    expect(w.text()).toContain('暂无非零采购及物流成本')
    w.unmount()
  })

  it('隐藏全零行列，沿用订单配送名称和下钻编码', async () => {
    const delivery = 'dict:COST_TRANSPORT_PURPOSE:DELIVERY'
    const transfer = 'dict:COST_TRANSPORT_PURPOSE:TRANSFER'
    const zeroDepartment = {
      departmentId: 'department:10',
      departmentName: '西安市',
      purchaseGoods: '0',
      purchaseFreight: '0.00',
      logistics: '0.00',
      people: [],
      transportTypes: [{ key: transfer, label: 'TRANSFER', amount: '0.00' }],
    }
    const logisticsDepartment = {
      ...zeroDepartment,
      departmentId: 'department:20',
      departmentName: '广州市',
      logistics: '110.07',
      transportTypes: [
        { key: delivery, label: 'DELIVERY', amount: '110.07' },
        ...zeroDepartment.transportTypes,
      ],
      people: [
        { employeeCode: 'employee:E1', employeeName: '张三', role: '业务员', amount: '110.07' },
        { employeeCode: 'employee:E2', employeeName: '李四', role: '业务员', amount: '0.00' },
      ],
    }
    let finishDictionary: (result: unknown) => void = () => {}
    api.dictionary.mockImplementationOnce(
      () => new Promise((resolve) => (finishDictionary = resolve)),
    )
    api.load
      .mockResolvedValueOnce([zeroDepartment, logisticsDepartment])
      .mockResolvedValueOnce([zeroDepartment])
    const w = mount(DepartmentAnalysis, { props: { query: { year: 2026, month: 11 } } })
    await flushPromises()

    const table = w.get('table[aria-label="部门采购及物流成本"]')
    expect(
      table
        .get('thead')
        .findAll('th')
        .map((th) => th.text()),
    ).toEqual(['部门', '订单配送', '物流成本合计', '明细'])
    expect(table.text()).toContain('广州市')
    expect(table.text()).not.toContain('西安市')
    expect(api.dictionary).toHaveBeenCalledWith('COST_TRANSPORT_PURPOSE', 'inline')
    finishDictionary({
      items: [{ dictionaryItemCode: 'DELIVERY', dictionaryItemName: '销售订单配送', ordinal: 30 }],
    })
    await flushPromises()
    expect(table.get('thead').text()).toContain('订单配送')
    expect(table.get('thead').text()).not.toContain('销售订单配送')
    await table.get('tbody tr td:nth-child(2) button').trigger('click')
    expect(w.emitted('detail')?.[0]?.[0]).toMatchObject({
      department: 'department:20',
      category: 'freight',
      dimension: 'leg',
      dimensionKey: delivery,
    })
    await table.get('tbody tr td:last-child button').trigger('click')
    expect(table.get('td[colspan]').attributes('colspan')).toBe('4')
    const people = table.get('table[aria-label="广州市人员物流成本"]')
    expect(people.text()).toContain('张三')
    expect(people.text()).not.toContain('李四')

    await w.setProps({ query: { year: 2026, month: 10 } })
    await flushPromises()
    expect(w.get('td.empty').text()).toBe('当前期间暂无非零采购及物流成本')
    expect(w.get('td.empty').attributes('colspan')).toBe('2')
    w.unmount()
  })
})
