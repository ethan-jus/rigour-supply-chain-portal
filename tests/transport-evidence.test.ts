import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { getCostAttachments, getCostAttachmentUrl, getTransportPdfContent } from '@/api/core/cost'
import {
  saveTransportWithEvidence,
  getTransportVoucher,
  getTransportEvidenceContent,
  type TransportDraft,
} from '@/api/core/transport-records'
import { TransportEvidenceSaveSession } from '@/views/supply-chain/cost/transport-evidence'
import { appendCostAttachmentFiles } from '@/views/supply-chain/cost/cost-attachment-draft'
import Evidence from '@/views/supply-chain/cost/TransportEvidence.vue'
import Preview from '@/views/supply-chain/cost/CostFilePreview.vue'
vi.mock('@/api/core/cost', () => ({
  getCostAttachments: vi.fn(),
  getCostAttachmentUrl: vi.fn(),
  getTransportPdfContent: vi.fn(),
}))
vi.mock('@/api/core/transport-records', () => ({
  saveTransportWithEvidence: vi.fn(),
  getTransportEvidenceContent: vi.fn(),
  getTransportVoucher: vi.fn(),
}))
const pdf = () => new File(['%PDF-1.7 voucher'], '运费凭证.pdf', { type: 'application/pdf' })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCostAttachments).mockResolvedValue([])
  vi.mocked(getTransportEvidenceContent).mockResolvedValue(new Blob(['file']))
})
describe('手工运输凭证整体保存', () => {
  it('详情不显示空补充区，已有文件仍显示，编辑统一提供四类上传', async () => {
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1' } as never,
        readonly: true,
        disabled: false,
        required: false,
        hideEmpty: true,
      },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(w.find('section.transport-evidence').exists()).toBe(false)
    vi.mocked(getCostAttachments).mockResolvedValue([
      {
        id: 'F1',
        fileName: '人工补充卸货.jpg',
        contentType: 'image/jpeg',
        categoryCode: 'UNLOADING',
        size: 10,
        createdBy: 'user',
        createdTime: '',
      },
    ])
    await w.setProps({ row: { id: 'C2' } as never })
    await flushPromises()
    expect(w.text()).toContain('人工补充卸货.jpg')
    expect(w.text()).not.toContain('暂无运输回单')
    expect(w.findAll('.evidence-group')).toHaveLength(1)
    await w.setProps({ readonly: false })
    expect(w.findAll('.evidence-group')).toHaveLength(1)
    expect(
      w.findAllComponents({ name: 'ElDropdownItem' }).map((item) => item.props('command')),
    ).toEqual(['EXPENSE_VOUCHER', 'RECEIPT', 'LOADING', 'UNLOADING'])
    w.unmount()
  })
  it('货拉拉和人工附件按分类合并，空分类不占卡片，平台文件只读且仍能查看下载', async () => {
    vi.mocked(getCostAttachments).mockResolvedValue([
      {
        id: 'M1',
        fileName: '人工补充卸货.jpg',
        contentType: 'image/jpeg',
        categoryCode: 'UNLOADING',
        size: 10,
        createdBy: 'user',
        createdTime: '2026-11-17T03:00:00Z',
      },
    ])
    vi.mocked(getTransportVoucher).mockResolvedValue({
      url: 'https://our-cos.example/temporary.jpg',
    } as never)
    const platform = {
      source: {
        order: {
          raw: {},
          facts: {
            fees: [],
            receipts: [],
            billVouchers: [],
            receiptInfo: {
              type: 3,
              status: 3,
              backType: 2,
              expressNo: 'SF001',
              remark: '纸质回单',
            },
            stopPhotos: [
              {
                stopIndex: 0,
                name: '总部仓',
                phase: '装货照片',
                vouchers: [{ id: 'L1', name: '平台装货.jpg', state: 'READY' }],
              },
              {
                stopIndex: 1,
                name: '门店',
                phase: '卸货照片',
                vouchers: [{ id: 'U1', name: '平台卸货.jpg', state: 'READY' }],
              },
            ],
          },
        },
      },
      billHistory: [],
    } as never
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1', data: {} } as never,
        platform,
        readonly: false,
        disabled: false,
        required: false,
        embedded: true,
        hideEmpty: true,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(w.findAll('.evidence-group h4').map((h) => h.text())).toEqual([
      '运输回单',
      '装货照片',
      '卸货照片',
    ])
    for (const name of ['平台装货.jpg', '平台卸货.jpg', '人工补充卸货.jpg']) {
      expect(w.text().split(name)).toHaveLength(2)
    }
    expect(w.text()).not.toContain('补充业务凭证')
    expect(w.text()).not.toContain('暂无费用凭证')
    const unloading = w
      .findAll('.evidence-group')
      .find((group) => group.get('h4').text() === '卸货照片')!
    expect(unloading.findAll('tbody tr')).toHaveLength(2)
    expect(unloading.text()).toContain('平台卸货.jpg')
    expect(unloading.text()).toContain('人工补充卸货.jpg')
    expect(unloading.text()).toContain('2026-11-17 11:00:00')
    expect(unloading.find('ul').exists()).toBe(false)

    expect(w.text()).toContain('SF001')
    expect(w.findAll('button').filter((b) => b.text() === '移除')).toHaveLength(1)
    await w
      .findAll('button')
      .find((b) => b.text() === '查看')!
      .trigger('click')
    await flushPromises()
    expect(getTransportVoucher).toHaveBeenLastCalledWith('C1', 'L1')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const objectUrl = vi.fn().mockReturnValue('blob:download')
    vi.stubGlobal('URL', { createObjectURL: objectUrl, revokeObjectURL: vi.fn() })
    await w
      .findAll('button')
      .find((b) => b.text() === '下载')!
      .trigger('click')
    await flushPromises()
    expect(getTransportEvidenceContent).toHaveBeenLastCalledWith('C1', 'L1', true)
    const manual = unloading
      .findAll('tbody tr')
      .find((row) => row.text().includes('人工补充卸货.jpg'))!
    await manual
      .findAll('button')
      .find((button) => button.text() === '下载')!
      .trigger('click')
    await flushPromises()
    expect(getTransportEvidenceContent).toHaveBeenLastCalledWith('C1', 'M1')
    expect(getTransportVoucher).toHaveBeenCalledTimes(1)
    expect(objectUrl).toHaveBeenCalledTimes(2)
    click.mockRestore()
    vi.unstubAllGlobals()
    await w.setProps({ readonly: true })
    expect(w.findAll('.evidence-group h4').map((h) => h.text())).toEqual([
      '运输回单',
      '装货照片',
      '卸货照片',
    ])
    expect(w.findAll('button').some((b) => b.text() === '移除')).toBe(false)
    expect(w.text()).toContain('人工补充卸货.jpg')
    await w.setProps({ readonly: false })
    w.getComponent({ name: 'ElDropdown' }).vm.$emit('command', 'EXPENSE_VOUCHER')
    await flushPromises()
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [pdf()], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(w.emitted('update:modelValue')).toBeDefined())
    const additions = w.emitted('update:modelValue')!.at(-1)![0] as never[]
    await w.setProps({ modelValue: additions })
    expect(w.findAll('.evidence-group h4').map((h) => h.text())).toEqual([
      '费用凭证',
      '运输回单',
      '装货照片',
      '卸货照片',
    ])
    expect(w.text()).toContain('运费凭证.pdf')
    // 四份平台资料不计入人工上传份数，原有一份人工文件加本次新增的一份。
    expect(w.emitted('count')?.at(-1)).toEqual([2])
    w.unmount()
  })
  it('未知照片类型仍保留，失败附件展示重试状态，不误归类为装货或卸货', async () => {
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1', data: {} } as never,
        readonly: true,
        disabled: false,
        required: false,
        platform: {
          source: {
            order: {
              raw: {},
              facts: {
                fees: [],
                stopPhotos: [
                  {
                    stopIndex: 1,
                    name: '中转点',
                    phase: '其他照片',
                    vouchers: [{ id: 'X1', name: '途中照片.jpg', state: 'FAILED' }],
                  },
                ],
              },
            },
          },
          billHistory: [],
        } as never,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(w.findAll('.evidence-group h4').map((h) => h.text())).toEqual(['其他运输照片'])
    expect(w.text()).toContain('途中照片.jpg')
    expect(w.text()).toContain('获取失败，将自动重试')
    expect(w.findAll('button').some((b) => b.text() === '下载')).toBe(false)
    w.unmount()
  })
  it('精简平台补充区时仍显示读取失败和重试入口', async () => {
    vi.mocked(getCostAttachments).mockRejectedValueOnce(new Error('附件暂不可用'))
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1' } as never,
        readonly: true,
        disabled: false,
        required: false,
        hideEmpty: true,
      },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(w.text()).toContain('重新加载凭证')
    w.unmount()
  })
  it('保存后的PDF通过已登录接口读取，关闭预览释放本地对象地址', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:private-pdf', revokeObjectURL: revoke })
    const file = {
      id: 'F1',
      fileName: '回单.pdf',
      contentType: 'application/pdf',
      size: 30,
      categoryCode: 'RECEIPT',
      createdBy: 'user',
      createdTime: '',
    }
    vi.mocked(getCostAttachments).mockResolvedValue([file])
    vi.mocked(getTransportPdfContent).mockResolvedValue(new Blob(['%PDF-1.7']))
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1' } as never,
        readonly: true,
        disabled: false,
        required: false,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    try {
      await flushPromises()
      await w
        .findAll('button')
        .find((b) => b.text() === '查看')!
        .trigger('click')
      await flushPromises()
      expect(getTransportPdfContent).toHaveBeenCalledWith('C1', 'F1')
      expect(getCostAttachmentUrl).not.toHaveBeenCalled()
      expect(w.getComponent({ name: 'CostFilePreview' }).props('url')).toBe('blob:private-pdf')
      w.getComponent({ name: 'CostFilePreview' }).vm.$emit('update:modelValue', false)
      await flushPromises()
      expect(revoke).toHaveBeenCalledWith('blob:private-pdf')
    } finally {
      w.unmount()
      vi.unstubAllGlobals()
    }
  })
  it('重试沿用提交标识和文件，失败不标记为已保存；成功只提交一次完整请求', async () => {
    const session = new TransportEvidenceSaveSession(),
      drafts = await appendCostAttachmentFiles([], [pdf()], 0)
    drafts[0]!.categoryCode = 'RECEIPT'
    const form = { requestId: 'record-request', amount: 35 } as TransportDraft
    vi.mocked(saveTransportWithEvidence)
      .mockRejectedValueOnce(new Error('COS上传失败'))
      .mockResolvedValueOnce({} as never)
    await expect(session.save(null, form, null, drafts)).rejects.toThrow('COS上传失败')
    expect(drafts[0]!.status).toBe('failed')
    await session.save(null, form, null, drafts)
    const calls = vi.mocked(saveTransportWithEvidence).mock.calls
    expect(calls[0]![1].submissionId).toBe(calls[1]![1].submissionId)
    expect(calls[1]![1].uploads).toEqual([{ categoryCode: 'RECEIPT', replacingId: null }])
    expect(calls[1]![2][0]).toBe(drafts[0]!.file)
    expect(drafts[0]!.status).toBe('uploaded')
  })
  it('文件更换、移除及费用修改形成新的提交，不把本地URL当COS对象键', async () => {
    const session = new TransportEvidenceSaveSession(),
      changes = await appendCostAttachmentFiles([], [pdf()], 0)
    const form = { amount: 35 } as TransportDraft
    vi.mocked(saveTransportWithEvidence).mockRejectedValue(new Error('网络失败'))
    await expect(session.save('C1', form, null, changes)).rejects.toThrow()
    await expect(session.save('C1', { ...form, amount: 40 }, null, changes)).rejects.toThrow()
    const calls = vi.mocked(saveTransportWithEvidence).mock.calls
    expect(calls[0]![1].submissionId).not.toBe(calls[1]![1].submissionId)
    expect(JSON.stringify(calls[1]![1])).not.toContain('blob:')
    expect(JSON.stringify(calls[1]![1])).not.toContain('fileKey')
  })
  it('四类凭证统一展示，已有归档分类回显，删除最后一份后计数为零供表单阻止保存', async () => {
    const file = {
      id: 'proof1',
      fileName: '卸货.jpg',
      contentType: 'image/jpeg',
      size: 10,
      categoryCode: 'UNLOADING',
      createdBy: 'user',
      createdTime: '',
    }
    vi.mocked(getCostAttachments).mockResolvedValue([file])
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1' } as never,
        readonly: false,
        disabled: false,
        required: true,
      },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(
      w.findAllComponents({ name: 'ElDropdownItem' }).map((item) => item.props('command')),
    ).toEqual(['EXPENSE_VOUCHER', 'RECEIPT', 'LOADING', 'UNLOADING'])
    expect(w.text()).toContain('卸货.jpg')
    expect(w.emitted('count')?.at(-1)).toEqual([1])
    await w
      .findAll('button')
      .find((b) => b.text() === '移除')!
      .trigger('click')
    const updates = w.emitted('update:modelValue')!.at(-1)![0] as never[]
    await w.setProps({ modelValue: updates })
    expect(w.emitted('count')?.at(-1)).toEqual([0])
    expect(w.text()).toContain('待移除')
    w.unmount()
  })
  it('附件加载失败时阻止保存并提供重试，不把加载失败当没有附件', async () => {
    vi.mocked(getCostAttachments).mockRejectedValueOnce(new Error('服务不可用'))
    const w = mount(Evidence, {
      props: {
        modelValue: [],
        row: { id: 'C1' } as never,
        readonly: false,
        disabled: false,
        required: true,
      },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(w.text()).toContain('重新加载凭证')
    expect(w.emitted('busy')?.at(-1)).toEqual([true])
    await w
      .findAll('button')
      .find((b) => b.text() === '重新加载凭证')!
      .trigger('click')
    await flushPromises()
    expect(w.emitted('busy')?.at(-1)).toEqual([false])
    w.unmount()
  })
  it('Office附件不会通过iframe自动触发下载', async () => {
    const w = mount(Preview, {
      props: {
        modelValue: true,
        name: '运费表.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        url: 'https://example.invalid/file',
      },
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.querySelector('iframe')).toBeNull()
    expect(document.body.textContent).toContain('暂不支持在线预览')
    w.unmount()
  })
})
