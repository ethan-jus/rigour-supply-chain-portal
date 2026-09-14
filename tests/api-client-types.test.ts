import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { describe, expectTypeOf, it } from 'vitest'
import { apiClient } from '@/api/core/client'

interface Invoice { id: string; amount: string }
interface InvoiceCommand { amount: string }

describe('instance-local unwrapped API types', () => {
  it('defaults all request forms to the business body without changing Axios', () => {
    expectTypeOf(apiClient.get<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.get<Invoice, Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.request<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.get).returns.toEqualTypeOf<Promise<unknown>>()
    expectTypeOf(apiClient.get<Blob>).returns.toEqualTypeOf<Promise<Blob>>()
    expectTypeOf(apiClient.delete<void>).returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf(axios.get<Invoice>).returns.toEqualTypeOf<Promise<AxiosResponse<Invoice>>>()
  })

  it('preserves legacy result overrides and typed payload/config parameters', () => {
    expectTypeOf(apiClient.post<Invoice, Invoice, InvoiceCommand>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.post<Invoice, Invoice, InvoiceCommand>).parameter(1).toEqualTypeOf<InvoiceCommand | undefined>()
    expectTypeOf(apiClient.post<Invoice, Invoice, InvoiceCommand>).parameter(2).toEqualTypeOf<AxiosRequestConfig<InvoiceCommand> | undefined>()
    expectTypeOf(apiClient.request<Invoice, Invoice, InvoiceCommand>).parameter(0).toEqualTypeOf<AxiosRequestConfig<InvoiceCommand>>()
    expectTypeOf(apiClient.get<Invoice, string>).returns.toEqualTypeOf<Promise<string>>()
    expectTypeOf(apiClient.put<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.patch<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.head<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.options<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.postForm<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.putForm<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.patchForm<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
    expectTypeOf(apiClient.query<Invoice>).returns.toEqualTypeOf<Promise<Invoice>>()
  })

  it('keeps transport configuration but exposes only an unknown body to later response interceptors', () => {
    expectTypeOf(apiClient.defaults).toEqualTypeOf<AxiosInstance['defaults']>()
    expectTypeOf(apiClient.getUri).toEqualTypeOf<AxiosInstance['getUri']>()
    expectTypeOf(apiClient.interceptors.request).toEqualTypeOf<AxiosInstance['interceptors']['request']>()
    type OnBody = NonNullable<Parameters<typeof apiClient.interceptors.response.use>[0]>
    expectTypeOf<OnBody>().parameter(0).toBeUnknown()
  })
})
