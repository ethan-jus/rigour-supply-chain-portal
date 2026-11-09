import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ElementPlus, { ElDatePicker } from 'element-plus'
import CustomerResponsibilityDrawer from '@/views/supply-chain/crm/CustomerResponsibilityDrawer.vue'
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
vi.mock('@/api/core/customer-responsibility', () => ({ customerResponsibility: mocks.get, transferCustomer: mocks.save, resolveResponsibility: vi.fn(), responsibilityEmployees: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: vi.fn().mockResolvedValue([{code:'HZ',name:'杭州',status:'ACTIVE'}]) }))
describe('客户交接历史', () => {
  it('区分同步发现和真实生效时间，保存时提交用户选择的交接时点', async () => {
    const state={customerId:'1',customerName:'客户',employeeCode:'LI',employeeName:'李四',regionCode:'HZ',revision:2,historyTotal:1,pendingCount:0,conflicts:[],history:[{id:'1',oldName:'张三',newName:'李四',effectiveKind:'OBSERVED',source:'DINGHUOBAO',actor:'SYSTEM',occurredAt:'2026-11-05T00:00:00Z',recordedAt:'2026-11-05T00:00:00Z'}]}
    mocks.get.mockResolvedValue(state); mocks.save.mockResolvedValue(state)
    const wrapper=mount(CustomerResponsibilityDrawer,{global:{plugins:[ElementPlus]}})
    await (wrapper.vm as unknown as {open(id:string):Promise<void>}).open('1'); await flushPromises()
    const historyTab=wrapper.findAll('[role="tab"]').find(v=>v.text().includes('归属历史'))!
    await historyTab.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('仅同步发现'); expect(wrapper.text()).toContain('来源未提供（系统同步）')
    await wrapper.findAll('[role="tab"]').find(v=>v.text()==='调整归属')!.trigger('click')
    const date=new Date('2026-11-01T00:00:00Z')
    wrapper.findComponent(ElDatePicker).vm.$emit('update:modelValue',date)
    await wrapper.find('textarea').setValue('确认实际交接')
    await wrapper.findAll('button').find(v=>v.text()==='保存归属调整')!.trigger('click'); await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith('1',expect.objectContaining({effectiveAt:date.toISOString(),reason:'确认实际交接'}))
    wrapper.unmount()
  })
})
