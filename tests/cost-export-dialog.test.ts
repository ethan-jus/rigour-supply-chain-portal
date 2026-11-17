import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Dialog from '@/views/supply-chain/cost/CostExportDialog.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
const columns = [
  { key: 'number', label: '费用单号' },
  { key: 'department', label: '部门' },
]

describe('导出字段业务分组', () => {
  it('跨分组勾选保留其他组的选择，不生成重复选项', async () => {
    let fields = ['number', 'department']
    wrapper = mount(Dialog, {
      props: {
        modelValue: true,
        fields,
        columns,
        scope: '已选1条运输记录',
        busy: false,
        sections: [
          { label: '运输摘要', keys: ['number'] },
          { label: '业务明细', keys: ['department', 'number'] },
          { label: '货拉拉资料', keys: ['platformStatus'] },
        ],
        'onUpdate:fields': (value: string[]) => {
          fields = value
          void wrapper!.setProps({ fields: value })
        },
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('货拉拉资料')
    const department = wrapper
      .findAllComponents({ name: 'ElCheckbox' })
      .find((c) => c.props('value') === 'department')!
    await department.get('input').setValue(false)
    await flushPromises()
    expect(fields).toEqual(['number'])
    await department.get('input').setValue(true)
    await flushPromises()
    expect(fields).toEqual(['number', 'department'])
  })
  it('其他成本页面未提供分组时保留原有全部字段', async () => {
    wrapper = mount(Dialog, {
      props: { modelValue: true, fields: ['number'], columns, scope: '全部筛选结果', busy: false },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('费用单号')
    expect(wrapper.text()).toContain('部门')
    expect(wrapper.find('h3').exists()).toBe(false)
  })
})
