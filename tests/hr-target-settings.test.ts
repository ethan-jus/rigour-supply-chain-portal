import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Targets from '@/views/supply-chain/hr/HrTargetSettingsView.vue'
import {
  targetCell,
  targetValueError,
  targetMetrics,
} from '@/views/supply-chain/hr/target-settings-model'
import { personalGoal } from '@/views/supply-chain/bi/sales-dashboard-model'
import * as api from '@/api/core/hr-target-settings'
import type { SalesAnalysis } from '@/api/core/bi-sales-dashboard'
vi.mock('@/api/core/hr-target-settings', () => ({
  getTargetSettings: vi.fn(),
  saveTargetSettings: vi.fn(),
  getTargetHistory: vi.fn(),
}))
const person: api.TargetSubject = {
  dimensionType: 'SALES_OWNER',
  code: 'NEW',
  name: '新销售',
  cityCode: 'BJ',
  cityName: '北京',
  departmentName: '北京一部',
  employmentStatus: 'ACTIVE',
  writable: true,
}
const settings = (): api.TargetSettings => ({
  month: '2026-10',
  subjects: [person],
  targets: targetMetrics.map((m) => ({
    month: '2026-10',
    dimensionType: 'SALES_OWNER',
    code: 'NEW',
    name: '新销售',
    metric: m.code,
    value: '123',
    revision: 0,
  })),
})
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getTargetSettings).mockResolvedValue(settings())
  vi.mocked(api.getTargetHistory).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})
async function open() {
  wrapper = mount(Targets, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text().includes('销售指标'))!
    .trigger('click')
  await flushPromises()
  return wrapper
}
async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  )!
  button.click()
  await flushPromises()
}
describe('HR有效指标与简化编辑', () => {
  it('shows a new salesperson and uses HR values without default/custom selectors', async () => {
    const page = await open()
    expect(page.text()).toContain('新销售')
    expect(page.text()).toContain('123')
    expect(page.text()).not.toContain('单独设置')
    expect(page.text()).not.toContain('自定义')
    expect(page.text()).not.toContain('默认标准')
    await page.get('button[aria-label="修改新销售指标"]').trigger('click')
    await flushPromises()
    expect((document.getElementById('target-SALES_AMOUNT') as HTMLInputElement).value).toBe('123')
  })
  it('previews and saves explicit zero with the revision, retaining input on conflict', async () => {
    vi.mocked(api.saveTargetSettings).mockRejectedValueOnce(new Error('版本冲突，请刷新'))
    const page = await open()
    await page.get('button[aria-label="修改新销售指标"]').trigger('click')
    await flushPromises()
    const input = document.getElementById('target-SALES_AMOUNT') as HTMLInputElement
    input.value = '0'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const reason = document.getElementById('target-reason') as HTMLTextAreaElement
    reason.value = '入职当月不考核'
    reason.dispatchEvent(new Event('input', { bubbles: true }))
    await click('预览变更')
    await click('确认保存')
    expect(api.saveTargetSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          {
            dimensionType: 'SALES_OWNER',
            code: 'NEW',
            metric: 'SALES_AMOUNT',
            value: '0',
            expectedRevision: 0,
          },
        ],
      }),
    )
    expect(document.body.textContent).toContain('版本冲突')
    expect(input.value).toBe('0')
  })
  it('successfully saves and reloads without rendering a stale preview against cleared data', async () => {
    vi.mocked(api.saveTargetSettings).mockResolvedValueOnce(undefined)
    const page = await open()
    await page.get('button[aria-label="修改新销售指标"]').trigger('click')
    await flushPromises()
    const input = document.getElementById('target-SALES_AMOUNT') as HTMLInputElement
    input.value = '888'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const reason = document.getElementById('target-reason') as HTMLTextAreaElement
    reason.value = '月度调整'
    reason.dispatchEvent(new Event('input', { bubbles: true }))
    const saved = settings()
    saved.targets[0]!.value = 888
    saved.targets[0]!.revision = 1
    vi.mocked(api.getTargetSettings).mockResolvedValue(saved)
    await click('预览变更')
    await click('确认保存')
    expect(page.text()).toContain('888')
    expect(api.getTargetSettings).toHaveBeenCalledTimes(2)
  })
  it('does not expose editing for read-only subjects', async () => {
    const data = settings()
    data.subjects = [{ ...person, writable: false }]
    vi.mocked(api.getTargetSettings).mockResolvedValue(data)
    const page = await open()
    expect(page.find('button[aria-label="修改新销售指标"]').exists()).toBe(false)
  })
  it('rejects incomplete HR data, negative amounts and fractional customer counts', () => {
    expect(() => targetCell({ ...settings(), targets: [] }, person, 'SALES_AMOUNT')).toThrow(
      '不完整',
    )
    expect(targetValueError('SALES_AMOUNT', '-1')).not.toBeNull()
    expect(targetValueError('NEW_CUSTOMER', '1.5')).not.toBeNull()
    expect(targetValueError('RECEIPT_AMOUNT', '0')).toBeNull()
  })
  it('BI never fills missing API months with hardcoded goals and preserves zero', () => {
    const data = {
      goals: [{ code: 'NEW', metric: 'SALES_AMOUNT', month: 10, target: 0 }],
    } as SalesAnalysis
    expect(personalGoal(data, 'NEW', 'SALES_AMOUNT', 10).value).toBe(0)
    expect(personalGoal(data, 'NEW', 'SALES_AMOUNT', null).value).toBeNull()
    expect(personalGoal(null, 'NEW', 'SALES_AMOUNT', 10).value).toBeNull()
  })
})
