import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import {
  getCost,
  getCostAttachments,
  saveCost,
  uploadCostAttachment,
  type CostCommand,
  type CostRecord,
} from '@/api/core/cost'
import {
  appendCostAttachmentFiles,
  CostAttachmentSaveSession,
  usesEntryAttachments,
  type CostAttachmentDraft,
} from '@/views/supply-chain/cost/cost-attachment-draft'
import CostAttachmentEditor from '@/views/supply-chain/cost/CostAttachmentEditor.vue'
vi.mock('@/api/core/cost', () => ({
  getCost: vi.fn(),
  saveCost: vi.fn(),
  uploadCostAttachment: vi.fn(),
  getCostAttachments: vi.fn(),
  getCostAttachmentUrl: vi.fn(),
}))
const pdf = (name = '费用票据.pdf', contents = '%PDF-1.7 test') =>
  new File([contents], name, { type: 'application/pdf' })
function command(): CostCommand {
  return {
    requestId: 'one-request',
    revision: null,
    title: '武汉门店培训交通费',
    typeCode: 'TRAVEL',
    cityCode: '4201',
    cityName: '武汉市',
    departmentId: 1,
    ownerEmployeeCode: 'E1',
    costDate: '2026-10-17',
    amount: 320,
    paymentStatusCode: 'UNPAID',
    logistics: null,
    rental: null,
    remark: '',
    reason: '',
  }
}
function row(data = command(), revision = 1): CostRecord {
  return {
    id: 'one-bill',
    documentNo: 'EXP-1',
    categoryCode: 'EXPENSE',
    statusCode: 'DRAFT',
    revision,
    data: structuredClone(data),
    sources: [],
    warehouseName: null,
    ownerEmployeeName: '员工',
    createdTime: '',
    updatedTime: '',
  }
}
function attachment(id: string) {
  return {
    id,
    fileName: id + '.pdf',
    contentType: 'application/pdf',
    size: 12,
    createdTime: '',
    createdBy: 'login-user',
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCostAttachments).mockResolvedValue([])
})
describe('按业务选择填单附件', () => {
  it('仅损耗现场证据和报销票据进入本轮表单，不向全部台账添加', () => {
    for (const category of [
      'purchases',
      'logistics',
      'warehouse-rentals',
      'office-rentals',
      'marketing',
    ] as const)
      expect(usesEntryAttachments(category)).toBe(false)
    expect(usesEntryAttachments('losses')).toBe(true)
    expect(usesEntryAttachments('expenses')).toBe(true)
  })
  it('校验内容、大小、类型；无效批次不改变已选择的文件', async () => {
    const current = await appendCostAttachmentFiles([], [pdf()], 0)
    await expect(
      appendCostAttachmentFiles(
        current,
        [pdf('新票据.pdf'), new File(['bad'], '假图片.png', { type: 'image/png' })],
        0,
      ),
    ).rejects.toThrow('有效的 PNG')
    expect(current).toHaveLength(1)
    await expect(
      appendCostAttachmentFiles([], [new File([], '空.pdf', { type: 'application/pdf' })], 0),
    ).rejects.toThrow('非空')
    await expect(
      appendCostAttachmentFiles(
        [],
        [new File([new Uint8Array(10 * 1024 * 1024 + 1)], '过大.pdf', { type: 'application/pdf' })],
        0,
      ),
    ).rejects.toThrow('10 MB')
    await expect(
      appendCostAttachmentFiles(
        [],
        [new File(['<svg></svg>'], '图片.svg', { type: 'image/svg+xml' })],
        0,
      ),
    ).rejects.toThrow('有效的 PNG')
  })
  it('相同文件不重复加入，内容不同保留，并计入已有附件上限', async () => {
    const current = await appendCostAttachmentFiles(
      [],
      [pdf(), pdf(), pdf('费用票据.pdf', '%PDF-1.7 other')],
      18,
    )
    expect(current).toHaveLength(2)
    await expect(appendCostAttachmentFiles(current, [pdf('超额.pdf')], 18)).rejects.toThrow(
      '最多 20',
    )
    const inferred = await appendCostAttachmentFiles(
      [],
      [new File(['%PDF-1.7 test'], '无类型.pdf')],
      0,
    )
    expect(inferred[0]!.file.type).toBe('application/pdf')
  })
  it('新增时可选择和移除文件，未保存单据不会调用上传接口', async () => {
    const drafts = await appendCostAttachmentFiles([], [pdf()], 0)
    const wrapper = mount(CostAttachmentEditor, {
      props: { modelValue: drafts, category: 'expenses', row: null, disabled: false },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.text()).toContain('添加费用票据')
    expect(wrapper.text()).toContain('费用票据.pdf')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '移除')!
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual([])
    expect(uploadCostAttachment).not.toHaveBeenCalled()
    expect(getCostAttachments).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('编辑时读取已有附件且上传中不能移除文件', async () => {
    vi.mocked(getCostAttachments).mockResolvedValue([attachment('saved')])
    const drafts = await appendCostAttachmentFiles([], [pdf()], 0)
    const wrapper = mount(CostAttachmentEditor, {
      props: { modelValue: drafts, category: 'losses', row: row(), disabled: true },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('损耗照片与凭证')
    expect(wrapper.text()).toContain('saved.pdf')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '移除')!
        .attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })
})
describe('费用与附件保存闭环', () => {
  it('先保存一次费用，逐个读取新版本后上传附件', async () => {
    const form = command(),
      saved = row(form)
    vi.mocked(saveCost).mockResolvedValue(saved)
    vi.mocked(getCost)
      .mockResolvedValueOnce({ ...saved, revision: 2 })
      .mockResolvedValueOnce({ ...saved, revision: 3 })
    vi.mocked(uploadCostAttachment)
      .mockResolvedValueOnce(attachment('a'))
      .mockResolvedValueOnce(attachment('b'))
    const drafts = await appendCostAttachmentFiles([], [pdf('a.pdf'), pdf('b.pdf')], 0)
    const session = new CostAttachmentSaveSession(),
      onSaved = vi.fn()
    const result = await session.save('expenses', null, form, drafts, onSaved)
    expect(saveCost).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadCostAttachment).mock.calls.map((call) => call[1].revision)).toEqual([
      1, 2,
    ])
    expect(drafts.map((file) => file.status)).toEqual(['uploaded', 'uploaded'])
    expect(result.revision).toBe(3)
  })
  it('部分失败保留单据及文件；重试只上传未完成文件，不重复创建费用', async () => {
    const form = reactive(command()),
      saved = row()
    vi.mocked(saveCost).mockResolvedValue(saved)
    vi.mocked(getCost).mockResolvedValue({ ...saved, revision: 2 })
    vi.mocked(uploadCostAttachment)
      .mockResolvedValueOnce(attachment('a'))
      .mockRejectedValueOnce(new Error('网络超时'))
      .mockResolvedValueOnce(attachment('b'))
    const drafts = reactive(await appendCostAttachmentFiles([], [pdf('a.pdf'), pdf('b.pdf')], 0))
    const session = new CostAttachmentSaveSession(),
      callback = (r: CostRecord) => {
        form.revision = r.revision
      }
    await expect(session.save('expenses', null, form, drafts, callback)).rejects.toThrow(
      '费用已保存',
    )
    expect(drafts.map((file) => file.status)).toEqual(['uploaded', 'failed'])
    expect(drafts[1]!.error).toBe('网络超时')
    await session.save('expenses', 'one-bill', form, drafts, callback)
    expect(saveCost).toHaveBeenCalledTimes(1)
    expect(uploadCostAttachment).toHaveBeenCalledTimes(3)
    expect(drafts.map((file) => file.status)).toEqual(['uploaded', 'uploaded'])
  })
  it('上传成功但刷新失败，重试先核对原单，不重复传已成功附件', async () => {
    const form = command(),
      saved = row(form)
    vi.mocked(saveCost).mockResolvedValue(saved)
    vi.mocked(uploadCostAttachment).mockResolvedValue(attachment('a'))
    vi.mocked(getCost)
      .mockRejectedValueOnce(new Error('刷新超时'))
      .mockResolvedValue({ ...saved, revision: 2 })
    const drafts = await appendCostAttachmentFiles([], [pdf()], 0),
      session = new CostAttachmentSaveSession()
    await expect(session.save('losses', null, form, drafts, vi.fn())).rejects.toThrow('附件已上传')
    await session.save('losses', saved.id, form, drafts, vi.fn())
    expect(uploadCostAttachment).toHaveBeenCalledTimes(1)
    expect(saveCost).toHaveBeenCalledTimes(1)
  })
  it('费用被他人修改或确认后，拒绝继续向旧数据上传', async () => {
    const form = command(),
      saved = row(form),
      session = new CostAttachmentSaveSession()
    vi.mocked(saveCost).mockResolvedValue(saved)
    vi.mocked(uploadCostAttachment).mockRejectedValueOnce(new Error('超时'))
    const drafts = await appendCostAttachmentFiles([], [pdf()], 0)
    await expect(session.save('expenses', null, form, drafts, vi.fn())).rejects.toThrow(
      '费用已保存',
    )
    vi.mocked(getCost).mockResolvedValue({ ...saved, data: { ...form, amount: 999 }, revision: 3 })
    await expect(session.save('expenses', saved.id, form, drafts, vi.fn())).rejects.toThrow(
      '其他操作修改',
    )
    vi.mocked(getCost).mockResolvedValue({ ...saved, statusCode: 'CONFIRMED' })
    await expect(session.save('expenses', saved.id, form, drafts, vi.fn())).rejects.toThrow(
      '其他操作修改',
    )
    expect(uploadCostAttachment).toHaveBeenCalledTimes(1)
  })
  it('部分上传失败后可改业务内容，使用原费用的新版本保存', async () => {
    const form = command(),
      saved = row(form),
      session = new CostAttachmentSaveSession()
    vi.mocked(saveCost).mockResolvedValueOnce(saved)
    vi.mocked(uploadCostAttachment).mockRejectedValueOnce(new Error('超时'))
    const drafts: CostAttachmentDraft[] = await appendCostAttachmentFiles([], [pdf()], 0)
    await expect(session.save('expenses', null, form, drafts, vi.fn())).rejects.toThrow(
      '费用已保存',
    )
    form.title = '更新出差事由'
    vi.mocked(getCost)
      .mockResolvedValueOnce({ ...saved, revision: 2 })
      .mockResolvedValueOnce(row(form, 4))
    vi.mocked(saveCost).mockResolvedValueOnce(row(form, 3))
    vi.mocked(uploadCostAttachment).mockResolvedValueOnce(attachment('a'))
    await session.save('expenses', null, form, drafts, vi.fn())
    expect(saveCost).toHaveBeenLastCalledWith(
      'expenses',
      saved.id,
      expect.objectContaining({ title: '更新出差事由', revision: 4 }),
    )
  })
})
