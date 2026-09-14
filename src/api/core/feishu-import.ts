import { apiClient } from './client'

export interface FeishuImportIssue {
  severity: 'INFO' | 'WARN' | 'ERROR' | string
  issueType: string
  tableName: string | null
  rowNumber: number | null
  fieldName: string | null
  message: string
  issueCategory?: string
  blocking?: boolean
  resolutionAction?: string
  resolutionHint?: string
}

export interface FeishuImportTablePreview {
  sheetName: string
  tableCode: string | null
  domainCode: string | null
  objectType: string | null
  mappingStatus: 'READY' | 'NEEDS_FIELD_MAPPING' | 'UNMAPPED_TABLE' | string
  headerRowNumber: number
  rowCount: number
  duplicateRows: number
  columnCount: number
  attachmentReferenceCount: number
  headers: string[]
  attachmentFields: string[]
  sampleRows: Record<string, string>[]
}

export interface FeishuImportPreflightResult {
  batchId: string
  status: 'PREFLIGHTED' | 'PREFLIGHTED_WITH_WARNINGS' | 'REJECTED' | string
  sourceSystem: string
  originalFileName: string
  fileSizeBytes: number
  fileSha256: string
  sourceUrl: string | null
  totalSheets: number
  totalRows: number
  duplicateRows: number
  attachmentReferenceCount: number
  createdAt: string
  tables: FeishuImportTablePreview[]
  issues: FeishuImportIssue[]
}

export interface FeishuImportBatchSummary {
  batchId: string
  status: 'PREFLIGHTED' | 'PREFLIGHTED_WITH_WARNINGS' | 'REJECTED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | string
  sourceSystem: string
  originalFileName: string
  fileSizeBytes: number
  fileSha256: string
  sourceUrl: string | null
  totalSheets: number
  totalRows: number
  duplicateRows: number
  attachmentReferenceCount: number
  createdAt: string
  updatedAt: string | null
}

export interface FeishuImportRunCommand {
  maxRows?: number
  dryRun?: boolean
  replayProjected?: boolean
  async?: boolean
}

export interface FeishuImportRunRow {
  rawRowId: string
  sheetName: string
  rowNumber: number
  tableCode: string | null
  sourceDocumentNo: string | null
  projectionStatus: 'PROJECTED' | 'WAITING_MAPPING' | 'SKIPPED' | 'FAILED' | string
  targetDomain: string | null
  targetObjectType: string | null
  targetId: string | null
  message: string | null
}

export interface FeishuImportRunIssueSummary {
  issueCategory: string
  projectionStatus: 'PROJECTED' | 'WAITING_MAPPING' | 'SKIPPED' | 'FAILED' | 'PENDING' | string
  targetDomain: string | null
  targetObjectType: string | null
  message: string | null
  rowCount: number
}

export interface FeishuImportRunResult {
  batchId: string
  status: 'PREFLIGHTED' | 'PREFLIGHTED_WITH_WARNINGS' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'DRY_RUN' | string
  dryRun: boolean
  totalRows: number
  projectedRows: number
  skippedRows: number
  waitingMappingRows: number
  failedRows: number
  executedAt: string
  uploadedAttachmentCount?: number
  failedAttachmentRows?: number
  issueSummaries?: FeishuImportRunIssueSummary[]
  rows: FeishuImportRunRow[]
}

export interface FeishuImportTemplateDependency {
  dependsOnTemplateCode: string
  relationKind: string
  sourceReferenceFields: string[]
  targetReferenceFields: string[]
  required: boolean
}

export interface FeishuImportTemplate {
  templateCode: string
  templateName: string
  sourceSystem: string
  domainCode: string
  objectType: string
  aliases: string[]
  requiredHeaders: string[]
  sourceDocumentFields: string[]
  sourceCreatedFields: string[]
  deduplicationStrategy: string
  deduplicationFields: string[]
  readyByDefault: boolean
  dependencies: FeishuImportTemplateDependency[]
}

const FEISHU_IMPORT_BASE_PATH = '/integration/feishu/import-bundles'
const FEISHU_IMPORT_PREFLIGHT_PATH = `${FEISHU_IMPORT_BASE_PATH}/preflight`
const FEISHU_IMPORT_BATCH_PREFLIGHT_PATH = `${FEISHU_IMPORT_BASE_PATH}/batch-preflight`

export function getFeishuImportBatches(limit = 20) {
  return apiClient.get<FeishuImportBatchSummary[], FeishuImportBatchSummary[]>(FEISHU_IMPORT_BASE_PATH, {
    params: { limit },
    stayOnUnauthorized: true,
  })
}

export function getFeishuImportTemplates() {
  return apiClient.get<FeishuImportTemplate[]>(`${FEISHU_IMPORT_BASE_PATH}/templates`, {
    stayOnUnauthorized: true,
  })
}

export function preflightFeishuImportBundle(file: File, sourceUrl?: string | null) {
  const form = new FormData()
  form.append('file', file)
  return apiClient.post<FeishuImportPreflightResult>(
    FEISHU_IMPORT_PREFLIGHT_PATH,
    form,
    {
      params: sourceUrl ? { sourceUrl } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
      stayOnUnauthorized: true,
    },
  )
}

export function preflightFeishuImportBundleFiles(files: File[], sourceUrl?: string | null) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  return apiClient.post<FeishuImportPreflightResult, FeishuImportPreflightResult>(
    FEISHU_IMPORT_BATCH_PREFLIGHT_PATH,
    form,
    {
      params: sourceUrl ? { sourceUrl } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
      stayOnUnauthorized: true,
    },
  )
}

export function runFeishuImportBundle(batchId: string, command: FeishuImportRunCommand) {
  return apiClient.post<FeishuImportRunResult>(
    `${FEISHU_IMPORT_BASE_PATH}/${batchId}/runs`,
    command,
    {
      timeout: 900000,
      stayOnUnauthorized: true,
    },
  )
}

export function getFeishuImportRunStatus(batchId: string, limit = 500) {
  return apiClient.get<FeishuImportRunResult>(
    `${FEISHU_IMPORT_BASE_PATH}/${batchId}/runs/latest`,
    {
      params: { limit },
      timeout: 30000,
      stayOnUnauthorized: true,
    },
  )
}
