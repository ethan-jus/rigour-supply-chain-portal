import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import ElementPlus from 'element-plus'
import { vClearFilterOnEmptyInput } from '@/utils/filter-select-clear'

const Probe = defineComponent({
  directives: { clearFilterOnEmptyInput: vClearFilterOnEmptyInput },
  template: `
    <el-select
      v-model="value"
      v-clear-filter-on-empty-input="() => (value = '')"
      filterable
      clearable
      aria-label="业务员"
    >
      <el-option label="张三" value="EMP1" />
      <el-option label="李四" value="EMP2" />
    </el-select>
  `,
  setup() {
    return { value: ref('EMP1') }
  },
})

describe('筛选下拉清空搜索文字即清条件', () => {
  it('输入过搜索词并把输入框删空后失焦，已选条件被清掉', async () => {
    const wrapper = mount(Probe, { global: { plugins: [ElementPlus] }, attachTo: document.body })
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: '张' })
    await input.setValue('')
    await input.trigger('focusout')
    expect((wrapper.vm as unknown as { value: string }).value).toBe('')
    wrapper.unmount()
  })

  it('搜索并选中后组件清空搜索框，失焦不能清除选择', async () => {
    const wrapper = mount(Probe, { global: { plugins: [ElementPlus] }, attachTo: document.body })
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: '张' })
    await input.setValue('张')
    // 模拟选中选项后 Element Plus 清空搜索文本，不产生用户 input 事件。
    input.element.value = ''
    await input.trigger('focusout')
    expect((wrapper.vm as unknown as { value: string }).value).toBe('EMP1')
    wrapper.unmount()
  })

  it('没有输入搜索词时失焦不清已选值', async () => {
    const wrapper = mount(Probe, { global: { plugins: [ElementPlus] }, attachTo: document.body })
    const input = wrapper.find('input')
    await input.trigger('focusout')
    expect((wrapper.vm as unknown as { value: string }).value).toBe('EMP1')
    wrapper.unmount()
  })
})
