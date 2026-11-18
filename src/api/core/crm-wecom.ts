import { apiClient } from './client'
import type { StoreContact } from './crm-store-contacts'
export interface WecomSummary {
  dataStatus: 'NOT_CONNECTED' | 'READY' | 'PARTIAL' | 'STALE'
  syncedAt: string | null
  activeContacts: number | null
  linkedContacts: number | null
  pendingContacts: number | null
  coveredStores: number | null
  newContacts: number | null
}
export interface WecomPerson {
  id: string
  contactId: string | null
  name: string
  linked: boolean
  stores: { id: string; name: string; role: string }[]
  relations: StoreContact['wecomRelations']
}
export const crmWecomApi = {
  storeSummary: (store: string, view: string) => apiClient.get<{ contacts: number; phoneContacts: number; wecomContacts: number | null; dataStatus: string }>(`/crm/wecom/stores/${encodeURIComponent(store)}/summary`, { params: { view }, stayOnUnauthorized: true }),
  summary: (view: 'MINE' | 'ALL') => apiClient.get<WecomSummary>('/crm/wecom/summary', { params: { view }, stayOnUnauthorized: true }),
  list: (view: 'MINE' | 'ALL', pending: boolean, cursor?: string) => apiClient.get<{ total: number; items: WecomPerson[]; nextCursor: string | null }>('/crm/wecom/contacts', { params: { view, pending, cursor, size: 20 }, stayOnUnauthorized: true }),
}
