import { describe, expect, it } from 'vitest'
import { supplyMenuTree, menuParentOptions } from '@/utils/supply-menu-tree'
import type { SupplyMenuNode } from '@/api/core/supply-settings'
const node = (id: string, parentId: string | null, type: SupplyMenuNode['type'] = 'MENU'): SupplyMenuNode => ({
  id, parentId, type, resourceId: type === 'MENU' ? null : id, name: id, iconKey: null,
  sortOrder: 0, visible: true, status: 'ACTIVE', protectedNode: false, version: 0,
  resourceCode: null, permissionCode: null, routeKey: null, routePath: null, componentPath: null,
})
describe('供应链菜单层级', () => {
  it('选择上级排除自己和全部后代，保留其他目录', () => {
    const nodes = [node('a', null), node('b', 'a'), node('c', 'b'), node('d', null), node('p', 'd', 'PAGE')]
    expect(menuParentOptions(nodes, 'a', 'MENU').map(n => n.id)).toEqual(['d'])
    expect(menuParentOptions(nodes, null, 'BUTTON').map(n => n.id)).toEqual(['p'])
  })
  it('按钮保留在所属页面内，不成为导航目录', () => {
    const tree = supplyMenuTree([node('a', null), node('p', 'a', 'PAGE'), node('b', 'p', 'BUTTON')])
    expect(tree[0].children[0].children[0].type).toBe('BUTTON')
  })
  it('拒绝循环和不存在的父节点', () => {
    expect(() => supplyMenuTree([node('a', 'b'), node('b', 'a')])).toThrow('循环')
    expect(() => supplyMenuTree([node('a', 'missing')])).toThrow('上级不存在')
  })
})
