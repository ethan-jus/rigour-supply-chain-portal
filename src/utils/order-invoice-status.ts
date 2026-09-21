/** 开票状态展示；无记录与已撤回在列表都按"未申请"处理，详情页保留已撤回痕迹。 */
export type OrderInvoiceTag = 'success' | 'warning' | 'info'

export function orderInvoiceStatusLabel(code?: string | null): string {
  switch (code) {
    case 'PENDING':
      return '待开票'
    case 'INVOICED':
      return '已开票'
    case 'REVOKED':
      return '已撤回'
    default:
      return '未申请'
  }
}

export function orderInvoiceStatusTag(code?: string | null): OrderInvoiceTag {
  switch (code) {
    case 'INVOICED':
      return 'success'
    case 'PENDING':
      return 'warning'
    default:
      return 'info'
  }
}
