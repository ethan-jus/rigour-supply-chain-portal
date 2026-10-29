import type { TerritoryContext } from '@/api/core/store-territories'

export const territoryContext: TerritoryContext = {
  applicationVersion: 7,
  canWrite: true,
  catalog: {
    version: 'TEST-2026',
    sourceName: '隔离演示目录',
    sourceRef: 'test-only',
    nodes: [
      { code: '330000', name: '浙江省', level: 'PROVINCE', parentCode: null, regionCode: 'EAST' },
      {
        code: '330100',
        name: '杭州市',
        level: 'PREFECTURE',
        parentCode: '330000',
        regionCode: null,
      },
      { code: '330105', name: '拱墅区', level: 'COUNTY', parentCode: '330100', regionCode: null },
      {
        code: '620000',
        name: '甘肃省',
        level: 'PROVINCE',
        parentCode: null,
        regionCode: 'NORTHWEST',
      },
      {
        code: '620100',
        name: '兰州市',
        level: 'PREFECTURE',
        parentCode: '620000',
        regionCode: null,
      },
    ],
  },
  departments: [
    { id: '1', name: '销售部', parentId: null, status: 'ACTIVE', areas: [] },
    {
      id: '2',
      name: '杭州销售部',
      parentId: '1',
      status: 'ACTIVE',
      areas: [{ version: 'TEST-2026', code: '330100' }],
    },
    { id: '3', name: '兰州销售部', parentId: '1', status: 'ACTIVE', areas: [] },
    { id: '4', name: '原城市小组', parentId: '1', status: 'INACTIVE', areas: [] },
  ],
}
