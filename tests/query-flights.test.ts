import { expect, it, vi } from 'vitest'
import { QueryFlights, stableQueryKey } from '@/api/core/query-flights'
it('重复读取共用进行中的请求，每个调用方得到独立结果，完成后不保留业务数据', async () => {
  const flights = new QueryFlights()
  let finish!: (v: { items: number[] }) => void
  const load = vi.fn(() => new Promise<{ items: number[] }>(resolve => { finish = resolve }))
  const first = flights.run('session-1:orders', load)
  const second = flights.run('session-1:orders', load)
  expect(load).toHaveBeenCalledTimes(1)
  finish({ items: [1] })
  const [a, b] = await Promise.all([first, second])
  a.items.push(2)
  expect(b.items).toEqual([1])
  const third = flights.run('session-1:orders', load)
  expect(load).toHaveBeenCalledTimes(2)
  finish({ items: [3] }); await third
})
it('写入后不会复用写入前仍在进行的旧查询', async () => {
  const flights = new QueryFlights()
  let old!: (n: number) => void
  const before = flights.run('list', () => new Promise<number>(resolve => { old = resolve }))
  flights.invalidate()
  const after = flights.run('list', () => Promise.resolve(2))
  old(1)
  expect(await before).toBe(1)
  expect(await after).toBe(2)
})
it('查询参数字段顺序不影响键，数组顺序和用户身份仍隔离', () => {
  expect(stableQueryKey({ page: 1, region: 'HZ' })).toBe(stableQueryKey({ region: 'HZ', page: 1 }))
  expect(stableQueryKey(['u1', 1])).not.toBe(stableQueryKey(['u2', 1]))
})
