import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiClient,
  getCrmCustomer,
  getCrmShippingAddresses,
  getCrmCustomerAreas,
  getCrmCustomers,
  getCrmCustomerTypes,
  getCrmExternalStaff,
  syncCrmData,
} from '@/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CRM 本地查询与手动同步接口', () => {
  it('所有页面查询都只调用 Gateway 下的 CRM 本地接口', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      total: 0,
      begin: 0,
      step: 20,
      items: [],
    })

    await getCrmCustomers({ begin: 0, step: 20, q: '瑞盖', status: 'ACTIVE' })
    await getCrmCustomer('customer-1')
    await getCrmShippingAddresses({ begin: 0, step: 20, q: '浦东' })
    await getCrmCustomerTypes({ begin: 0, step: 100 })
    await getCrmCustomerAreas({ begin: 0, step: 100 })
    await getCrmExternalStaff({ begin: 20, step: 20, q: '张' })

    expect(get).toHaveBeenNthCalledWith(1, '/crm/customers', {
      params: { begin: 0, step: 20, q: '瑞盖', status: 'ACTIVE' },
      stayOnUnauthorized: true,
    })
    expect(get).toHaveBeenNthCalledWith(2, '/crm/customers/customer-1', {
      stayOnUnauthorized: true,
    })
    expect(get).toHaveBeenNthCalledWith(3, '/crm/shipping-addresses', {
      params: { begin: 0, step: 20, q: '浦东' },
      stayOnUnauthorized: true,
    })
    expect(get).toHaveBeenNthCalledWith(4, '/crm/customer-types', {
      params: { begin: 0, step: 100 },
      stayOnUnauthorized: true,
    })
    expect(get).toHaveBeenNthCalledWith(5, '/crm/customer-areas', {
      params: { begin: 0, step: 100 },
      stayOnUnauthorized: true,
    })
    expect(get).toHaveBeenNthCalledWith(6, '/crm/external-staff', {
      params: { begin: 20, step: 20, q: '张' },
      stayOnUnauthorized: true,
    })
  })

  it('手动同步只提交后端已有的对象类型和分页上限', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      batchId: 'batch-1',
      status: 'SUCCEEDED',
      objects: [],
    })

    await syncCrmData('ALL', 100)
    await syncCrmData('CUSTOMER', 20)

    expect(post).toHaveBeenNthCalledWith(1, '/crm/sync',
      { objectType: 'ALL', maxPages: 100 },
      { timeout: 300000, stayOnUnauthorized: true })
    expect(post).toHaveBeenNthCalledWith(2, '/crm/sync',
      { objectType: 'CUSTOMER', maxPages: 20 },
      { timeout: 300000, stayOnUnauthorized: true })
  })
})
