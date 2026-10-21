import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
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
    props: {
      employees: [
        { employeeCode: 'M1', employeeName: '张经理' },
        { employeeCode: 'M2', employeeName: '李经理' },
      ] as never,
      cities: [
        { code: 'SJZ', name: '石家庄市' },
        { code: 'TS', name: '唐山市' },
      ],
      canWrite: true,
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

describe('城市总提成分组', () => {
  it('显示同一负责人的两城任期，负责人和城市分别筛选并可重置', async () => {
    vi.mocked(getPayrollRules).mockResolvedValue(
      page([
        rule('one'),
        rule('two', 'M1', 'TS'),
        rule('three', 'M2', 'TS', { effectiveTo: '2026-09-30' }),
      ]),
    )
    await open()
    expect(wrapper.findAll('.manager-group')).toHaveLength(2)
    expect(wrapper.findAll('.manager-group')[0]!.text()).toContain('2 个城市')
    expect(wrapper.text()).toContain('已结束')
    await filter('城市总筛选', 'M1')
    await filter('所辖城市筛选', 'TS')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.manager-group')).toHaveLength(1)
    const group = wrapper.get('.manager-group').text()
    expect(group).toContain('唐山市')
    expect(group).not.toContain('石家庄市')
    await click('重置')
    expect(wrapper.findAll('.manager-group')).toHaveLength(2)
  })
  it('按负责人分页，翻页不拆分同一人的城市', async () => {
    const rows = [
      rule('one'),
      rule('two', 'M1', 'TS'),
      ...Array.from({ length: 10 }, (_, i) => rule(`r${i}`, `M${i + 2}`)),
    ]
    vi.mocked(getPayrollRules).mockResolvedValue(page(rows))
    await open()
    expect(wrapper.findAll('.manager-group')).toHaveLength(10)
    expect(wrapper.findAll('.manager-group')[0]!.text()).toContain('2 个城市')
    wrapper.getComponent({ name: 'ElPagination' }).vm.$emit('update:current-page', 2)
    await flushPromises()
    expect(wrapper.findAll('.manager-group')).toHaveLength(1)
    expect(wrapper.get('.manager-group').text()).toContain('M11')
  })
})
