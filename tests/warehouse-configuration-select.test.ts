import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus from 'element-plus'
import PartySelect from '@/views/supply-chain/cost/CostLedgerPartySelect.vue'
import type { LedgerPartyReference } from '@/api/core/cost-ledger'
import { ApiError, errorMessage } from '@/api/core/error'

const api = vi.hoisted(() => ({ parties: vi.fn() }))
vi.mock('@/api/core/cost-ledger', () => ({ getLedgerParties: api.parties }))

const issue =
  '仓库“测试云仓”（WH-TEST）：业务归属地区“散客”（DIRTY）不是经营城市，也不是总部；请在仓库信息中将业务归属地区改为实际经营城市或总部'
const row: LedgerPartyReference = {
  id: '1',
  code: 'WH-TEST',
  name: '测试云仓',
  cityCode: 'DIRTY',
  address: null,
  contactName: null,
  phone: null,
  partyTypeCode: 'WAREHOUSE',
  referenceIssue: issue,
}
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.clearAllMocks()
  api.parties.mockResolvedValue([row])
})
afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers.length = 0
  document.body.innerHTML = ''
})

function editor(initial: string | null = null) {
  const Host = defineComponent({
    components: { PartySelect },
    setup: () => ({ code: ref(initial) }),
    template: '<PartySelect v-model="code" logistics kind="WAREHOUSE" />',
  })
  const wrapper = mount(Host, { global: { plugins: [ElementPlus] }, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

describe('运输仓库归属配置提示', () => {
  it('候选项及选中后都明确显示仓库、错误地区及处理位置', async () => {
    const wrapper = editor()
    await wrapper.find('.el-select__wrapper').trigger('click')
    await flushPromises()
    const option = Array.from(document.querySelectorAll('.el-select-dropdown__item')).find((e) =>
      e.textContent?.includes('WH-TEST'),
    )!
    expect(option.textContent).toContain(issue)
    ;(option as HTMLElement).click()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe(issue)
    expect(wrapper.findComponent(PartySelect).emitted('selected')?.[0]?.[0]).toEqual(row)
  })

  it('编辑已有异常仓库时也提示，切换到正常仓库后清除提示', async () => {
    const wrapper = editor('WH-TEST')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe(issue)
    api.parties.mockResolvedValue([{ ...row, code: 'WH-OK', cityCode: 'BJ', referenceIssue: null }])
    ;(wrapper.vm as unknown as { code: string }).code = 'WH-OK'
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('资料核验接口失败时保留原选择并明确提示，不能显示成配置正常', async () => {
    api.parties.mockRejectedValue(new Error('仓库归属核验服务暂不可用'))
    const wrapper = editor('WH-TEST')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe(
      '仓库（WH-TEST）资料核验失败：仓库归属核验服务暂不可用',
    )
    expect(wrapper.findComponent(PartySelect).props('modelValue')).toBe('WH-TEST')
  })

  it('保存接口的配置原因原样展示，真实权限不足继续显示权限错误', () => {
    const failure = new ApiError({ code: 'BAD_REQUEST', message: issue }, 400)
    expect(errorMessage(failure, '保存失败')).toBe(issue)
    expect(errorMessage(new ApiError({ code: 'IAM_FORBIDDEN' }, 403), '保存失败')).toBe(
      '没有执行该操作或访问该资源的权限',
    )
  })
})
