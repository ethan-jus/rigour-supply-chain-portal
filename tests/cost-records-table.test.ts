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
      '单据号 / 事项',
      '费用类别',
      '费用归属',
      '费用日期',
      '金额（元）',
      '确认状态',
      '付款状态',
      '操作',
    ])
    const rendered = wrapper.findAll('tbody tr')
    for (const [index, payment] of ['已付款', '未付款'].entries()) {
      const cells = rendered[index]!.findAll('td')
      expect(cells[0]!.text()).toContain(rows[index]!.documentNo)
      expect(cells[3]!.text()).toBe('2026-09（所属月）')
      expect(cells[4]!.text()).toBe('1,234.50')
      expect(cells[5]!.text()).toBe('已确认')
      expect(cells[6]!.text()).toBe(payment)
    }
    await rendered[1]!.get('button').trigger('click')
    expect(wrapper.emitted('detail')).toEqual([[rows[1]]])
    wrapper.unmount()
  })

  it('发生日不被当作所属月，空结果保留完整八列表格', () => {
    const wrapper = mount(CostRecordsTable, {
      props: { rows: [{ ...row('UNPAID', 'D'), periodBasis: 'DAY' }] },
    })
    expect(wrapper.findAll('tbody td')[3]!.text()).toBe('2026-09-30')
    wrapper.unmount()
    const empty = mount(CostRecordsTable, { props: { rows: [] } })
    expect(empty.get('tbody td').attributes('colspan')).toBe('8')
    expect(empty.text()).toContain('当前筛选范围没有匹配记录')
    empty.unmount()
  })
})
