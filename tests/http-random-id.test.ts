import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId } from '@/utils/random-id'
import { newPayrollMetric, newSchemeCommission } from '@/utils/payroll-scheme'
import { newCommissionRow } from '@/utils/payroll-commission-rows'
import { appendCostAttachmentFiles } from '@/views/supply-chain/cost/cost-attachment-draft'

const browserCrypto = globalThis.crypto
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

function useHttpCrypto() {
  vi.stubGlobal('crypto', {
    getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto),
  })
}

describe('LAN HTTP business identifiers', () => {
  it('uses native UUID generation when available', () => {
    const native = vi.fn(() => '0f315275-2f86-4a7e-8c76-9d6cf55a958f')
    vi.stubGlobal('crypto', { randomUUID: native })
    expect(randomId()).toBe('0f315275-2f86-4a7e-8c76-9d6cf55a958f')
    expect(native).toHaveBeenCalledOnce()
  })

  it('creates distinct UUID v4 values without the secure-context-only API', () => {
    useHttpCrypto()
    const ids = Array.from({ length: 100 }, () => randomId())
    expect(new Set(ids).size).toBe(100)
    ids.forEach((id) => expect(id).toMatch(uuid))
  })

  it('creates salary metrics and commission rows on HTTP', () => {
    useHttpCrypto()
    expect(newPayrollMetric().code).toMatch(uuid)
    expect(newSchemeCommission().code).toMatch(uuid)
    const row = newCommissionRow('商品提成')
    expect(row.code).toMatch(uuid)
    expect(row.sales.rowCode).toBe(row.code)
    expect(row.manager.rowCode).toBe(row.code)
    expect(row.sales.code).not.toBe(row.manager.code)
  })

  it('adds cost evidence before saving a bill on HTTP', async () => {
    useHttpCrypto()
    const file = new File(['%PDF-1.7\nreceipt'], '费用凭据.pdf', { type: 'application/pdf' })
    const rows = await appendCostAttachmentFiles([], [file], 0)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toMatch(uuid)
    expect(rows[0]?.status).toBe('pending')
  })
})
