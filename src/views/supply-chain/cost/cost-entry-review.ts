import type { CostCategory, CostCommand } from '@/api/core/cost'
import { suggestedPurchaseAmount } from './cost-amount'

/** 保存草稿只要求身份、归属和该业务的最小信息；金额待补与确认校验分开。 */
export function costSaveGaps(category: CostCategory, data: CostCommand): string[] {
  const gaps: string[] = []
  if (!data.cityCode) gaps.push('费用归属')
  if (!data.costDate)
    gaps.push(
      category === 'purchases'
        ? '进货日期'
        : category === 'losses'
          ? '损耗日期'
          : category === 'logistics'
            ? '运输日期'
            : '费用日期',
    )
  if (category === 'marketing' || category === 'expenses') {
    if (!data.title.trim()) gaps.push('费用事项')
    if (!data.typeCode) gaps.push(category === 'expenses' ? '报销类型' : '费用类型')
  }
  if (category === 'expenses') {
    if (!data.ownerEmployeeCode) gaps.push('报销员工')
    if (data.amount == null) gaps.push('费用金额')
    if (!data.expense?.purpose?.trim()) gaps.push('费用用途 / 出差事由')
    if (!data.paymentStatusCode) gaps.push('付款状态')
    gaps.push(...costConfirmationGaps(category, data))
  }
  if (category === 'marketing' && !data.ownerEmployeeCode && !data.ownerName?.trim())
    gaps.push('经办人')
  if (category === 'purchases' || category === 'losses') {
    if (!data.goods?.productName?.trim()) gaps.push('商品')
    if (!data.goods?.unit?.trim()) gaps.push('单位')
    if (data.goods?.productId && !data.goods.variantId) gaps.push('商品规格')
    if (category === 'purchases' && data.goods?.unitPrice == null) gaps.push('进货单价')
    if (category === 'losses') {
      if (data.goods?.quantity == null || data.goods.quantity <= 0) gaps.push('损耗数量')
      if (!data.goods?.warehouseId && !data.goods?.location?.trim()) gaps.push('损耗发生地点')
      if (!data.goods?.lossReason?.trim()) gaps.push('损耗原因')
    }
  }
  if (data.rental) {
    if (!data.rental.premisesName?.trim() && !data.rental.warehouseId) gaps.push('场地名称')
    if (data.rental.area == null || data.rental.area <= 0) gaps.push('租赁面积')
    if (!data.costMonth) gaps.push('费用所属月份')
  }
  return [...new Set(gaps)]
}

/** 录入阶段提示可见字段的缺项；权限、引用范围及最终确认仍由原业务接口校验。 */
export function costConfirmationGaps(category: CostCategory, data: CostCommand): string[] {
  const gaps: string[] = []
  if (!data.cityCode) gaps.push('费用归属')
  if (!data.costDate) gaps.push('费用日期')
  if (data.amount == null) gaps.push('费用金额')
  const goods = data.goods
  if (category === 'purchases' || category === 'losses') {
    if (!goods?.productName?.trim()) gaps.push('商品')
    if (!goods?.unit) gaps.push('单位')
    if (goods?.productId && !goods.variantId) gaps.push('商品规格')
    if (goods?.quantity == null || goods.quantity <= 0) gaps.push('数量')
    if (category === 'purchases') {
      if (goods?.unitPrice == null) gaps.push('进货单价')
      if (!goods?.supplierName?.trim()) gaps.push('供应商')
      if (goods?.unitPrice === 0 && !goods.amountReason?.trim()) gaps.push('零单价说明')
      if (
        goods?.unitPrice != null &&
        goods.quantity != null &&
        data.amount != null &&
        data.amount !== suggestedPurchaseAmount(goods.unitPrice, goods.quantity) &&
        !goods.amountReason?.trim()
      )
        gaps.push('金额差异说明')
    } else {
      if (!goods?.warehouseId && !goods?.location?.trim()) gaps.push('损耗发生地点')
      if (!goods?.lossReason?.trim()) gaps.push('损耗原因')
    }
  }
  if (data.rental) {
    if (!data.rental.premisesName?.trim() && !data.rental.warehouseId) gaps.push('场地名称')
    if (!data.costMonth) gaps.push('费用所属月份')
    if (data.rental.area == null || data.rental.area <= 0) gaps.push('租赁面积')
  }
  if (category === 'marketing') {
    if (!data.title?.trim()) gaps.push('营销事项')
    if (!data.typeCode) gaps.push('营销类型')
    if (!data.ownerEmployeeCode && !data.ownerName?.trim()) gaps.push('经办人')
  }
  if (data.logistics) {
    const route = data.logistics
    if (!route.carrierName?.trim()) gaps.push('承运方')
    if (!route.payerCode) gaps.push('费用承担方')
    if (route.entryMode === 'NONE' && !route.noSourceReason?.trim()) gaps.push('无单原因')
    if (route.legCode === 'DELIVERY') {
      if (route.sourceIds?.length) {
        if (
          route.sourceIds.some(
            (id) => !route.deliveryStops?.find((stop) => stop.sourceId === id)?.address?.trim(),
          )
        )
          gaps.push('每张销售订单的收货地址')
      } else if ((route.externalDocuments?.length || 0) <= 1 && !route.destinationAddress?.trim()) {
        gaps.push('客户收货地址')
      }
    }
  }
  if (category === 'expenses') {
    if (!data.ownerEmployeeCode) gaps.push('报销员工')
    if (!data.typeCode) gaps.push('报销类型')
    if (!data.expense?.purpose?.trim()) gaps.push('费用用途 / 出差事由')
    const expense = data.expense
    if (data.typeCode === 'COURIER') {
      if (!expense?.courier?.contents?.trim()) gaps.push('寄送内容')
      if (!expense?.courier?.recipientName?.trim()) gaps.push('收件客户 / 合作方')
      if (!expense?.courier?.companyName?.trim()) gaps.push('快递公司')
      if (!expense?.courier?.trackingNo?.trim()) gaps.push('运单号')
    }
    if (['TRAVEL', 'ACCOMMODATION', 'TAXI'].includes(data.typeCode || '')) {
      if (!expense?.startDate) gaps.push('开始日期')
      if (!expense?.endDate) gaps.push('结束日期')
      if (data.typeCode !== 'ACCOMMODATION' && !expense?.departure?.trim()) gaps.push('出发地')
      if (!expense?.destination?.trim()) gaps.push('目的地 / 住宿地点')
    }
    if (expense?.startDate && expense.endDate && expense.endDate < expense.startDate)
      gaps.push('结束日期不得早于开始日期')
    if (
      ['OFFICE', 'OFFICE_SUPPLIES', 'CONSUMABLE', 'CONSUMABLES', 'FIXED_ASSET'].includes(
        data.typeCode || '',
      )
    ) {
      if (!expense?.itemName?.trim()) gaps.push('物品或服务')
      if (!expense?.unit?.trim()) gaps.push('单位')
      if (expense?.quantity == null || expense.quantity <= 0) gaps.push('物品数量')
    }
    if (expense?.costCategory === 'freight' && !expense.freightLeg) gaps.push('运输环节')
    if (
      expense?.unitPrice != null &&
      expense.quantity != null &&
      data.amount != null &&
      data.amount !== suggestedPurchaseAmount(expense.unitPrice, expense.quantity) &&
      !expense.amountReason?.trim()
    )
      gaps.push('金额差异说明')
  }
  return gaps
}
