import { expect, it } from 'vitest'
import { suggestedPurchaseAmount } from '@/views/supply-chain/cost/cost-amount'
it('rounds decimal purchase multiplication using half up like the backend', () => {
  expect(suggestedPurchaseAmount(1.005, 1)).toBe(1.01)
  expect(suggestedPurchaseAmount(0.1, 0.2)).toBe(0.02)
  expect(suggestedPurchaseAmount(12.345678, 10)).toBe(123.46)
})
