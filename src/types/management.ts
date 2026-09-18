export interface NavigationNode {
  id: string
  parentId: string | null
  code: string
  type: 'MENU' | 'PAGE'
  displayName: string
  permissionCode: string | null
  routeKey: string
  routePath: string | null
  /** 数据库配置的自定义页面组件路径；绑定已注册资源的节点为空。 */
  componentPath?: string | null
  iconKey: string | null
  sortOrder: number
  visible: boolean
  keepAlive: boolean
  children: NavigationNode[]
}
