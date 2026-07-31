export type ApplicationLaunchMode =
  | 'INTERNAL_ROUTE'
  | 'OIDC_CLIENT'
  | 'EXTERNAL_URL'
  | 'FEISHU_DEEPLINK'
  | 'SSO_PROVIDER'

export interface PortalApplication {
  id: string
  code: string
  name: string
  iconKey: string | null
  launchMode: ApplicationLaunchMode
  targetUri: string | null
  sortOrder: number
}
