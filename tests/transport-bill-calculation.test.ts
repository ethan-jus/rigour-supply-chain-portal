import { expect, it } from 'vitest'
import { adjustManualBillTotal, manualBillTotal } from '@/views/supply-chain/cost/transport-records'

it('全部费用减去优惠；正负优惠输入都只扣减一次', () => {
  for (const discount of [10, -10])
    expect(
      manualBillTotal([
        { name: '基础运费', amount: 65.31 },
        { name: '优惠', amount: discount },
      ]),
    ).toBe(55.31)
})

it('直接修改总额只调整基础运费，其他费用和优惠保持原值', () => {
  const items = [
    { name: '基础运费', amount: 54 },
    { name: '装卸费', amount: 10 },
    { name: '优惠', amount: 5 },
  ]
  const changed = adjustManualBillTotal(items, 65.31)
  expect(changed).toEqual([{ name: '基础运费', amount: 60.31 }, items[1], items[2]])
  expect(manualBillTotal(changed)).toBe(65.31)
  expect(items[0]!.amount).toBe(54)
  expect(() => adjustManualBillTotal(items, 1)).toThrow('总额低于其他费用')
})

it('未填写其他项目金额时不通过修改总额猜填，已有优惠无基础项时补一项基础运费', () => {
  expect(() => adjustManualBillTotal([{ name: '装卸费', amount: null }], 10)).toThrow(
    '其他费用项目',
  )
  expect(adjustManualBillTotal([{ name: '优惠', amount: 10 }], 55.31)).toEqual([
    { name: '基础运费', amount: 65.31 },
    { name: '优惠', amount: 10 },
  ])
})
