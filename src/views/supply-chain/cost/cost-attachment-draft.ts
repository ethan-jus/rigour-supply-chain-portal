import { randomId } from '@/utils/random-id'
import { errorMessage } from '@/api/core/error'
import {
  getCost,
  saveCost,
  uploadCostAttachment,
  type CostAttachment,
  type CostCategory,
  type CostCommand,
  type CostRecord,
} from '@/api/core/cost'

export interface CostAttachmentDraft {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'uploaded' | 'failed'
  error: string
  attachment?: CostAttachment
}

/** 现场报损与员工报销需要在填单时提交证据，其余台账继续使用各自业务单据入口。 */
export function usesEntryAttachments(category: CostCategory) {
  return category === 'losses' || category === 'expenses'
}

function readBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('文件读取失败，请重新选择'))
    reader.readAsArrayBuffer(file)
  })
}

async function checkedFile(file: File): Promise<File> {
  if (!file.name.trim() || file.name.length > 200 || /[\u0000-\u001f]/u.test(file.name))
    throw new Error('文件名须为 1—200 个字符，不能包含控制字符')
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new Error(`${file.name}：请选择非空且不超过 10 MB 的文件`)
  const type =
    file.type ||
    (/\.png$/i.test(file.name)
      ? 'image/png'
      : /\.jpe?g$/i.test(file.name)
        ? 'image/jpeg'
        : /\.pdf$/i.test(file.name)
          ? 'application/pdf'
          : '')
  const bytes = new Uint8Array(await readBytes(file.slice(0, 8)))
  const matches =
    bytes.length >= 8 &&
    ((type === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) ||
      (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
      (type === 'application/pdf' && [37, 80, 68, 70, 45].every((v, i) => bytes[i] === v)))
  if (!matches) throw new Error(`${file.name}：请选择有效的 PNG、JPEG 或 PDF 文件`)
  return file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified })
}

export async function appendCostAttachmentFiles(
  current: CostAttachmentDraft[],
  files: File[],
  existingCount: number,
): Promise<CostAttachmentDraft[]> {
  const result = [...current]
  for (const candidate of files) {
    const file = await checkedFile(candidate)
    let duplicate = false
    for (const item of result.filter(
      (r) => r.file.name === file.name && r.file.size === file.size && r.file.type === file.type,
    )) {
      const [a, b] = await Promise.all([readBytes(item.file), readBytes(file)])
      const bytes = new Uint8Array(a),
        other = new Uint8Array(b)
      if (bytes.every((value, index) => value === other[index])) {
        duplicate = true
        break
      }
    }
    if (duplicate) continue
    if (existingCount + result.length >= 20)
      throw new Error('每条记录最多 20 个附件，请移除多余文件')
    result.push({ id: randomId(), file, status: 'pending', error: '' })
  }
  return result
}

/** 对象键排序避免序列化顺序造成误判，业务修订与附件导致的版本变化分别处理。 */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  )
}
function formSignature(command: CostCommand) {
  return stable({ ...command, revision: null })
}

/** 保存结果不确定或附件部分失败时沿用本次单据，不重新创建费用。 */
export class CostAttachmentSaveSession {
  savedRecord: CostRecord | null = null
  private savedSignature = ''

  async save(
    category: CostCategory,
    id: string | null,
    command: CostCommand,
    attachments: CostAttachmentDraft[],
    saved: (row: CostRecord) => void,
  ): Promise<CostRecord> {
    if (this.savedRecord) {
      const current = await getCost(category, this.savedRecord.id)
      if (current.statusCode !== 'DRAFT' || stable(current.data) !== stable(this.savedRecord.data))
        throw new Error('费用已被其他操作修改，请保留附件并重新打开费用核对')
      this.savedRecord = current
      command.revision = current.revision
      id = current.id
      saved(current)
    }
    const signature = formSignature(command)
    if (!this.savedRecord || signature !== this.savedSignature) {
      this.savedRecord = await saveCost(category, id, command)
      this.savedSignature = signature
      saved(this.savedRecord)
    }
    for (const item of attachments.filter((file) => file.status !== 'uploaded')) {
      item.status = 'uploading'
      item.error = ''
      try {
        item.attachment = await uploadCostAttachment(category, this.savedRecord, item.file)
        item.status = 'uploaded'
      } catch (error) {
        item.status = 'failed'
        item.error = errorMessage(error, '上传失败，请重试')
        throw new Error('费用已保存，附件未全部上传成功，请重试未成功的附件')
      }
      let current: CostRecord
      try {
        current = await getCost(category, this.savedRecord.id)
      } catch {
        throw new Error('附件已上传，费用信息刷新失败，请重试核对')
      }
      if (current.statusCode !== 'DRAFT' || stable(current.data) !== stable(this.savedRecord.data))
        throw new Error('费用已被其他操作修改，请重新打开费用核对')
      this.savedRecord = current
      command.revision = current.revision
      saved(current)
    }
    return this.savedRecord
  }
}
