import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '@/views/supply-chain/hr/components/CityManagerPanel.vue'
import { completePages, managerGroups } from '@/views/supply-chain/hr/city-manager-model'
import { getPayrollRules, type PayrollRule } from '@/api/core/payroll'

vi.mock('@/api/core/payroll', () => ({ getPayrollRules: vi.fn(), getPayrollDepartments: vi.fn() }))
const rule = (
  id: string,
  employeeCode = 'M1',
  cityCode = 'SJZ',
  extra: Partial<PayrollRule['data']> = {},
): PayrollRule => ({
  id,
  revision: 0,
  updatedTime: '',
  data: {
    kindCode: 'CITY_MANAGER',
    employeeCode,
    cityCode,
    cityName: cityCode === 'SJZ' ? '石家庄市' : '唐山市',
    enabled: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: '9999-12-31',
    includeOwnSalesCommission: false,
    ...extra,
  } as PayrollRule['data'],
})
const page = <T>(items: T[], begin = 0, total = items.length) => ({
  items,
  begin,
  total,
  step: 200,
})
let wrapper: VueWrapper
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T04:00:00Z'))
  vi.mocked(getPayrollRules).mockResolvedValue(page([rule('one'), rule('two', 'M1', 'TS')]))
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  document.body.innerHTML = ''
})
async function open() {
  wrapper = mount(Panel, {
    attachTo: document.body,
    props: {
      employees: [
        { employeeCode: 'M1', employeeName: '张经理' },
        { employeeCode: 'M2', employeeName: '李经理' },
      ] as never,
      cities: [
        { code: 'SJZ', name: '石家庄市' },
        { code: 'TS', name: '唐山市' },
      ],
      canOpenEmployee: true,
    },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
}
async function click(text: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === text)!
    .trigger('click')
  await flushPromises()
}
async function filter(label: string, value: string) {
  wrapper
    .findAllComponents({ name: 'ElSelect' })
    .find((s) => s.props('ariaLabel') === label)!
    .vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function expandedCities(index = 0) {
  const summary = wrapper.findAllComponents({ name: 'SupplyScopeSummary' })[index]!
  await summary.get('button').trigger('click')
  await flushPromises()
  const visibleList = () =>
    [...document.body.querySelectorAll('[aria-label="全部城市"]')]
      .map((list) => new DOMWrapper(list))
      .find((list) => list.isVisible())
  await vi.waitFor(() => expect(visibleList()).toBeDefined())
  return visibleList()!
    .findAll('li')
    .map((item) => item.text())
}

describe('城市总完整规则分组', () => {
  it('跨接口分页读取并合并同一负责人，不漏掉最后一页城市', async () => {
    const first = Array.from({ length: 200 }, (_, i) => rule(`r${i}`))
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(first, 0, 201))
      .mockResolvedValueOnce(page([rule('last', 'M1', 'TS')], 200, 201))
    const rows = await completePages<PayrollRule>(fetch)
    expect(fetch.mock.calls).toEqual([[0], [200]])
    expect(managerGroups(rows)).toHaveLength(1)
    expect(managerGroups(rows, 'M1', 'TS')[0]!.assignments.map((r) => r.id)).toEqual(['last'])
    expect(managerGroups(rows, 'M2', 'TS')).toEqual([])
  })
  it('分页总数变化、空缺页或失败不能返回部分结果冒充完整名单', async () => {
    await expect(
      completePages(
        vi
          .fn()
          .mockResolvedValueOnce(page([1], 0, 2))
          .mockResolvedValueOnce(page([2], 1, 3)),
      ),
    ).rejects.toThrow('发生变化')
    await expect(
      completePages(
        vi
          .fn()
          .mockResolvedValueOnce(page([1], 0, 2))
          .mockResolvedValueOnce(page([], 1, 2)),
      ),
    ).rejects.toThrow('未完整返回')
    await expect(
      completePages(
        vi
          .fn()
          .mockResolvedValueOnce(page([1], 0, 2))
          .mockRejectedValueOnce(new Error('查询失败')),
      ),
    ).rejects.toThrow('查询失败')
  })
})

describe('城市总管辖汇总', () => {
  it('只汇总并跳转档案，不提供第二套管辖或提成编辑入口', async () => {
    await open()
    expect(wrapper.text()).not.toContain('增加管辖城市')
    expect(wrapper.text()).not.toContain('编辑')
    expect(wrapper.text()).not.toContain('独立商品提成')
    await click('查看员工档案')
    expect(wrapper.emitted('openEmployee')).toEqual([['M1']])
    await wrapper.setProps({ canOpenEmployee: false })
    expect(wrapper.text()).not.toContain('查看员工档案')
  })
  it('一人一行展示城市摘要，可展开完整名单，按城市筛选也不隐藏该人的其他城市', async () => {
    vi.mocked(getPayrollRules).mockResolvedValue(
      page([
        rule('one'),
        rule('two', 'M1', 'TS'),
        rule('three', 'M2', 'TS', { effectiveTo: '2026-09-30' }),
      ]),
    )
    await open()
    expect(wrapper.findAllComponents({ name: 'ElTable' })).toHaveLength(1)
    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['城市总', '当前管辖城市', '操作'])
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(2)
    expect(wrapper.text()).toContain('暂无在管城市')
    expect(wrapper.text()).not.toContain('任期开始')
    expect(wrapper.text()).not.toContain('备注')
    await filter('城市总筛选', 'M1')
    await filter('管辖城市筛选', 'TS')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(1)
    const group = wrapper.get('.el-table__body-wrapper .el-table__row').text()
    expect(group).toContain('石家庄市')
    expect(group).toContain('共 2 个')
    expect(await expandedCities()).toEqual(['石家庄市', '唐山市'])
    await click('重置')
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(2)
  })
  it('按负责人分页，翻页不拆分同一人的城市', async () => {
    const rows = [
      rule('one'),
      rule('two', 'M1', 'TS'),
      ...Array.from({ length: 10 }, (_, i) => rule(`r${i}`, `M${i + 2}`)),
    ]
    vi.mocked(getPayrollRules).mockResolvedValue(page(rows))
    await open()
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(10)
    expect(await expandedCities()).toEqual(['石家庄市', '唐山市'])
    wrapper.getComponent({ name: 'ElPagination' }).vm.$emit('update:current-page', 2)
    await flushPromises()
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(1)
    expect(wrapper.get('.el-table__body-wrapper .el-table__row').text()).toContain('M11')
  })
  it('当前城市不包含未来、已结束或停用任期；同一城市只展示一次', async () => {
    vi.mocked(getPayrollRules).mockResolvedValue(
      page([
        rule('active'),
        rule('duplicate'),
        rule('future', 'M1', 'TS', { effectiveFrom: '2026-10-15' }),
        rule('ended', 'M2', 'TS', { effectiveTo: '2026-10-13' }),
        rule('disabled', 'M2', 'TS', { enabled: false }),
      ]),
    )
    await open()
    expect(wrapper.findAllComponents({ name: 'SupplyScopeSummary' })).toHaveLength(1)
    expect(wrapper.get('.scope-summary__preview').text()).toBe('石家庄市')
    expect(wrapper.find('.scope-summary__more').exists()).toBe(false)
    await filter('管辖城市筛选', 'TS')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body-wrapper .el-table__row')).toHaveLength(0)
  })
})
