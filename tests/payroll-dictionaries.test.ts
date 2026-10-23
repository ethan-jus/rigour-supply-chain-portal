import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { resolveBizDict, type EffectiveDictView } from '@/api/core/business-settings'
import { clearBusinessDictionariesForTest } from '@/utils/business-dictionary'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
import { newSchemeCommission } from '@/utils/payroll-scheme'
import RateEditor from '@/views/supply-chain/hr/components/PayrollCommissionRateEditor.vue'

vi.mock('@/api/core/business-settings', () => ({ resolveBizDict: vi.fn() }))
const units = (name: string, enabled = true): EffectiveDictView => ({
  dictionary: {
    id: 'unit',
    dictionaryCode: 'PRODUCT_UNIT',
    dictionaryName: '商品单位',
    dictionaryType: null,
    remark: null,
    revision: 1,
  },
  items: [
    {
      id: 'set',
      dictionaryCode: 'PRODUCT_UNIT',
      dictionaryItemCode: 'SET',
      dictionaryItemName: name,
      dictionaryItemLevel: 1,
      parentDictionaryItemCode: null,
      ordinal: 1,
      remark: null,
      revision: 1,
      enabled,
    },
  ],
})
beforeEach(() => {
  vi.resetAllMocks()
  clearBusinessDictionariesForTest()
})
afterEach(clearBusinessDictionariesForTest)
describe('薪酬商品单位展示', () => {
  it('直接进入页面时加载当前字典，异步返回后名称响应更新，不硬编码套的名称', async () => {
    let finish!: (value: EffectiveDictView) => void
    vi.mocked(resolveBizDict).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const label = computed(() => payrollUnitName('SET'))
    expect(label.value).toBe('单位待维护')
    const loading = loadPayrollProductUnits()
    finish(units('业务套装'))
    await loading
    expect(label.value).toBe('业务套装')
    expect(payrollUnitName('UNKNOWN')).toBe('单位待维护')
    expect(payrollUnitName(null)).toBe('未设置单位')
  })
  it('字典服务不可用时不把编码当名称，也不编造单位', async () => {
    vi.mocked(resolveBizDict).mockRejectedValue(new Error('字典服务不可用'))
    await loadPayrollProductUnits()
    expect(payrollUnitName('SET')).toBe('单位待维护')
  })
  it('历史停用单位仍显示其名称，编辑器不改写保存的单位编码', async () => {
    vi.mocked(resolveBizDict).mockResolvedValue(units('历史套装', false))
    const rule = { ...newSchemeCommission(), method: 'QUANTITY', unitCode: 'SET', value: 15 }
    const page = mount(RateEditor, {
      props: { modelValue: rule },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(page.text()).toContain('历史套装')
    expect(page.text()).not.toContain('SET')
    expect(rule.unitCode).toBe('SET')
    page.unmount()
  })
})
