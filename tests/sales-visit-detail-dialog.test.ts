import { defineComponent } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import SalesVisitDetailDialog from '@/views/supply-chain/sales/SalesVisitDetailDialog.vue'
import SalesVisitContent from '@/views/supply-chain/sales/SalesVisitContent.vue'
import type { ReportVisit } from '@/api/core/sales-fieldwork-report'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api/core/client', () => ({ apiClient: { get } }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'one', tenantId: 'tenant' } }),
}))

const row: ReportVisit = {
  id: 'visit',
  profileId: 'person',
  date: '2026-11-17',
  employee: null,
  name: '测试销售',
  store: '测试门店',
  customer: null,
  status: 'CHECKED_OUT',
  arrived: '2026-11-17T07:05:00Z',
  departed: '2026-11-17T07:07:00Z',
  result: null,
  outcome: null,
  intention: null,
  planId: null,
  sequence: 2,
  assessment: 'VALID',
  reason: null,
  ruleVersion: null,
  minimumMinutes: null,
  objective: null,
  photos: 1,
  files: 1,
  verifiedFiles: 1,
  verifiedMillis: 80_000,
}
const dialog = defineComponent({
  template: '<section role="dialog"><slot name="header" /><slot /><slot name="footer" /></section>',
})
const render = (record?: ReportVisit) =>
  shallowMount(SalesVisitDetailDialog, {
    props: { visitId: row.id, date: row.date, canMap: true, record, visitType: '回访' },
    global: { stubs: { ElDialog: dialog, ElTag: true, ElButton: true, ElAlert: true } },
  })
beforeEach(() => get.mockReset())

it('列表已有记录时首屏直接展示，不重复查询台账', () => {
  const wrapper = render(row)
  expect(wrapper.get('[role=dialog]').text()).toContain('测试门店')
  expect(wrapper.text()).toContain('15:05')
  expect(wrapper.text()).toContain('回访')
  expect(get).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('直接打开旧链接时只按目标 ID 读取，历史请求不能覆盖已返回的本次拜访', async () => {
  get.mockResolvedValueOnce({ items: [row] })
  const wrapper = render()
  await flushPromises()
  expect(get).toHaveBeenCalledTimes(1)
  expect(get.mock.calls[0]?.[1].params.visitId).toBe(row.id)
  await wrapper.setProps({ record: row })
  let resolve!: (result: { items: ReportVisit[] }) => void
  get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  wrapper
    .getComponent({ name: 'SalesVisitEvidence' })
    .vm.$emit('capture', { visitId: 'prior', businessDate: '2026-11-16' })
  await flushPromises()
  await wrapper.get('.history-back').trigger('click')
  expect(get.mock.calls[1]?.[1].signal.aborted).toBe(true)
  resolve({ items: [{ ...row, id: 'prior', store: '历史门店' }] })
  await flushPromises()
  expect(wrapper.text()).toContain('测试门店')
  expect(wrapper.text()).not.toContain('历史门店')
  wrapper.unmount()
})

it('未接触拜访展示原因，切换至历史记录时只展示本次保存的备注', async () => {
  get.mockResolvedValueOnce({
    submitted: true,
    form: {
      businessType: '零售',
      businessStatus: '营业中',
      contacted: false,
      outcome: '未接触',
      noContactReason: '负责人不在',
      noContactDetail: '约下次见面',
      contacts: [],
      businesses: [],
    },
  })
  const wrapper = shallowMount(SalesVisitContent, { props: { visit: row } })
  await flushPromises()
  expect(wrapper.text()).toContain('负责人不在')
  expect(wrapper.text()).toContain('约下次见面')
  expect(wrapper.text()).not.toContain('业务进展')
  get.mockResolvedValueOnce({ submitted: true, form: null })
  await wrapper.setProps({ visit: { ...row, id: 'older', result: '店长建议下周联系' } })
  await flushPromises()
  expect(wrapper.text()).toContain('店长建议下周联系')
  expect(wrapper.text()).not.toContain('负责人不在')
  wrapper.unmount()
})

it('区分尚未提交和已提交但未填写合作意向的记录', async () => {
  get.mockResolvedValueOnce({ submitted: false, form: null })
  const wrapper = shallowMount(SalesVisitContent, { props: { visit: row } })
  await flushPromises()
  expect(wrapper.text()).toContain('尚未提交拜访内容')
  const form = {
    contacted: true,
    contacts: [],
    businesses: [],
    noIntention: false,
    outcome: '已沟通',
  }
  get.mockResolvedValueOnce({ submitted: true, form })
  await wrapper.setProps({ visit: { ...row, id: 'missing' } })
  await flushPromises()
  expect(wrapper.text()).toContain('未记录业务进展')
  expect(wrapper.text()).not.toContain('暂无合作意向')
  get.mockResolvedValueOnce({ submitted: true, form: { ...form, noIntention: true } })
  await wrapper.setProps({ visit: { ...row, id: 'none' } })
  await flushPromises()
  expect(wrapper.text()).toContain('暂无合作意向')
  wrapper.unmount()
})
