import { describe, expect, it } from 'vitest'
import type { DictItemView } from '@/api/core/business-settings'
import { storeClassificationCatalog } from '@/utils/crm-store-classification'

const item = (code: string, parent: string | null, enabled = true): DictItemView => ({
  id: '1',
  dictionaryCode: 'CRM_STORE_TYPE',
  dictionaryItemCode: code,
  dictionaryItemName: code,
  parentDictionaryItemCode: parent,
  dictionaryItemLevel: parent ? 2 : 1,
  ordinal: 1,
  revision: 1,
  remark: null,
  enabled,
})
describe('门店三级行业分类', () => {
  it('维护父子层级和完整分类路径', () => {
    const result = storeClassificationCatalog([
      item('体育', null),
      item('场馆', '体育'),
      item('台球厅', '场馆'),
    ])
    expect(result.paths.get('台球厅')).toBe('体育 / 场馆 / 台球厅')
    expect(result.options[0].children?.[0].children?.[0].value).toBe('台球厅')
  })
  it('停用父项时保留历史名称，但后代不允许新选择', () => {
    const result = storeClassificationCatalog([item('体育', null, false), item('台球厅', '体育')])
    expect(result.paths.get('台球厅')).toBe('体育 / 台球厅')
    expect(result.options[0].children?.[0].disabled).toBe(true)
  })
  it('不展示缺上级和循环节点，不把坏数据伪装为一级分类', () => {
    const result = storeClassificationCatalog([
      item('孤立', '不存在'),
      item('a', 'b'),
      item('b', 'a'),
    ])
    expect(result.options).toEqual([])
  })
  it('查询可选择停用的历史分类，不影响维护表单禁用规则', () => {
    const data = [item('体育', null, false), item('台球厅', '体育')]
    expect(storeClassificationCatalog(data, true).options[0].children?.[0].disabled).toBe(false)
    expect(storeClassificationCatalog(data).options[0].children?.[0].disabled).toBe(true)
  })
})
