import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Select from '@/views/supply-chain/cost/CostExpenseEmployeeSelect.vue'
import { getCostEmployees, type CostEmployee } from '@/api/core/cost'
vi.mock('@/api/core/cost', () => ({ getCostEmployees: vi.fn() }))
const wh: CostEmployee = {
  employeeCode: 'WH',
  employeeName: '武汉员工',
  departmentId: 2,
  departmentName: '总部',
  cityName: '武汉市',
}
const bj: CostEmployee = {
  employeeCode: 'BJ',
  employeeName: '北京员工',
  departmentId: 1,
  departmentName: '武汉市',
  cityName: '北京市',
}
let wrapper: VueWrapper
beforeEach(() => vi.resetAllMocks())
afterEach(() => wrapper?.unmount())
const render = async (props = {}) => {
  wrapper = mount(Select, {
    props: {
      modelValue: null,
      cityCode: '4201',
      cityName: '武汉市',
      costDate: '2026-10-22',
      ...props,
    },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
  return wrapper
}
describe('报销员工与费用归属联动', () => {
  it('未选择城市时不可选员工，不请求全量员工', async () => {
    await render({ cityCode: '', cityName: '' })
    expect(wrapper.findComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    expect(getCostEmployees).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'ElSelect' }).props('placeholder')).toBe(
      '请先选择费用归属',
    )
  })
  it('按所选城市与费用发生日向现有 HR 服务查询', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([wh])
    await render()
    expect(getCostEmployees).toHaveBeenCalledWith('expenses', {
      cityCode: '4201',
      cityName: '武汉市',
      costDate: '2026-10-22',
    })
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).map((row) => row.props('value')),
    ).toEqual(['WH'])
  })
  it('切换城市清除不再适用的员工并通知表单清理归属资料', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([bj])
    await render({ modelValue: 'WH' })
    await wrapper.setProps({ cityCode: '1101', cityName: '北京市' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('picked')?.at(-1)).toEqual([null])
    expect(
      wrapper
        .findAllComponents({ name: 'ElOption' })
        .filter((row) => !row.props('disabled'))
        .map((row) => row.props('value')),
    ).toEqual(['BJ'])
  })
  it('多城市负责人在新城市仍匹配时保留选择', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([wh])
    await render({ modelValue: 'WH' })
    await wrapper.setProps({ cityCode: '1101', cityName: '北京市' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it('费用日期改变时重新核对任期', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([])
    await render({ modelValue: 'WH' })
    await wrapper.setProps({ costDate: '2026-09-30' })
    await flushPromises()
    expect(getCostEmployees).toHaveBeenLastCalledWith(
      'expenses',
      expect.objectContaining({ costDate: '2026-09-30' }),
    )
    expect(wrapper.emitted('picked')?.at(-1)).toEqual([null])
  })
  it('只有明确选择跨城报销才读取其他授权员工', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([wh, bj])
    await render()
    const checkbox = wrapper.findComponent({ name: 'ElCheckbox' })
    checkbox.vm.$emit('update:modelValue', true)
    checkbox.vm.$emit('change', true)
    await flushPromises()
    expect(getCostEmployees).toHaveBeenLastCalledWith('expenses', undefined)
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).map((row) => row.props('value')),
    ).toEqual(['WH', 'BJ'])
  })
  it('跨城后切换总部按总部规则重新取人，不沿用无归属查询', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([wh, bj])
      .mockResolvedValueOnce([wh, bj])
    await render()
    const checkbox = wrapper.findComponent({ name: 'ElCheckbox' })
    checkbox.vm.$emit('update:modelValue', true)
    checkbox.vm.$emit('change', true)
    await flushPromises()
    await wrapper.setProps({ cityCode: 'COST_HEADQUARTERS', cityName: '总部' })
    await flushPromises()
    expect(getCostEmployees).toHaveBeenLastCalledWith('expenses', expect.objectContaining({
      cityCode: 'COST_HEADQUARTERS', cityName: '总部',
    }))
    expect(wrapper.findComponent({ name: 'ElCheckbox' }).exists()).toBe(false)
    expect(wrapper.findAllComponents({ name: 'ElOption' }).map(row => row.props('value'))).toEqual(['WH', 'BJ'])
  })
  it('费用城市变化后需要重新明确跨城选择，不能沿用上一城市的跨城状态', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([wh, bj])
      .mockResolvedValueOnce([bj])
    await render()
    const checkbox = wrapper.findComponent({ name: 'ElCheckbox' })
    checkbox.vm.$emit('update:modelValue', true)
    checkbox.vm.$emit('change', true)
    await flushPromises()
    await wrapper.setProps({ cityCode: '1101', cityName: '北京市' })
    await flushPromises()
    expect(getCostEmployees).toHaveBeenLastCalledWith('expenses', expect.objectContaining({ cityCode: '1101' }))
    expect(wrapper.findComponent({ name: 'ElCheckbox' }).props('modelValue')).toBe(false)
  })
  it('编辑历史跨城报销保留原员工，并明确显示跨城状态', async () => {
    vi.mocked(getCostEmployees).mockResolvedValueOnce([wh]).mockResolvedValueOnce([wh, bj])
    await render({ modelValue: 'BJ', snapshot: '北京员工' })
    expect(wrapper.findComponent({ name: 'ElCheckbox' }).props('modelValue')).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it('历史员工已无权限时不能作为隐藏选项继续提交', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([wh])
    await render({ modelValue: 'GONE', snapshot: '原员工' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
  it('慢请求不能覆盖切换城市后的结果', async () => {
    let resolveFirst!: (value: CostEmployee[]) => void
    vi.mocked(getCostEmployees)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce([bj])
    wrapper = mount(Select, {
      props: { modelValue: null, cityCode: '4201', cityName: '武汉市' },
      global: { plugins: [ElementPlus] },
    })
    await wrapper.setProps({ cityCode: '1101', cityName: '北京市' })
    await flushPromises()
    resolveFirst([wh])
    await flushPromises()
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).map((row) => row.props('value')),
    ).toEqual(['BJ'])
  })
  it('选择员工时回传当前选项资料，而非读取尚未刷新到父表单的值', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([wh])
    await render()
    const select = wrapper.findComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', 'WH')
    select.vm.$emit('change', 'WH')
    expect(wrapper.emitted('picked')?.at(-1)).toEqual([wh])
  })
  it('本城市有效管辖人显示管辖城市，避免误把其部门当作费用城市', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([bj])
    await render()
    expect(wrapper.findComponent({ name: 'ElOption' }).props('label')).toBe('北京员工 · 管辖武汉市')
  })
  it('编辑打开期间切换城市，不会自动把旧员工改成跨城报销', async () => {
    let resolveFirst!: (value: CostEmployee[]) => void
    vi.mocked(getCostEmployees)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce([bj])
    wrapper = mount(Select, {
      props: { modelValue: 'WH', cityCode: '4201', cityName: '武汉市' },
      global: { plugins: [ElementPlus] },
    })
    await wrapper.setProps({ cityCode: '1101', cityName: '北京市' })
    await flushPromises()
    resolveFirst([wh])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElCheckbox' }).props('modelValue')).toBe(false)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    expect(getCostEmployees).toHaveBeenCalledTimes(2)
  })
  it('失败显示可重试提示，成功后恢复正常选择', async () => {
    vi.mocked(getCostEmployees)
      .mockRejectedValueOnce(new Error('员工读取失败'))
      .mockResolvedValueOnce([wh])
    await render()
    expect(wrapper.text()).toContain('员工读取失败')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).map((row) => row.props('value')),
    ).toEqual(['WH'])
  })
  it('总部费用使用已授权员工资料，不显示跨城或管辖总部', async () => {
    vi.mocked(getCostEmployees).mockResolvedValue([wh, bj])
    await render({ cityCode: 'COST_HEADQUARTERS', cityName: '总部' })
    expect(getCostEmployees).toHaveBeenCalledWith(
      'expenses',
      expect.objectContaining({ cityCode: 'COST_HEADQUARTERS', cityName: '总部' }),
    )
    expect(wrapper.findComponent({ name: 'ElCheckbox' }).exists()).toBe(false)
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).map((row) => row.props('label')),
    ).toEqual(['武汉员工 · 武汉市', '北京员工 · 北京市'])
    expect(wrapper.text()).not.toContain('管辖总部')
  })
})
