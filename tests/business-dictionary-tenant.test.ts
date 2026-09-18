import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveBizDict, type EffectiveDictView, type DictItemView } from '@/api/core/business-settings'
import { setBusinessDictionaryTenant, clearBusinessDictionaries, loadBusinessDictionaries, businessDictionaryLabel, businessDictionaryOptions, refreshBusinessDictionary } from '@/utils/business-dictionary'
vi.mock('@/api/core/business-settings', () => ({ resolveBizDict: vi.fn() }))
const ref = { moduleCode: 'CRM', code: 'UNIT' }
const item = (code: string, name: string, enabled = true, parent: string | null = null): DictItemView => ({ id: code, dictionaryCode: 'UNIT', dictionaryItemCode: code, dictionaryItemName: name, dictionaryItemLevel: parent ? 2 : 1, parentDictionaryItemCode: parent, enabled, remark: null, ordinal: 0, revision: 0 })
const result = (...items: DictItemView[]): EffectiveDictView => ({ dictionary: { id: 'unit', dictionaryCode: 'UNIT', dictionaryName: '单位', dictionaryType: null, remark: null, revision: 0 }, items })
beforeEach(() => { vi.resetAllMocks(); clearBusinessDictionaries(); setBusinessDictionaryTenant('A') })
describe('业务字典租户与停用规则', () => {
  it('租户切换后，迟到的旧租户请求不能污染新租户显示', async () => {
    let finish!: (value: EffectiveDictView) => void
    vi.mocked(resolveBizDict).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(result(item('BOX', '乙租户箱')))
    const old = loadBusinessDictionaries([ref])
    setBusinessDictionaryTenant('B')
    await loadBusinessDictionaries([ref])
    finish(result(item('BOX', '甲租户箱')))
    await old
    expect(businessDictionaryLabel('CRM', 'UNIT', 'BOX')).toBe('乙租户箱')
  })
  it('停用父项及其子项不再可选，但历史名称仍保留', async () => {
    vi.mocked(resolveBizDict).mockResolvedValue(result(item('P', '旧分类', false), item('C', '旧子项', true, 'P'), item('NEW', '新单位')))
    await loadBusinessDictionaries([ref])
    expect(businessDictionaryOptions('CRM', 'UNIT')).toEqual([{ label: '新单位', value: 'NEW' }])
    expect(businessDictionaryLabel('CRM', 'UNIT', 'C')).toBe('旧子项')
  })
  it('编辑后的刷新替换当前租户快照，重复预载合并请求', async () => {
    vi.mocked(resolveBizDict).mockResolvedValueOnce(result(item('BOX', '箱'))).mockResolvedValueOnce(result(item('BOX', '整箱')))
    await Promise.all([loadBusinessDictionaries([ref]), loadBusinessDictionaries([ref])])
    expect(resolveBizDict).toHaveBeenCalledTimes(1)
    await refreshBusinessDictionary('UNIT')
    expect(businessDictionaryLabel('CRM', 'UNIT', 'BOX')).toBe('整箱')
  })
})
