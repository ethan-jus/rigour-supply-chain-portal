import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CrmStoreContacts from '@/views/supply-chain/crm/CrmStoreContacts.vue'
import { crmStoreContactsApi as api, type StoreContact } from '@/api/core/crm-store-contacts'

vi.mock('@/api/core/crm-store-contacts', () => ({
  crmStoreContactsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addMethod: vi.fn(),
    verify: vi.fn(),
    link: vi.fn(),
    changes: vi.fn(),
  },
}))
vi.mock('@/api/core/crm-store', () => ({ crmStoreApi: { list: vi.fn() } }))
vi.mock('@/utils/audit-actor', () => ({ auditActorLabel: (id: string) => `操作人 ${id}` }))
const person: StoreContact = {
  id: '10',
  name: '王店长',
  role: '店长',
  primary: true,
  status: 'ACTIVE',
  revision: 1,
  personRevision: 1,
  wecomRelations: [],
  methods: [
    {
      id: '20',
      type: 'PHONE',
      value: '13800000001',
      status: 'PENDING',
      revision: 1,
      verificationMethod: null,
      verifiedAt: null,
      verifiedBy: null,
    },
  ],
}
let page: VueWrapper
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.list).mockResolvedValue([person])
})
afterEach(() => {
  page?.unmount()
  document.body.innerHTML = ''
})
async function setup(editable = true) {
  page = mount(CrmStoreContacts, {
    props: { storeId: '100', view: 'ALL', editable },
    attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { teleport: true, transition: false } },
  })
  await flushPromises()
}
const button = (label: string) => page.findAll('button').find((b) => b.text() === label)!
it('团队只读联系人不会出现维护操作，查询使用对应权限视图', async () => {
  await setup(false)
  await page.setProps({ view: 'TEAM' })
  await flushPromises()
  expect(api.list).toHaveBeenLastCalledWith('100', 'TEAM')
  expect(page.text()).toContain('待核实')
  expect(button('新增联系人')).toBeUndefined()
  expect(button('编辑关系')).toBeUndefined()
})
it('没有电话不能正式新建；网络失败重试保留同一请求', async () => {
  await setup()
  await button('新增联系人').trigger('click')
  await flushPromises()
  await page.find('input[aria-label="姓名或称呼"]').setValue('前台小李')
  await page.find('input[aria-label="本店角色"]').setValue('前台')
  await button('保存').trigger('click')
  await flushPromises()
  expect(api.create).not.toHaveBeenCalled()
  await page.find('input[aria-label="电话"]').setValue('13800000002')
  vi.mocked(api.create).mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue(person)
  await button('保存').trigger('click')
  await flushPromises()
  await button('保存').trigger('click')
  await flushPromises()
  const calls = vi.mocked(api.create).mock.calls
  expect(calls[0][2]).toEqual(calls[1][2])
  expect(calls[0].slice(0, 2)).toEqual(['100', 'ALL'])
})
it('关系失效仍保留电话和历史，并禁止继续核验或补电话', async () => {
  vi.mocked(api.list).mockResolvedValue([{ ...person, status: 'LEFT', primary: false }])
  await setup()
  expect(page.text()).toContain('离职 / 关系失效')
  expect(page.text()).toContain('13800000001')
  expect(button('补联系方式')).toBeUndefined()
  expect(button('核验 / 标记失效')).toBeUndefined()
  expect(button('变更记录')).toBeDefined()
})
it('切换门店后拒绝迟到的旧联系人响应', async () => {
  let finish!: (value: StoreContact[]) => void
  vi.mocked(api.list).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await setup()
  vi.mocked(api.list).mockResolvedValue([])
  await page.setProps({ storeId: '200' })
  await flushPromises()
  finish([person])
  await flushPromises()
  expect(page.text()).not.toContain('王店长')
  expect(page.text()).toContain('尚未登记联系人')
})
