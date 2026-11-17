import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { getCostAttachments, getCostAttachmentUrl, getTransportPdfContent } from '@/api/core/cost'
import { saveTransportWithEvidence, type TransportDraft } from '@/api/core/transport-records'
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
  getTransportAttachmentDownloadUrl: vi.fn(),
}))
const pdf = () => new File(['%PDF-1.7 voucher'], '运费凭证.pdf', { type: 'application/pdf' })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCostAttachments).mockResolvedValue([])
})
describe('手工运输凭证整体保存', () => {
  it('平台详情不显示空补充区，已有文件仍显示，编辑仍保留四类上传', async () => {
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
    expect(w.findAll('.evidence-group')).toHaveLength(4)
    expect(w.text()).toContain('上传运输回单')
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
        .find((b) => b.text() === '回单.pdf')!
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
    for (const text of ['费用凭证', '运输回单', '装货照片', '卸货照片'])
      expect(w.text()).toContain(text)
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
