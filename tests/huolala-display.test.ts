import { describe, expect, it } from 'vitest'
import { platformDateTime, platformProgress } from '@/views/supply-chain/cost/huolala-display'

describe('货拉拉资料业务展示', () => {
  it('平台时间保留北京时间含义，归档时间按自身时区转换', () => {
    expect(platformDateTime('2026-11-13 11:22:33')).toBe('2026-11-13 11:22:33')
    expect(platformDateTime('2026-11-13T03:22:33Z')).toBe('2026-11-13 11:22:33')
    expect(platformDateTime(null)).toBe('-')
  })
  it('按平台返回的进度顺序展示，不按成本状态伪造节点；未知文本不丢失', () => {
    expect(
      platformProgress('司机已接单|2026-11-13 10:01,货物已装车|2026-11-13 10:22,平台补充说明'),
    ).toEqual([
      { name: '司机已接单', time: '2026-11-13 10:01' },
      { name: '货物已装车', time: '2026-11-13 10:22' },
      { name: '平台补充说明', time: '' },
    ])
    expect(platformProgress('')).toEqual([])
  })
})
