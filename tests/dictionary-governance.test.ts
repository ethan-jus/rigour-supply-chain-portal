import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DictItemView } from '@/api/core/business-settings'
const api = vi.hoisted(() => ({ resolveBizDict: vi.fn() }))
vi.mock('@/api/core/business-settings', () => api)
import { businessDictionaryLabel, businessDictionaryOptions, clearBusinessDictionariesForTest, loadBusinessDictionaries, refreshBusinessDictionaries } from '@/utils/business-dictionary'
const standard: DictItemView = { id: '1', dictionaryCode: 'STORE_STATUS', dictionaryItemCode: 'ACTIVE', dictionaryItemName: '营业中', dictionaryItemLevel: 1, parentDictionaryItemCode: null, ordinal: 1, revision: 1, remark: null }
const legacy: DictItemView = { ...standard, id: '2', dictionaryItemCode: 'LEGACY', canonicalDictionaryCode: 'STORE_STATUS', canonicalItemCode: 'ACTIVE' }
beforeEach(() => { clearBusinessDictionariesForTest(); vi.clearAllMocks() })
describe('字典治理业务兼容', () => {
  it('历史编码仍显示名称，新选择只包含标准项', async () => {
    api.resolveBizDict.mockResolvedValue({ dictionary: {}, items: [standard, legacy] })
    await loadBusinessDictionaries([{ moduleCode: 'CRM', code: 'STORE_STATUS' }])
    expect(businessDictionaryLabel('CRM', 'STORE_STATUS', 'LEGACY')).toBe('营业中')
    expect(businessDictionaryOptions('CRM', 'STORE_STATUS')).toEqual([{ label: '营业中', value: 'ACTIVE' }])
  })
  it('治理保存后，已加载的业务页面同步获取新字典快照', async () => {
    api.resolveBizDict.mockResolvedValueOnce({ dictionary: {}, items: [standard, legacy] }).mockResolvedValueOnce({ dictionary: {}, items: [{ ...standard, dictionaryItemName: '正常营业' }, { ...legacy, dictionaryItemName: '正常营业' }] })
    await loadBusinessDictionaries([{ moduleCode: 'CRM', code: 'STORE_STATUS' }])
    await refreshBusinessDictionaries()
    expect(businessDictionaryLabel('CRM', 'STORE_STATUS', 'LEGACY')).toBe('正常营业')
    expect(businessDictionaryOptions('CRM', 'STORE_STATUS')).toEqual([{ label: '正常营业', value: 'ACTIVE' }])
  })
})
