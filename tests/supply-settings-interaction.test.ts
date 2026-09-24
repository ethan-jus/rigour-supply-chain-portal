import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import { defineComponent, h } from 'vue'
import MenuView from '@/views/supply-chain/settings/MenuView.vue'
import SettingsHome from '@/views/supply-chain/settings/IndexView.vue'
import RoleView from '@/views/supply-chain/settings/RoleView.vue'
import FulfillmentView from '@/views/supply-chain/order/FulfillmentView.vue'
import {
  supplySettingsApi,
  supplyAccessApi,
  type SupplyMenuNode,
  type SupplyMenuCommand,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import * as orders from '@/api/core/order-sales'
const nav = vi.hoisted(() => ({
  invalidate: vi.fn(),
  getNavigation: vi.fn().mockReturnValue([]),
  fetchNavigation: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => nav }))
vi.mock('@/api/core/supply-settings', () => ({
  supplyAccessApi: { roles: vi.fn(), menus: vi.fn() },
  supplySettingsApi: {
    legacyRoles: vi.fn(),
    importLegacyRole: vi.fn(),
    context: vi.fn(),
    observations: vi.fn(),
    dataObservations: vi.fn(),
    menus: vi.fn(),
    catalog: vi.fn(),
    saveMenu: vi.fn(),
    menuImpact: vi.fn(),
    deleteMenu: vi.fn(),
  },
}))
vi.mock('@/api/core/order-sales', () => ({
  listFulfillmentQueue: vi.fn(),
  getFulfillmentQueueDetail: vi.fn(),
  executeOrderFulfillment: vi.fn(),
}))
// jsdom 不做下拉框定位，保留 v-model 选择契约；页面与表格仍挂载真实组件。
const SelectStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup:
    (p, { emit, slots }) =>
    () =>
      h(
        'select',
        {
          value: p.modelValue,
          onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
        },
        slots.default?.(),
      ),
})
const OptionStub = defineComponent({
  props: ['value', 'label'],
  setup: (p) => () => h('option', { value: p.value }, p.label),
})
let wrapper: VueWrapper
const node = (id: string, name: string, parentId: string | null = null): SupplyMenuNode => ({
  id,
  name,
  parentId,
  type: 'MENU',
  resourceId: null,
  iconKey: 'Folder',
  sortOrder: 10,
  visible: true,
  status: 'ACTIVE',
  protectedNode: false,
  version: 3,
  resourceCode: null,
  permissionCode: null,
  routeKey: null,
  routePath: null,
  componentPath: null,
})
let rows: SupplyMenuNode[]
const all = ['supply:menu:create', 'supply:menu:update', 'supply:menu:delete']
async function render(
  component: typeof MenuView | typeof FulfillmentView | typeof SettingsHome | typeof RoleView,
) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: {
        teleport: true,
        ConsoleNavIcon: true,
        RoleMembersDrawer: true,
        RouterLink: true,
        ElSelect: SelectStub,
        ElOption: OptionStub,
      },
    },
  })
  await flushPromises()
  return wrapper
}
const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
const item = (label: string) =>
  wrapper
    .findAll('.el-form-item')
    .find((x) => x.find('.el-form-item__label').text().includes(label))!
beforeEach(() => {
  vi.clearAllMocks()
  nav.getNavigation.mockReturnValue([])
  nav.fetchNavigation.mockResolvedValue(undefined)
  setActivePinia(createPinia())
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(
    'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
  )
  vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
  rows = [
    node('d1', '业务设置'),
    node('d2', '业务中心'),
    {
      ...node('p1', '订单', 'd1'),
      type: 'PAGE',
      resourceId: 'implemented-page',
      permissionCode: 'order:read',
      routeKey: 'supply.order.sales',
      routePath: '/supply-chain/order/sales',
    },
  ]
  vi.mocked(supplySettingsApi.context).mockResolvedValue({
    initialized: true,
    canInitialize: false,
    mode: 'ACTIVE',
    version: 3,
    permissions: all,
  })
  vi.mocked(supplySettingsApi.menus).mockImplementation(async () => rows)
  vi.mocked(supplySettingsApi.catalog).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
describe('供应链菜单实际交互', () => {
  it('只改已绑定目录的排序，保留类型和绑定资源', async () => {
    rows[0].resourceId = 'implemented-directory'
    await render(MenuView)
    const row = wrapper.findAll('.el-table__row').find((r) => r.text().includes('业务设置'))!
    await row
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    await item('显示排序').get('input').setValue('15')
    await button('确 定').trigger('click')
    await flushPromises()
    expect(supplySettingsApi.saveMenu).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        type: 'MENU',
        resourceId: 'implemented-directory',
        sortOrder: 15,
        parentId: null,
      }),
    )
  })
  it('菜单保存失败保留列表和表单，并在按钮旁显示原因', async () => {
    vi.mocked(supplySettingsApi.saveMenu).mockRejectedValueOnce({ message: '菜单已被修改，请刷新' })
    await render(MenuView)
    const row = wrapper.findAll('.el-table__row').find((r) => r.text().includes('业务设置'))!
    await row
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    await button('确 定').trigger('click')
    await flushPromises()
    expect(wrapper.get('.menu-save-error').text()).toContain('菜单已被修改，请刷新')
    expect(wrapper.findAll('.el-table__row').length).toBeGreaterThan(0)
    expect(item('菜单名称').get('input').element.value).toBe('业务设置')
  })
  it('重命名与移动后重新读取服务器菜单并刷新导航', async () => {
    vi.mocked(supplySettingsApi.saveMenu).mockImplementation(async (id, c) => {
      rows = rows.map((n) => (n.id === id ? { ...n, ...c, version: 4 } : n))
      return rows.find((n) => n.id === id)!
    })
    await render(MenuView)
    const row = wrapper.findAll('.el-table__row').find((r) => r.text().includes('订单'))!
    await row
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    await item('菜单名称').get('input').setValue('销售订单')
    await item('上级菜单').get('select').setValue('d2')
    await flushPromises()
    await button('确 定').trigger('click')
    await flushPromises()
    expect(supplySettingsApi.saveMenu).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        name: '销售订单',
        parentId: 'd2',
        resourceId: 'implemented-page',
        version: 3,
      } satisfies Partial<SupplyMenuCommand>),
    )
    expect(wrapper.text()).toContain('销售订单')
    expect(nav.invalidate).toHaveBeenCalledWith('SUPPLY_CHAIN')
    expect(nav.fetchNavigation).toHaveBeenCalledWith('SUPPLY_CHAIN')
  })
  it('有子项时阻止删除，叶节点使用影响预览版本撤销关联授权', async () => {
    vi.mocked(supplySettingsApi.menuImpact).mockImplementation(async (id) => ({
      id,
      version: 7,
      roleNames: ['销售', '城市总'],
      userCount: 3,
      childCount: id === 'd1' ? 1 : 0,
    }))
    vi.mocked(supplySettingsApi.deleteMenu).mockResolvedValue(undefined)
    await render(MenuView)
    let row = wrapper.findAll('.el-table__row').find((r) => r.text().includes('业务设置'))!
    await row
      .findAll('button')
      .find((b) => b.text() === '删除')!
      .trigger('click')
    await flushPromises()
    expect(supplySettingsApi.deleteMenu).not.toHaveBeenCalled()
    row = wrapper.findAll('.el-table__row').find((r) => r.text().includes('订单'))!
    await row
      .findAll('button')
      .find((b) => b.text() === '删除')!
      .trigger('click')
    await flushPromises()
    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('影响 3 名用户'),
      expect.any(String),
      expect.any(Object),
    )
    expect(supplySettingsApi.deleteMenu).toHaveBeenCalledWith('p1', 7, true)
  })
  it('只读用户没有菜单修改入口', async () => {
    vi.mocked(supplySettingsApi.context).mockResolvedValue({
      initialized: true,
      canInitialize: false,
      mode: 'ACTIVE',
      version: 3,
      permissions: ['supply:menu:read'],
    })
    await render(MenuView)
    expect(wrapper.findAll('button').map((b) => b.text())).not.toEqual(
      expect.arrayContaining(['新增菜单']),
    )
    expect(wrapper.text()).not.toContain('增加子项')
  })
})
describe('仓管订单出库交互', () => {
  const order = {
    orderId: '9',
    orderNo: 'SO-9',
    warehouseId: '100',
    warehouseName: '杭州仓',
    outboundStatus: 'PENDING',
    revision: 4,
  }
  const data = () => ({
    order: { ...order },
    lines: [
      {
        productCode: 'P1',
        skuCode: 'SKU1',
        productName: '测试商品',
        unitCode: 'PIECE',
        quantity: 2,
      },
    ],
    execution: {
      orderId: '9',
      orderRevision: 4,
      warehouseId: '100',
      executionId: null,
      status: 'NOT_STARTED' as const,
      stockOutId: null,
      stockOutNo: null,
      stockOutTime: null,
      lastError: null,
    },
  })
  async function open() {
    await render(FulfillmentView)
    await button('查看商品与出库').trigger('click')
    await flushPromises()
  }
  beforeEach(() => {
    vi.mocked(orders.listFulfillmentQueue).mockResolvedValue({
      items: [order],
      total: 1,
      begin: 0,
      step: 20,
    })
    vi.mocked(orders.getFulfillmentQueueDetail).mockResolvedValue(data())
  })
  it('只读仓管可查看商品但不能执行出库', async () => {
    await open()
    expect(wrapper.text()).toContain('测试商品')
    expect(button('确认出库 / 核对结果')).toBeUndefined()
    expect(orders.executeOrderFulfillment).not.toHaveBeenCalled()
  })
  it('执行只使用原订单选仓与版本，成功后重新核对后端结果', async () => {
    await open()
    useSupplyAuthorizationStore().context = {
      initialized: true,
      canInitialize: false,
      mode: 'ACTIVE',
      version: 1,
      permissions: ['order:outbound:confirm'],
    }
    await flushPromises()
    const confirmed = data()
    confirmed.order.outboundStatus = 'CONFIRMED'
    vi.mocked(orders.executeOrderFulfillment).mockImplementation(async () => {
      vi.mocked(orders.getFulfillmentQueueDetail).mockResolvedValue(confirmed)
      return confirmed.execution
    })
    await button('确认出库 / 核对结果').trigger('click')
    await flushPromises()
    expect(orders.executeOrderFulfillment).toHaveBeenCalledWith('9', {
      warehouseId: '100',
      revision: 4,
    })
    expect(orders.getFulfillmentQueueDetail).toHaveBeenCalledTimes(2)
    expect(button('确认出库 / 核对结果')).toBeUndefined()
  })
})

it('系统设置只有配置入口，不再提供授权准备和启用流程', async () => {
  vi.mocked(supplySettingsApi.context).mockResolvedValue({
    initialized: true,
    canInitialize: false,
    mode: 'ACTIVE',
    version: 3,
    permissions: ['supply:role:grant'],
  })
  await render(SettingsHome)
  expect(wrapper.text()).toContain('权限配置保存后立即生效')
  expect(wrapper.text()).not.toContain('检查并启用')
  expect(wrapper.text()).not.toContain('数据权限对比')
})

it('内置管理员显示动态全部权限说明，不用旧授权勾选快照误导用户', async () => {
  vi.mocked(supplySettingsApi.context).mockResolvedValue({
    initialized: true,
    canInitialize: false,
    mode: 'ACTIVE',
    version: 4,
    permissions: ['supply:role:read', 'supply:role:update', 'supply:role:grant'],
  })
  vi.mocked(supplyAccessApi.roles).mockResolvedValue([
    {
      id: 'builtin',
      code: 'SUPPLY_BOOTSTRAP_ADMIN',
      name: '管理员',
      description: null,
      status: 'ACTIVE',
      protectedRole: true,
      version: 0,
      userCount: 1,
      menuNodeIds: [],
      rules: [],
    },
  ])
  vi.mocked(supplyAccessApi.menus).mockResolvedValue(rows)
  await render(RoleView)
  await useSupplyAuthorizationStore().refresh()
  await flushPromises()
  await button('查看').trigger('click')
  await flushPromises()
  const drawer = wrapper.get('.el-drawer')
  expect(drawer.text()).toContain('自动拥有本企业全部已启用功能与业务数据权限')
  expect(drawer.text()).toContain('可使用全部菜单、按钮和当前企业的全部数据')
  expect(drawer.find('.el-tree').exists()).toBe(false)
  expect(drawer.text()).not.toContain('保存角色及授权')
})
