import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/core/error'
import { exportPayroll } from '@/api/core/payroll'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core/client', () => ({ apiClient: client }))
const query = { month: '2026-09', begin: 0, step: 200, departmentId: 26 }
const changed = () => new ApiError({ code: 'IAM_AUTHORIZATION_CHANGED', message: '权限配置已更新，请重试当前操作' }, 409)
beforeEach(() => vi.resetAllMocks())

describe('月度薪酬导出的授权快照', () => {
  it('200张勾选工资单通过请求体传递，不受URL长度限制', async () => {
    const params = { ...query, payrollIds: Array.from({ length: 200 }, (_, i) => `P${i}`) }
    client.post.mockResolvedValue([])
    await exportPayroll(params)
    expect(client.post).toHaveBeenCalledWith('/hr/payroll/export', params, expect.objectContaining({ errorFeedback: 'inline' }))
    expect(client.get).not.toHaveBeenCalled()
  })
  it('旧服务仅支持GET时保留筛选条件，所选范围继续由页面严格约束', async () => {
    client.post.mockRejectedValue(new ApiError({ code: 'METHOD_NOT_ALLOWED' }, 405))
    client.get.mockResolvedValue([{ id: 'P1' }, { id: 'P2' }])
    await exportPayroll({ ...query, payrollIds: ['P1'] })
    expect(client.get).toHaveBeenCalledWith('/hr/payroll/export', expect.objectContaining({ params: query }))
  })
  it('勾选导出的权限错误与服务错误不能降级成全部导出', async () => {
    for (const status of [403, 500]) {
      client.post.mockReset().mockRejectedValue(new ApiError({ code: 'EXPORT_ERROR' }, status))
      await expect(exportPayroll({ ...query, payrollIds: ['P1'] })).rejects.toMatchObject({ status })
      expect(client.get).not.toHaveBeenCalled()
    }
  })
  it('成功时只请求一次，保留月份和授权内筛选', async () => {
    client.get.mockResolvedValue([{ employeeCode: 'A' }])
    expect(await exportPayroll(query)).toEqual([{ employeeCode: 'A' }])
    expect(client.get).toHaveBeenCalledTimes(1)
    expect(client.get).toHaveBeenCalledWith('/hr/payroll/export', expect.objectContaining({ params: query }))
  })
  it('授权在请求中变化时只重新读取一次，不向页面弹出临时全局错误', async () => {
    client.get.mockRejectedValueOnce(changed()).mockResolvedValueOnce([{ employeeCode: 'B' }])
    expect(await exportPayroll(query)).toEqual([{ employeeCode: 'B' }])
    expect(client.get).toHaveBeenCalledTimes(2)
    expect(client.get.mock.calls.every((call) => call[1].errorFeedback === 'inline')).toBe(true)
  })
  it('持续变化时返回明确错误，不无限重试或返回旧数据', async () => {
    client.get.mockRejectedValue(changed())
    await expect(exportPayroll(query)).rejects.toMatchObject({ code: 'IAM_AUTHORIZATION_CHANGED', status: 409 })
    expect(client.get).toHaveBeenCalledTimes(2)
  })
  it('禁止访问与服务异常不重试', async () => {
    for (const status of [403, 500]) {
      client.get.mockReset().mockRejectedValue(new ApiError({ code: status === 403 ? 'IAM_FORBIDDEN' : 'INTERNAL_ERROR' }, status))
      await expect(exportPayroll(query)).rejects.toMatchObject({ status })
      expect(client.get).toHaveBeenCalledTimes(1)
    }
  })
})
