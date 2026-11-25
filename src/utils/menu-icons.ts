import { h, type Component } from 'vue'
import menuSprite from '@/assets/icons/menu-lucide.svg?no-inline'
import {
  House, Setting, Menu, Document, List, User, UserFilled, Avatar, Lock, Key,
  OfficeBuilding, Folder, FolderOpened, Shop, Goods, Box, Van, Location,
  TrendCharts, DataAnalysis, Calendar, Wallet, CreditCard, Tickets,
  Connection, Tools, Monitor, Bell, Search, Operation,
} from '@element-plus/icons-vue'

function outlineIcon(path: string): Component {
  return () => h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.65,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, [h('path', { d: path })])
}

function lucideIcon(name: string): Component {
  return () => h('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }, [h('use', { href: menuSprite + '#' + name })])
}

/** 选择、预览、导航共用的内置图标清单，数据库只保存稳定 key。 */
export const MENU_ICONS: { key: string; label: string; component: Component }[] = [
  ['House', '首页', House], ['Setting', '设置', Setting], ['Menu', '菜单', Menu],
  ['Document', '文档', Document], ['List', '列表', List], ['User', '用户', User],
  ['UserFilled', '员工', UserFilled], ['Avatar', '角色', Avatar], ['Lock', '权限', Lock],
  ['Key', '密钥', Key], ['OfficeBuilding', '部门', OfficeBuilding],
  ['Folder', '目录', Folder], ['FolderOpened', '打开目录', FolderOpened],
  ['Shop', '客户', Shop], ['Goods', '商品', Goods], ['Box', '仓库', Box],
  ['Van', '配送', Van], ['Location', '地区', Location], ['TrendCharts', '趋势', TrendCharts],
  ['DataAnalysis', '数据分析', DataAnalysis], ['Calendar', '日历', Calendar],
  ['Wallet', '资金', Wallet], ['CreditCard', '收款', CreditCard], ['Tickets', '单据', Tickets],
  ['Connection', '集成', Connection], ['Tools', '工具', Tools], ['Monitor', '系统', Monitor],
  ['Bell', '通知', Bell], ['Search', '查询', Search], ['Operation', '操作', Operation],
  ['Route', '路线', outlineIcon('M5 6a2 2 0 1 1 0 .1 M19 18a2 2 0 1 1 0 .1 M7 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7')],
  ['TrendLine', '折线趋势', outlineIcon('M3 20V5 M4 16l5-5 4 3 7-8 M16 6h4v4')],
  ['Storefront', '门店', outlineIcon('M3 10l2-6h14l2 6 M4 11v9h16v-9 M8 20v-6h5v6 M3 10c1 3 4 3 6 0 2 3 4 3 6 0 2 3 4 3 6 0')],
  ['ShieldAlert', '风险盾牌', outlineIcon('M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z M12 8v5 M12 16h.01')],
  ['CalendarOutline', '日程', outlineIcon('M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16 M8 15h3')],
  ['FileText', '记录文档', outlineIcon('M5 3h11l3 3v15H5z M14 3v5h5 M8 12h8 M8 16h6')],
  ['Inbox', '收件箱', outlineIcon('M3 12l4-7h10l4 7v7H3z M3 12h5l2 3h4l2-3h5')],
  ['Sliders', '滑杆', outlineIcon('M3 6h7m4 0h7 M3 12h11m4 0h3 M3 18h3m4 0h11 M10 4v4m4 2v4M7 16v4')],
  ['Target', '目标', outlineIcon('M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l8-8m-4 0h4v4')],
  ['Receipt', '凭单', outlineIcon('M5 3l3 1 4-1 4 1 3-1v18l-3-1-4 1-4-1-3 1z M8 8h8 M8 12h8 M8 16h4')],
  ['LucideHouse', '首页线框', lucideIcon('House')],
  ['LucideChartNoAxesCombined', 'BI线框', lucideIcon('ChartNoAxesCombined')],
  ['LucideBriefcaseBusiness', '订单线框', lucideIcon('BriefcaseBusiness')],
  ['LucideUsersRound', 'HR线框', lucideIcon('UsersRound')],
  ['LucideBoxes', 'ERP线框', lucideIcon('Boxes')],
  ['LucideContactRound', 'CRM线框', lucideIcon('ContactRound')],
  ['LucideBookOpen', '成本线框', lucideIcon('BookOpen')],
  ['LucideMapPinned', '销售线框', lucideIcon('MapPinned')],
].map(([key, label, component]) => ({ key: key as string, label: label as string, component: component as Component }))
const byKey = new Map(MENU_ICONS.map(item => [item.key, item.component]))
export function builtinMenuIcon(key: string | null): Component | undefined { return byKey.get(key || '') }
