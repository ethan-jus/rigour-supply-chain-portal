import { describe, expect, it } from 'vitest'
import { areaDescendantCodes, buildAreaTree, filterAreaTree } from '@/utils/crm-area-tree'
import type { CrmDictionaryView } from '@/api/core/crm'

const row = (code: string, parentCode: string | null, sortOrder = 0): CrmDictionaryView =>
  ({ id: code, code, name: code, parentCode, parentId: null, sortOrder, status: 'ACTIVE', syncedAt: null })

describe('地区完整层级', () => {
  const rows = [row('杭州', '浙江'), row('散客', null, 2), row('全国', null, 1), row('浙江', '全国', 2), row('北京', '全国', 1)]
  it('builds multiple levels regardless of page/source order and sorts siblings', () => {
    const tree = buildAreaTree(rows)
    expect(tree.map(x => x.code)).toEqual(['全国', '散客'])
    expect(tree[0]!.children.map(x => x.code)).toEqual(['北京', '浙江'])
    expect(tree[0]!.children[1]!.children[0]!.code).toBe('杭州')
    expect(rows[0]!.parentCode).toBe('浙江')
  })
  it('keeps ancestor context when searching a city and children when searching a province', () => {
    const tree = buildAreaTree(rows)
    expect(filterAreaTree(tree, '杭州')[0]!.children[0]!.children[0]!.code).toBe('杭州')
    expect(filterAreaTree(tree, '浙江')[0]!.children[0]!.children).toHaveLength(1)
    expect(filterAreaTree(tree, '不存在')).toEqual([])
  })
  it('excludes self and all descendants as parents without excluding siblings', () => {
    expect([...areaDescendantCodes(rows, '浙江')]).toEqual(['浙江', '杭州'])
  })
  it('fails visibly on cycles and duplicate codes; keeps unresolved orphans visible', () => {
    expect(() => buildAreaTree([row('a', 'b'), row('b', 'a')])).toThrow('循环')
    expect(() => buildAreaTree([row('a', null), row('a', null)])).toThrow('重复')
    expect(buildAreaTree([row('a', 'missing')])[0]!.code).toBe('a')
  })
})
