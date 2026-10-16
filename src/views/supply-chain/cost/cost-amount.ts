/** 用户输入最多六位小数，金额建议保留两位，避免 1.005 的浮点舍入差异。 */
export function suggestedPurchaseAmount(price: number, quantity: number): number {
  const scaled = (value: number) => BigInt(value.toFixed(6).replace('.', ''))
  return Number((scaled(price) * scaled(quantity) + 5_000_000_000n) / 10_000_000_000n) / 100
}
