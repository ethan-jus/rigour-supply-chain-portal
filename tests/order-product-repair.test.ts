import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElInput, ElFormItem, ElCheckbox, ElSelect } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dialog from '@/views/supply-chain/order/components/OrderProductRepairDialog.vue'
import * as api from '@/api/core/order-product-repair'
import type { RepairContext, RepairPreview } from '@/api/core/order-product-repair'

vi.mock('@/api/core/order-product-repair', () => ({ getOrderProductRepair: vi.fn(), previewOrderProductRepair: vi.fn(), applyOrderProductRepair: vi.fn(),
  getRepairProduct: vi.fn(), getRepairProducts: vi.fn() }))
vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryOptions: () => [{ value: 'BOX', label: '箱' }, { value: 'BUCKET', label: '桶' }],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => ({ BOX: '箱', BUCKET: '桶' }[value] || value),
}))

const original = { id: '11', lineNo: 1, productId: null, productVariantId: null, productCodeSnapshot: 'OLD',
  skuCodeSnapshot: 'OLD-S', productNameSnapshot: '拌面', specificationSnapshot: '12桶/箱', unitCode: 'BUCKET',
  quantity: 2, unitPrice: 50.123456, discountRate: 1, discountAmount: 1.123456, lineAmount: 99.123456, remark: null }
const context: RepairContext = { orderId: '1', orderNo: 'DD1', sourceOrderNo: 'FS1', revision: 1,
  lines: [{ original, revision: 1, repair: null }], recentRepairs: [] }
function response(): RepairPreview {
  return { previewId: 'preview-one', orderId: '1', orderNo: 'DD1', expectedRevision: 1, status: 'READY',
    expiresAt: new Date(Date.now() + 900000).toISOString(), reason: '凭证', createdBy: 'operator', createdAt: new Date().toISOString(),
    lines: [{ original, lineRevision: 1, requested: { lineId: '11', bindingEvidence: '商品凭证' },
      candidates: [], proposed: { productId: 101, productVariantId: 102, productCode: 'P1', skuCode: 'S1', productName: '拌面',
        specification: '桶装', unitCode: 'BUCKET', productRevision: 1, variantRevision: 1, productUpdatedTime: null, variantUpdatedTime: null },
      sourceIdentityStatus: 'UNVERIFIED', transactionUnitStatus: 'UNVERIFIED', blockers: [] }] }
}
let wrapper: VueWrapper | undefined
async function open(source = false) {
  wrapper = mount(Dialog, { attachTo: document.body, props: { modelValue: true, orderId: '1',
    'onUpdate:modelValue': (value: boolean) => { void wrapper?.setProps({ modelValue: value }) },
    ...(source ? { sourceContext: {
    sourceNamespace: 'source-one', sourceCaptureRef: 'capture-one', sourceProductRecordId: 'record-one',
    sourceProductCode: 'SOURCE-P', sourceOrderNo: 'FS1',
  } } : {}) }, global: { plugins: [ElementPlus] } })
  await flushPromises()
  wrapper.findComponent({ name: 'ElTable' }).vm.$emit('selection-change', context.lines)
  await flushPromises()
  await fill('修复原因', '凭证复核')
  await fill('商品对应复核依据', '商品凭证')
  return wrapper
}
async function fill(label: string, value: string) {
  const item = wrapper!.findAllComponents(ElFormItem).find(w => w.props('label') === label)!
  item.findComponent(ElInput).vm.$emit('update:modelValue', value)
  await flushPromises()
}
async function click(text: string) {
  await wrapper!.findAll('button').find(button => button.text().includes(text))!.trigger('click')
  await flushPromises()
}
async function confirm() {
  wrapper!.findAllComponents(ElCheckbox).find(c => c.text().includes('已复核以上'))!.vm.$emit('update:modelValue', true)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getOrderProductRepair).mockResolvedValue(structuredClone(context))
  vi.mocked(api.previewOrderProductRepair).mockResolvedValue(response())
  vi.mocked(api.applyOrderProductRepair).mockResolvedValue({ previewId: 'preview-one', orderId: '1', revision: 2,
    appliedBy: 'operator', appliedAt: new Date().toISOString(), lines: [] })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = '' })

describe('historical order repair', () => {
  it('shows the business API failure and keeps application disabled', async () => {
    vi.mocked(api.previewOrderProductRepair).mockRejectedValueOnce({ code: 'SERVICE_UNAVAILABLE', message: 'ERP商品核验暂不可用，未应用修复' })
    await open(); await click('生成预览')
    expect(wrapper!.text()).toContain('ERP商品核验暂不可用，未应用修复')
    expect(wrapper!.findAll('button').find(b => b.text().includes('确认应用'))!.attributes('disabled')).toBeDefined()
    expect(api.applyOrderProductRepair).not.toHaveBeenCalled()
  })

  it('requires a reviewed preview and explicit confirmation without sending original money or quantities', async () => {
    await open()
    expect(wrapper!.text()).toContain('50.12')
    expect(wrapper!.text()).toContain('99.12')
    expect(wrapper!.text()).not.toContain('BUCKET')
    await click('生成预览')
    expect(api.applyOrderProductRepair).not.toHaveBeenCalled()
    const command = vi.mocked(api.previewOrderProductRepair).mock.calls[0]![1]
    expect(command.lines[0]).not.toHaveProperty('quantity')
    expect(command.lines[0]).not.toHaveProperty('unitPrice')
    expect(command.lines[0]).not.toHaveProperty('historicalTransactionUnitCode', 'BUCKET')
    expect(command.lines[0]).not.toHaveProperty('standardQuantity')
    expect(wrapper!.findAll('button').find(b => b.text().includes('确认应用'))!.attributes('disabled')).toBeDefined()
    await confirm(); await click('确认应用')
    expect(api.applyOrderProductRepair).toHaveBeenCalledExactlyOnceWith('1', 'preview-one')
  })

  it('invalidates preview and confirmation after evidence changes', async () => {
    await open(); await click('生成预览'); await confirm()
    await fill('商品对应复核依据', '新的凭证')
    expect(wrapper!.find('[data-testid="repair-preview"]').exists()).toBe(false)
    expect(api.applyOrderProductRepair).not.toHaveBeenCalled()
  })

  it('ignores a late preview response after inputs change', async () => {
    let resolve!: (result: RepairPreview) => void
    vi.mocked(api.previewOrderProductRepair).mockReturnValue(new Promise(r => { resolve = r }))
    await open(); await click('生成预览')
    await fill('修复原因', '已变更原因')
    resolve(response()); await flushPromises()
    expect(wrapper!.find('[data-testid="repair-preview"]').exists()).toBe(false)
  })

  it('keeps capture identifiers hidden and never confirms source or historical units automatically', async () => {
    await open(true)
    expect(wrapper!.text()).not.toContain('capture-one')
    expect(wrapper!.text()).not.toContain('source-one')
    expect(wrapper!.text()).not.toContain('record-one')
    await click('生成预览')
    const line = vi.mocked(api.previewOrderProductRepair).mock.calls[0]![1].lines[0]!
    expect(line.sourceNamespace).toBeUndefined()
    expect(line.sourceCaptureRef).toBeUndefined()
    expect(line.confirmSourceIdentity).toBeUndefined()
    expect(line.confirmHistoricalTransactionUnit).toBe(false)
  })

  it('includes captured source identity only when the operator requests that optional review', async () => {
    await open(true)
    await fill('来源对应凭证依据', '已核对原始交易商品')
    wrapper!.findAllComponents(ElCheckbox).find(c => c.text().includes('已人工核对本笔交易'))!.vm.$emit('update:modelValue', true)
    await flushPromises(); await click('生成预览')
    const line = vi.mocked(api.previewOrderProductRepair).mock.calls[0]![1].lines[0]!
    expect(line.sourceNamespace).toBe('source-one')
    expect(line.sourceCaptureRef).toBe('capture-one')
    expect(line.sourceProductRecordId).toBe('record-one')
    expect(line.confirmSourceIdentity).toBe(true)
    expect(line.confirmHistoricalTransactionUnit).toBe(false)
  })

  it('uses product and specification selectors without copying ERP prices or default units', async () => {
    vi.mocked(api.getRepairProduct).mockResolvedValue({ id: '101', productCode: 'P1', productName: '拌面',
      variants: [{ id: '102', variantCode: 'S1', specificationSnapshot: '桶装', unitCode: 'BUCKET', salePrice: 999 }],
    } as Awaited<ReturnType<typeof api.getRepairProduct>>)
    await open()
    const product = wrapper!.findAllComponents(ElFormItem).find(w => w.props('label') === 'ERP 商品')!.findComponent(ElSelect)
    product.vm.$emit('update:modelValue', '101'); product.vm.$emit('change', '101')
    await flushPromises()
    const variant = wrapper!.findAllComponents(ElFormItem).find(w => w.props('label') === 'ERP 规格')!.findComponent(ElSelect)
    variant.vm.$emit('update:modelValue', 'S1'); await flushPromises(); await click('生成预览')
    const line = vi.mocked(api.previewOrderProductRepair).mock.calls[0]![1].lines[0]!
    expect(line.productCode).toBe('P1'); expect(line.skuCode).toBe('S1')
    expect(line.historicalTransactionUnitCode).toBeUndefined()
    expect(line).not.toHaveProperty('unitPrice')
    expect(wrapper!.text()).not.toContain('999')
  })

  it('retries an uncertain application with the same preview id after another explicit confirmation', async () => {
    vi.mocked(api.applyOrderProductRepair).mockRejectedValueOnce(new Error('网络中断'))
    await open(); await click('生成预览'); await confirm(); await click('确认应用')
    expect(wrapper!.text()).toContain('网络中断')
    await confirm(); await click('确认应用')
    expect(vi.mocked(api.applyOrderProductRepair).mock.calls).toEqual([['1', 'preview-one'], ['1', 'preview-one']])
  })
})
