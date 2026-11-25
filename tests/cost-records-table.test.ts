import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CostRecordsTable from '@/views/supply-chain/bi/cost/CostRecordsTable.vue'
import type { CostRecord } from '@/api/core/bi-cost-dashboard'

const row = (payment: string, sourceId: string): CostRecord => ({
  source: 'HR',
  sourceId,
  documentNo: `2026-09/TEST-${sourceId}`,
  title: '测试员工的月度薪酬及较长的事项说明',
  category: 'labor',
  city: 'CITY',
  cityName: '测试城市',
  date: '2026-09-30',
  costMonth: '2026-09',
  periodBasis: 'MONTH',
  amount: '1234.50',
  status: 'CONFIRMED',
  payment,
  sourceSystem: null,
  employeeName: '测试员工',
})

describe('成本看板支出明细', () => {
  it('确认和付款分别展示，所属月、金额及查看详情对应同一条记录', async () => {
    const rows = [
      { ...row('PAID', 'PAID'), costTreatment: 'LINKED' as const },
      { ...row('UNPAID', 'UNPAID'), costTreatment: 'REVIEW' as const },
    ]
    const wrapper = mount(CostRecordsTable, { props: { rows } })
    expect(wrapper.get('table').attributes('aria-label')).toBe('费用支出明细表')
    expect(wrapper.text()).not.toMatch(/成本处理|统计处理|不重复汇总|计入汇总|LINKED|REVIEW/)
    expect(wrapper.findAll('thead th').map((h) => h.text())).toEqual([
      '单据号',
      '费用事项',
      '费用类别',
      '费用项目',
      '费用归属',
      '费用日期',
      '金额（元）',
      '单据状态',
      '付款状态',
      '操作',
    ])
    const rendered = wrapper.findAll('tbody tr')
    for (const [index, payment] of ['已付款', '未付款'].entries()) {
      const cells = rendered[index]!.findAll('td')
      expect(cells[0]!.text()).toContain(rows[index]!.documentNo)
      expect(cells[0]!.text()).not.toContain(rows[index]!.title)
      expect(cells[1]!.text()).toBe(rows[index]!.title)
      expect(cells[5]!.text()).toBe('2026-09（所属月）')
      expect(cells[6]!.text()).toBe('1,234.50')
      expect(cells[7]!.text()).toBe(index === 0 ? '已确认' : '待核对')
      expect(cells[8]!.text()).toBe(payment)
    }
    await rendered[1]!.get('button').trigger('click')
    expect(wrapper.emitted('detail')).toEqual([[rows[1]]])
    await wrapper.setProps({ review: true })
    expect(wrapper.findAll('thead th')[6]!.text()).toBe('参考金额（元）')
    wrapper.unmount()
  })

  it('运输以资料完整度展示，付款状态独立，其他类别保留确认口径', () => {
    const rows = ['CONFIRMED', 'DRAFT', 'VOID'].map((status) => ({
      ...row('UNPAID', status),
      source: 'ORDER',
      category: 'freight',
      status,
    })) as CostRecord[]
    const w = mount(CostRecordsTable, { props: { rows } })
    expect(w.findAll('tbody tr').map((r) => r.findAll('td')[7]!.text())).toEqual([
      '已完善',
      '待完善',
      '已作废',
    ])
    expect(w.findAll('tbody tr').every((r) => r.findAll('td')[8]!.text() === '未付款')).toBe(true)
    w.unmount()
  })

  it('发生日不被当作所属月，空结果保留完整十列表格', () => {
    const wrapper = mount(CostRecordsTable, {
      props: { rows: [{ ...row('UNPAID', 'D'), periodBasis: 'DAY' }] },
    })
    expect(wrapper.findAll('tbody td')[5]!.text()).toBe('2026-09-30')
    wrapper.unmount()
    const empty = mount(CostRecordsTable, { props: { rows: [] } })
    expect(empty.get('tbody td').attributes('colspan')).toBe('10')
    expect(empty.text()).toContain('当前筛选范围没有匹配记录')
    empty.unmount()
  })
})
