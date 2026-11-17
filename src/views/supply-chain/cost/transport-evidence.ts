import { randomId } from '@/utils/random-id'
import type { CostCommand } from '@/api/core/cost'
import { saveTransportWithEvidence, type TransportDraft } from '@/api/core/transport-records'
import type { CostAttachmentDraft } from './cost-attachment-draft'

export const evidenceCategories = [
  { code: 'EXPENSE_VOUCHER', label: '费用凭证' },
  { code: 'RECEIPT', label: '运输回单' },
  { code: 'LOADING', label: '装货照片' },
  { code: 'UNLOADING', label: '卸货照片' },
] as const

/** 保留未知类型的照片，避免归并分类时漏掉源文件。 */
export function stopPhotoCategory(phase: string) {
  if (phase === '卸货照片' || /^unloading$/i.test(phase)) return 'UNLOADING'
  if (phase === '装货照片' || /^loading$/i.test(phase)) return 'LOADING'
  return 'OTHER_PHOTO'
}

/** 整单失败后保留同一提交标识；修改表单或文件后重新生成，不复用已提交内容。 */
export class TransportEvidenceSaveSession {
  private signature = ''
  private submissionId = ''
  async save(
    id: string | null,
    draft: TransportDraft,
    advanced: CostCommand | null,
    changes: CostAttachmentDraft[],
    salesOrderId?: string | number | null,
  ) {
    const uploading = changes.filter((file) => !file.removing)
    const signature = JSON.stringify({
      id,
      draft,
      advanced,
      salesOrderId,
      changes: changes.map((file) => ({
        id: file.id,
        category: file.categoryCode,
        replaces: file.replaces?.id,
        removing: file.removing,
      })),
    })
    if (signature !== this.signature) {
      this.submissionId = randomId()
      this.signature = signature
    }
    changes.forEach((file) => {
      file.status = 'uploading'
      file.error = ''
    })
    try {
      const result = await saveTransportWithEvidence(
        id,
        {
          submissionId: this.submissionId,
          draft,
          advanced,
          ...(salesOrderId == null ? {} : { salesOrderId }),
          uploads: uploading.map((file) => ({
            categoryCode: file.categoryCode || 'EXPENSE_VOUCHER',
            replacingId: file.replaces?.id || null,
          })),
          removedIds: changes.filter((file) => file.removing).map((file) => file.replaces!.id),
        },
        uploading.map((file) => file.file),
      )
      changes.forEach((file) => {
        file.status = 'uploaded'
      })
      return result
    } catch (error) {
      changes.forEach((file) => {
        file.status = 'failed'
        file.error = '保存未完成，请重试'
      })
      throw error
    }
  }
}
