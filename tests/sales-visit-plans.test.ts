import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const messages = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('@/api', () => ({ apiClient: api }))
vi.mock('element-plus', () => ({
  ElMessage: {
    success: messages.success,
    warning: messages.warning,
    error: messages.error,
  },
  ElMessageBox: { confirm: messages.confirm },
}))

import SalesVisitPlans from '@/views/supply-chain/sales/SalesVisitPlans.vue'

const passthrough = defineComponent({ template: '<div><slot /></div>' })
const buttonStub = defineComponent({
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
})
const selectStub = defineComponent({
  props: { modelValue: { type: [String, Number], default: '' } },
  emits: ['update:modelValue', 'change'],
  template: `
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value); $emit('change', $event.target.value)"
    ><slot /></select>
  `,
})
const optionStub = defineComponent({
  props: { label: { type: String, default: '' }, value: { type: [String, Number], default: '' } },
  template: '<option :value="value">{{ label }}</option>',
})
const inputStub = defineComponent({
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const dialogStub = defineComponent({
  props: { modelValue: { type: Boolean, default: false } },
  template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
})
const emptyStub = defineComponent({ template: '<span />' })

describe('主管拜访计划页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation((url: string) => {
      if (url.endsWith('/profiles')) {
        return Promise.resolve([{ salesProfileId: 'profile-1', employeeId: 'employee-1', salesNo: 'S001', cityOrgId: null }])
      }
      if (url.endsWith('/targets')) {
        return Promise.resolve({
          items: [{ storeId: 'store-1', customerName: '测试客户', storeName: '测试门店', storeAddress: '测试路1号' }],
        })
      }
      return Promise.resolve({
        from: '2026-08-11', to: '2026-08-31', status: null,
        items: [], page: 1, pageSize: 20, total: 0,
      })
    })
    api.post.mockResolvedValue({ planId: 'plan-1' })
  })

  it('加载真实计划/销售数据，并从主管表单创建计划', async () => {
    const wrapper = mount(SalesVisitPlans, {
      global: {
        directives: { loading: () => {} },
        stubs: {
          ElAlert: passthrough,
          ElButton: buttonStub,
          ElCard: passthrough,
          ElDatePicker: passthrough,
          ElDialog: dialogStub,
          ElForm: passthrough,
          ElFormItem: passthrough,
          ElInput: inputStub,
          ElOption: optionStub,
          ElPagination: passthrough,
          ElSelect: selectStub,
          ElTable: passthrough,
          ElTableColumn: emptyStub,
          ElTag: passthrough,
        },
      },
    })
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/sales/management/visit-plans', expect.any(Object))
    expect(api.get).toHaveBeenCalledWith('/sales/management/visit-plans/profiles')

    await wrapper.findAll('button').find((button) => button.text() === '新增计划')!.trigger('click')
    await flushPromises()
    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('profile-1')
    await flushPromises()
    await wrapper.findAll('select')[2]!.setValue('store-1')
    await wrapper.find('textarea').setValue('核对陈列并确认补货计划')
    await wrapper.findAll('button').find((button) => button.text() === '保存计划')!.trigger('click')
    await flushPromises()

    expect(api.post).toHaveBeenCalledWith('/sales/management/visit-plans', expect.objectContaining({
      salesProfileId: 'profile-1',
      storeId: 'store-1',
      objective: '核对陈列并确认补货计划',
      version: null,
    }))
    expect(messages.success).toHaveBeenCalledWith('计划已创建')
  })
})
