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
  parentCode: 'BJ',
}
const department: api.TargetSubject = {
  dimensionType: 'CITY',
  code: 'BJ',
  name: '北京一部',
  cityCode: 'BJ',
  cityName: '北京一部',
  departmentName: null,
  employmentStatus: null,
  writable: true,
}
const settings = (): api.TargetSettings => ({
  month: '2026-10',
  archived: false,
  subjects: [department, person],
  targets: [department, person].flatMap((subject) =>
    targetMetrics.map((m) => ({
      month: '2026-10',
      dimensionType: subject.dimensionType,
      code: subject.code,
      name: subject.name,
      metric: m.code,
      value: '123',
      revision: 0,
    })),
  ),
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
  expect(wrapper.text()).not.toContain('新销售')
  await wrapper.get('button[aria-label="展开北京一部"]').trigger('click')
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
  it('shows history as independent fields while preserving zero and missing values', async () => {
    vi.mocked(api.getTargetHistory).mockResolvedValue([
      {
        metric: 'SALES_AMOUNT',
        value: 0,
        revision: 1,
        reason: '',
        actor: '',
        occurredAt: '2026-10-29T02:00:00Z',
      },
    ])
    await open()
    await wrapper!.get('button[aria-label="查看新销售修改记录"]').trigger('click')
    await flushPromises()
    const fields = [...document.querySelectorAll('.target-history-item dl > div')]
    const values = Object.fromEntries(
      fields.map((field) => [
        field.querySelector('dt')?.textContent,
        field.querySelector('dd')?.textContent,
      ]),
    )
    expect(values).toMatchObject({ 经营指标: '销售总额', 目标值: '0', 修改原因: '-', 修改人: '-' })
    expect(values['修改时间']).toContain('10:00:00')
  })
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
    const savedSales = saved.targets.find((t) => t.code === 'NEW' && t.metric === 'SALES_AMOUNT')!
    savedSales.value = 888
    savedSales.revision = 1
    vi.mocked(api.getTargetSettings).mockResolvedValue(saved)
    await click('预览变更')
    await click('确认保存')
    expect(page.text()).toContain('888')
    expect(api.getTargetSettings).toHaveBeenCalledTimes(2)
  })
  it('does not expose editing for read-only subjects', async () => {
    const data = settings()
    data.subjects = [department, { ...person, writable: false }]
    vi.mocked(api.getTargetSettings).mockResolvedValue(data)
    const page = await open()
    expect(page.find('button[aria-label="修改新销售指标"]').exists()).toBe(false)
  })
  it('keeps standalone sales rows collapsed with the first-level departments', async () => {
    const data = settings()
    data.subjects = [department, { ...person, parentCode: null }]
    vi.mocked(api.getTargetSettings).mockResolvedValueOnce(data)
    wrapper = mount(Targets, { attachTo: document.body, global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.text()).toContain('北京一部')
    expect(wrapper.text()).not.toContain('新销售')
    const group = wrapper.get('.target-group-toggle')
    expect(group.attributes('aria-expanded')).toBe('false')
    await group.trigger('click')
    expect(wrapper.text()).toContain('新销售')
  })
  it('excludes sales-root employees from the management tree and preserves standalone scoped sellers', async () => {
    const data = settings()
    const direct = {
      ...person,
      code: 'ROOT',
      name: '直属人员',
      parentCode: 'SALES',
      departmentName: '销售部',
    }
    data.subjects = [department, { ...person, parentCode: null }, direct]
    data.targets.push(
      ...data.targets
        .filter((t) => t.code === person.code)
        .map((t) => ({ ...t, code: direct.code, name: direct.name })),
    )
    vi.mocked(api.getTargetSettings).mockResolvedValue(data)
    wrapper = mount(Targets, { attachTo: document.body, global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.get('.target-group-toggle').trigger('click')
    expect(wrapper.text()).toContain('新销售')
    expect(wrapper.text()).not.toContain('直属人员')
    for (const label of ['下月', '本月']) {
      await click(label)
      expect(wrapper.find('button[aria-label="修改直属人员指标"]').exists()).toBe(false)
    }
  })
  it('keeps missing historical cells distinct from zero', async () => {
    const archive = settings()
    archive.archived = true
    archive.subjects = [
      { ...person, parentCode: null, historicalPlacementUnknown: true, writable: false },
    ]
    archive.targets = archive.targets.filter(
      (t) => t.code === person.code && t.metric === 'SALES_AMOUNT',
    )
    archive.targets[0]!.value = '0'
    vi.mocked(api.getTargetSettings).mockResolvedValueOnce(archive)
    wrapper = mount(Targets, { attachTo: document.body, global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.text()).toContain('历史归属待核实')
    const values = wrapper.findAll('tbody td.target-number').map((cell) => cell.text())
    expect(values).toEqual(['—', '—', '—', '0', '—'])
    expect(wrapper.find('button[aria-label="修改新销售指标"]').exists()).toBe(false)
  })
  it('rejects incomplete HR data, negative amounts and fractional customer counts', () => {
    expect(() => targetCell({ ...settings(), targets: [] }, person, 'SALES_AMOUNT')).toThrow(
      '不完整',
    )
    expect(targetValueError('SALES_AMOUNT', '-1')).not.toBeNull()
    expect(targetValueError('CONTACTED_STORE_COUNT', '1.5')).not.toBeNull()
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
