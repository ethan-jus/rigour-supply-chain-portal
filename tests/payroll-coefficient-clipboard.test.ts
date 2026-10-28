import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ElementPlus, { ElForm, ElMessage } from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/PayrollCoefficientEditor.vue'
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'
import {
  copyPayrollInterval,
  copyPayrollIntervalGroup,
  readCopiedPayrollInterval,
  readCopiedPayrollIntervalGroup,
  clearPayrollIntervalCopies,
} from '@/utils/payroll-coefficient-clipboard'

const intervals = (): PayrollMetricStep[] => [
  {
    lower: 0,
    upper: 1,
    lowerInclusive: true,
    upperInclusive: false,
    mode: 'LINEAR',
    coefficient: 1,
  },
  {
    lower: 1,
    upper: null,
    lowerInclusive: true,
    upperInclusive: true,
    mode: 'FIXED',
    coefficient: 1.9,
  },
]
const wrappers: VueWrapper[] = []
beforeEach(() => clearPayrollIntervalCopies())
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  ElMessage.closeAll()
  clearPayrollIntervalCopies()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
function mountEditor(steps = intervals(), readonly = false) {
  const model = ref(steps)
  const host = defineComponent({
    setup: () => () =>
      h(ElForm, { disabled: readonly }, () =>
        h(Editor, {
          modelValue: model.value,
          disabled: readonly,
          'onUpdate:modelValue': (value: PayrollMetricStep[]) => {
            model.value = value
          },
        }),
      ),
  })
  const wrapper = mount(host, { global: { plugins: [ElementPlus] } })
  wrappers.push(wrapper)
  return { wrapper, model }
}
async function click(wrapper: VueWrapper, label: string, index = 0) {
  await flushPromises()
  await wrapper
    .findAll('button')
    .filter((button) => button.text() === label)
    [index]!.trigger('click')
  await flushPromises()
}

describe('整组和单行区间直接复制粘贴', () => {
  it('copies a group from a read-only rule and pastes after the source editor is closed, with visible success feedback', async () => {
    const success = vi.spyOn(ElMessage, 'success')
    const source = mountEditor(intervals(), true)
    const copy = source.wrapper
      .findAll('button')
      .find((button) => button.text() === '复制整组区间')!
    expect(copy.attributes('disabled')).toBeUndefined()
    expect(source.wrapper.text()).not.toContain('粘贴整组区间')
    await click(source.wrapper, '复制整组区间')
    expect(success).toHaveBeenCalledWith(expect.stringContaining('整组区间已复制'))
    source.wrapper.unmount()
    const target = mountEditor([{ ...intervals()[0]!, coefficient: 9 }])
    await click(target.wrapper, '粘贴整组区间')
    expect(success).toHaveBeenCalledWith(expect.stringContaining('整组区间已粘贴'))
    expect(target.model.value).toEqual(intervals())
    expect(target.wrapper.find('textarea').exists()).toBe(false)
    expect(target.wrapper.find('[role="dialog"]').exists()).toBe(false)
    target.model.value[0]!.coefficient = 2.4
    expect(source.model.value).toEqual(intervals())
    expect(readCopiedPayrollIntervalGroup()).toEqual(intervals())
  })

  it('copies the previous row into a newly added row and preserves every other row and all six fields', async () => {
    const success = vi.spyOn(ElMessage, 'success')
    const target = mountEditor()
    const original = intervals()
    await click(target.wrapper, '复制本行', 1)
    expect(success).toHaveBeenCalledWith(expect.stringContaining('本行区间已复制'))
    await click(target.wrapper, '增加区间')
    expect(target.model.value).toHaveLength(3)
    await click(target.wrapper, '粘贴到本行', 2)
    expect(success).toHaveBeenCalledWith(expect.stringContaining('本行区间已粘贴'))
    expect(target.model.value.slice(0, 2)).toEqual(original)
    expect(target.model.value[2]).toEqual(original[1])
    expect(target.model.value[2]).not.toBe(target.model.value[1])
    target.model.value[2]!.coefficient = 3
    expect(target.model.value[1]!.coefficient).toBe(1.9)
    expect(readCopiedPayrollInterval()).toEqual(original[1])
    expect(target.wrapper.find('textarea').exists()).toBe(false)
    expect(target.wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('single-row copies remain available in another editor, and repeated pastes do not share editable references', async () => {
    const source = mountEditor(intervals(), true)
    await flushPromises()
    const copy = source.wrapper.findAll('button').find((button) => button.text() === '复制本行')!
    expect(copy.attributes('disabled')).toBeUndefined()
    expect(source.wrapper.text()).not.toContain('粘贴到本行')
    await click(source.wrapper, '复制本行')
    source.wrapper.unmount()
    const target = mountEditor()
    await click(target.wrapper, '粘贴到本行', 1)
    target.model.value[1]!.lower = 0.7
    await click(target.wrapper, '增加区间')
    await click(target.wrapper, '粘贴到本行', 2)
    expect(target.model.value[2]).toEqual(intervals()[0])
    expect(source.model.value).toEqual(intervals())
  })

  it('group and row buffers are independent, so copying one scope does not overwrite the other', async () => {
    copyPayrollIntervalGroup(intervals())
    copyPayrollInterval({ ...intervals()[0]!, coefficient: 5 })
    const target = mountEditor()
    await click(target.wrapper, '粘贴整组区间')
    expect(target.model.value).toEqual(intervals())
    await click(target.wrapper, '粘贴到本行', 1)
    expect(target.model.value[0]).toEqual(intervals()[0])
    expect(target.model.value[1]!.coefficient).toBe(5)
    expect(readCopiedPayrollIntervalGroup()).toEqual(intervals())
  })

  it('disables each paste action until that scope has been copied, then clears both on session reset', async () => {
    const target = mountEditor()
    const pastes = () =>
      target.wrapper.findAll('button').filter((button) => button.text().startsWith('粘贴'))
    expect(pastes().every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    await click(target.wrapper, '复制本行')
    expect(
      target.wrapper
        .findAll('button')
        .find((button) => button.text() === '粘贴整组区间')!
        .attributes('disabled'),
    ).toBeDefined()
    clearPayrollIntervalCopies()
    await flushPromises()
    expect(pastes().every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(readCopiedPayrollIntervalGroup()).toBeNull()
    expect(readCopiedPayrollInterval()).toBeNull()
  })

  it('copies drafts exactly, including empty values, open upper bounds and overlapping intervals', () => {
    const draft = [...intervals(), { ...intervals()[0]!, coefficient: null }]
    copyPayrollIntervalGroup(draft)
    expect(readCopiedPayrollIntervalGroup()).toEqual(draft)
    draft[0]!.lower = 4
    expect(readCopiedPayrollIntervalGroup()![0]!.lower).toBe(0)
  })
})
