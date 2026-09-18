import type { Component } from 'vue'
import {
  House, Setting, Menu, Document, List, User, UserFilled, Avatar, Lock, Key,
  OfficeBuilding, Folder, FolderOpened, Shop, Goods, Box, Van, Location,
  TrendCharts, DataAnalysis, Calendar, Wallet, CreditCard, Tickets,
  Connection, Tools, Monitor, Bell, Search, Operation,
} from '@element-plus/icons-vue'

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
].map(([key, label, component]) => ({ key: key as string, label: label as string, component: component as Component }))
const byKey = new Map(MENU_ICONS.map(item => [item.key, item.component]))
export function builtinMenuIcon(key: string | null): Component | undefined { return byKey.get(key || '') }
