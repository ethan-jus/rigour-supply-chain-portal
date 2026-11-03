import { describe, expect, it } from 'vitest'
import {
  remainingTime,
  storeAreaOptions,
  storeLeadAreaOptions,
  storeMapUrl,
} from '@/utils/crm-store'
import type { AdminArea } from '@/api/core/crm-store'
import { constantRoutes } from '@/router/routes'

const areas: AdminArea[] = [
  { code: '330000', name: '浙江省', level: 'PROVINCE', parentCode: null, regionCode: 'EAST' },
  { code: '330100', name: '杭州市', level: 'PREFECTURE', parentCode: '330000', regionCode: null },
  { code: '330105', name: '拱墅区', level: 'COUNTY', parentCode: '330100', regionCode: null },
  { code: '620000', name: '甘肃省', level: 'PROVINCE', parentCode: null, regionCode: 'NORTHWEST' },
  { code: '620100', name: '兰州市', level: 'PREFECTURE', parentCode: '620000', regionCode: null },
  { code: '620102', name: '城关区', level: 'COUNTY', parentCode: '620100', regionCode: null },
]
describe('CRM 门店地区和位置交互', () => {
  it('新增门店保留授权区县与合法市级叶子，生成完整路径，不扩张城市权限', () => {
    expect(storeLeadAreaOptions(areas.slice(0, 3))).toEqual([
      { value: '330105', label: '浙江省 / 杭州市 / 拱墅区' },
    ])
    const special: AdminArea[] = [
      { code: '440000', name: '广东省', level: 'PROVINCE', parentCode: null, regionCode: 'SOUTH' },
      {
        code: '441900',
        name: '东莞市',
        level: 'PREFECTURE',
        parentCode: '440000',
        regionCode: null,
      },
      { code: '110000', name: '北京市', level: 'PROVINCE', parentCode: null, regionCode: 'NORTH' },
      { code: '110101', name: '东城区', level: 'COUNTY', parentCode: '110000', regionCode: null },
    ]
    expect(storeLeadAreaOptions(special)).toEqual([
      { value: '441900', label: '广东省 / 东莞市' },
      { value: '110101', label: '北京市 / 东城区' },
    ])
    expect(storeLeadAreaOptions([])).toEqual([])
  })
  it('全国账号可按七区、省、市、县逐层收窄，清空显示全部授权数据', () => {
    expect(storeAreaOptions(areas, '', '', '').provinces).toHaveLength(2)
    expect(storeAreaOptions(areas, 'EAST', '', '').cities.map((a) => a.code)).toEqual(['330100'])
    expect(storeAreaOptions(areas, '', '620000', '').counties.map((a) => a.code)).toEqual([
      '620102',
    ])
    expect(storeAreaOptions(areas, '', '', '330100').counties.map((a) => a.code)).toEqual([
      '330105',
    ])
  })
  it('杭州账号清空筛选也不能出现兰州选项', () => {
    const scoped = areas.slice(0, 3)
    expect(storeAreaOptions(scoped, '', '', '').cities.map((a) => a.code)).toEqual(['330100'])
    expect(storeAreaOptions(scoped, 'NORTHWEST', '', '').counties).toEqual([])
  })
  it('直辖市用省节点作城市筛选，省直管县不用虚构城市', () => {
    const special: AdminArea[] = [
      { code: '110000', name: '北京市', level: 'PROVINCE', parentCode: null, regionCode: 'NORTH' },
      { code: '110101', name: '东城区', level: 'COUNTY', parentCode: '110000', regionCode: null },
      { code: '460000', name: '海南省', level: 'PROVINCE', parentCode: null, regionCode: 'SOUTH' },
      { code: '469001', name: '五指山市', level: 'COUNTY', parentCode: '460000', regionCode: null },
    ]
    expect(storeAreaOptions(special, '', '110000', '110000').counties.map((a) => a.code)).toEqual([
      '110101',
    ])
    const hainan = storeAreaOptions(special, '', '460000', '')
    expect(hainan.cities).toEqual([])
    expect(hainan.counties.map((a) => a.code)).toEqual(['469001'])
  })
  it('位置使用自有坐标和明确坐标系，不依赖POI，并编码特殊名称', () => {
    const url = new URL(
      storeMapUrl({
        name: '台球 & 测试?店',
        longitude: 120.12,
        latitude: 30.2,
        coordinateSystem: 'GCJ02',
      })!,
    )
    expect(url.origin).toBe('https://uri.amap.com')
    expect(url.searchParams.get('position')).toBe('120.12,30.2')
    expect(url.searchParams.get('name')).toBe('台球 & 测试?店')
    expect(url.searchParams.get('coordinate')).toBe('gaode')
    expect(url.searchParams.has('poiid')).toBe(false)
    expect(
      storeMapUrl({ name: '待核实', longitude: null, latitude: 30, coordinateSystem: 'GCJ02' }),
    ).toBeNull()
    expect(
      storeMapUrl({ name: '未声明坐标系', longitude: 120, latitude: 30, coordinateSystem: null }),
    ).toBeNull()
  })
  it('48小时冷却边界与保护到期提示不混淆', () => {
    const now = Date.parse('2026-10-27T00:00:00Z')
    expect(remainingTime('2026-10-29T00:00:00Z', now)).toBe('48小时')
    expect(remainingTime('2026-10-27T00:00:00Z', now)).toBe('已到期，待核验')
  })
})
describe('新CRM菜单的真实页面和独立权限', () => {
  it('六个入口绑定业务组件与各自动作权限', async () => {
    const children = constantRoutes.find((r) => r.path === '/supply-chain')?.children ?? []
    const expected: Record<string, string> = {
      mine: 'crm:pool:private-read',
      public: 'crm:pool:public-read',
      cooperated: 'crm:store:cooperation-read',
      leads: 'crm:lead:read',
      library: 'crm:store:manage',
      analysis: 'crm:coverage:read',
    }
    for (const [page, permission] of Object.entries(expected)) {
      const route = children.find((r) => r.path === `crm/stores/${page}`)
      expect(route?.meta?.permission).toBe(permission)
      expect(route?.meta?.routeKey).toBe(`supply.crm.stores.${page}`)
      const loaded = await (route?.component as () => Promise<{ default: unknown }>)()
      expect(loaded.default).toBeTruthy()
    }
  })
})
