import { describe, expect, it } from 'vitest'
import { biErrorMessage, biNeedsLogin } from '@/views/supply-chain/bi/bi-error'

describe('BI接口错误提示', () => {
  it('网络超时不泄露英文传输错误，也不把未知结果说成失败', () => {
    for (const code of ['NETWORK_ERROR', 'ECONNABORTED', 'ETIMEDOUT']) {
      const message = biErrorMessage({ code, message: 'timeout of 180000ms exceeded' }, '失败')
      expect(message).toContain('结果尚未确认')
      expect(message).toContain('刷新记录')
      expect(message).not.toContain('180000')
    }
  })
  it('只为身份失效提供重新登录，不将权限不足误当成退出', () => {
    expect(biNeedsLogin({ code: 'UNAUTHORIZED' })).toBe(true)
    expect(biNeedsLogin({ response: { status: 401 } })).toBe(true)
    for (const failure of [null, {}, { code: 'FORBIDDEN' }, { response: { status: 403 } }]) {
      expect(biNeedsLogin(failure)).toBe(false)
    }
  })
  it('保留后端结构化业务错误，不吞成通用失败', () => {
    expect(biErrorMessage({ code: 'FORBIDDEN', message: '未授权该城市' }, '失败')).toBe(
      '未授权该城市',
    )
    expect(biErrorMessage(new Error('连接超时'), '失败')).toBe('连接超时')
  })
  it('不显示空消息或序列化任意响应对象', () => {
    for (const value of [null, undefined, {}, { message: '  ' }, { message: { internal: true } }]) {
      expect(biErrorMessage(value, '失败')).toBe('失败')
    }
  })
  it('从稳定原因码恢复在线对账的处置提示，不泄露数据库错误', () => {
    const failure = {
      code: 'SERVICE_UNAVAILABLE',
      message: '服务暂不可用，请稍后重试',
      details: [{ reason: 'BI_ONLINE_SOURCE_READ_NOT_PROVISIONED', message: 'SELECT denied' }],
    }
    expect(biErrorMessage(failure, '失败')).toContain('重试已采集版本的复核')
    expect(biErrorMessage(failure, '失败')).not.toContain('SELECT')
    expect(biErrorMessage({ ...failure, details: [{ reason: 'OTHER' }] }, '失败')).toBe(
      failure.message,
    )
    expect(biErrorMessage({ ...failure, details: null }, '失败')).toBe(failure.message)
  })
  it('字典服务失败提示重试复核，不要求扩大数据库权限', () => {
    const failure = {
      code: 'SERVICE_UNAVAILABLE',
      message: '服务暂不可用，请稍后重试',
      details: [{ reason: 'BI_PRODUCT_UNIT_DICTIONARY_UNAVAILABLE', message: 'internal endpoint' }],
    }
    const message = biErrorMessage(failure, '失败')
    expect(message).toContain('商品单位字典暂不可用')
    expect(message).toContain('重试已采集版本的复核')
    expect(message).not.toMatch(/授权|internal endpoint/)
    expect(biErrorMessage({ ...failure, code: 'OTHER' }, '失败')).toBe(failure.message)
  })
})
