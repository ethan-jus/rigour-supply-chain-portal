import { apiClient } from './client'

export interface ContactMethod {
  id: string
  type: 'PHONE' | 'WECHAT_HINT'
  value: string
  status: 'PENDING' | 'VERIFIED' | 'INVALID'
  verificationMethod: string | null
  verifiedAt: string | null
  verifiedBy: string | null
  revision: number
}
export interface StoreContact {
  id: string
  name: string
  role: string
  primary: boolean
  status: 'ACTIVE' | 'LEFT'
  revision: number
  personRevision: number
  methods: ContactMethod[]
  wecomRelations: {
    identityScope: string
    externalUserId: string
    employeeId: string
    status: string
    addedAt: string
  }[]
}
export type ContactView = 'MINE' | 'TEAM' | 'ALL'
const path = (store: string) => `/crm/stores/${encodeURIComponent(store)}/contacts`
const options = (view: ContactView) => ({ stayOnUnauthorized: true, params: { view } })
export const crmStoreContactsApi = {
  list: (store: string, view: ContactView) =>
    apiClient.get<StoreContact[]>(path(store), options(view)),
  create: (store: string, view: ContactView, command: object) =>
    apiClient.post<StoreContact>(path(store), command, options(view)),
  update: (store: string, view: ContactView, contact: string, command: object) =>
    apiClient.put<StoreContact>(
      `${path(store)}/${encodeURIComponent(contact)}`,
      command,
      options(view),
    ),
  link: (store: string, view: ContactView, command: object) =>
    apiClient.post<StoreContact>(`${path(store)}/link`, command, options(view)),
  addMethod: (store: string, view: ContactView, contact: string, command: object) =>
    apiClient.post<StoreContact>(
      `${path(store)}/${encodeURIComponent(contact)}/methods`,
      command,
      options(view),
    ),
  verify: (store: string, view: ContactView, contact: string, method: string, command: object) =>
    apiClient.put<StoreContact>(
      `${path(store)}/${encodeURIComponent(contact)}/methods/${encodeURIComponent(method)}/verification`,
      command,
      options(view),
    ),
  changes: (store: string, view: ContactView, contact: string) =>
    apiClient.get<
      { id: string; operation: string; actorUserId: string; reason: string; occurredAt: string }[]
    >(`${path(store)}/${encodeURIComponent(contact)}/changes`, options(view)),
}
