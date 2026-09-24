<template>
  <div
    class="console"
    :class="{ 'console--supply-chain': applicationCode === 'SUPPLY_CHAIN', 'console--collapsed': workspace.collapsed, 'console--home': route.path === '/supply-chain', 'console--dashboard': ['overview', 'city-operating', 'sales'].includes(String(route.meta.dashboardSection)) }"
  >
    <ConsoleSidebar :nodes="navigation" />

    <section class="console__main">
      <header class="topbar">
        <div ref="tabStrip" class="workspace-tabs" role="tablist" aria-label="已打开页面">
          <div
            v-for="tab in workspaceTabs"
            :key="tab.id"
            class="workspace-tab"
            :class="{ 'is-active': activeTabId === tab.id }"
            role="tab"
            :aria-selected="activeTabId === tab.id"
            :aria-current="activeTabId === tab.id ? 'page' : undefined"
            :title="tab.title"
            tabindex="0"
            @click="activateWorkspaceTab(tab)"
            @keydown.enter.prevent="activateWorkspaceTab(tab)"
            @keydown.space.prevent="activateWorkspaceTab(tab)"
          >
            <span class="workspace-tab__title">{{ tab.title }}</span>
            <button
              v-if="canCloseWorkspaceTab(tab)"
              class="workspace-tab__close"
              type="button"
              :aria-label="`关闭${tab.title}`"
              @click.stop="closeWorkspaceTab(tab)"
            >
              ×
            </button>
          </div>
        </div>
        <div class="topbar__right">
          <ConsoleEntrySearch :entries="entries" />
          <span class="tenant-pill"><OfficeBuilding />{{ tenantLabel }}</span>
          <ConsoleAccountMenu />
        </div>
      </header>
      <main ref="contentViewport" class="console__content">
        <template v-for="tab in workspaceTabs" :key="tab.id">
          <section
            v-if="workspaceTabErrors[tab.id]"
            v-show="activeTabId === tab.id"
            class="workspace-tab-pane workspace-tab-pane--error"
          >
            <strong>页面加载失败</strong>
            <span>{{ workspaceTabErrors[tab.id] }}</span>
          </section>
          <ConsoleTabPane
            v-else
            :active="activeTabId === tab.id"
            :route="tab.route"
          />
        </template>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { isPageRenderFailure } from '@/utils/page-error'
import { publishRequestFailure } from '@/utils/request-feedback'
/**
 * 供应链数字化平台主框架
 *
 * 职责：双层业务导航 + 顶栏 + 内容区的统一骨架。
 * 菜单数据由 navigationStore 按应用编码从 IAM 实时加载，
 * 菜单树由递归导航组件渲染，支持业务分组、二级菜单和三级页面。
 */
import { computed, nextTick, onErrorCaptured, onMounted, reactive, shallowReactive, shallowRef, ref, watch } from 'vue'
import {
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
  type RouteLocationNormalizedLoaded,
} from 'vue-router'
import { useAuthStore, useNavigationStore } from '@/stores'
import type { NavigationNode } from '@/types/management'
import ConsoleSidebar from '@/components/console/ConsoleSidebar.vue'
import ConsoleEntrySearch from '@/components/console/ConsoleEntrySearch.vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import ConsoleAccountMenu from '@/components/console/ConsoleAccountMenu.vue'
import { consoleEntries } from '@/utils/console-navigation'
import { useConsoleWorkspace } from '@/stores/console-workspace'
import ConsoleTabPane from '@/components/console/ConsoleTabPane.vue'
import { supplyPageName } from '@/utils/supply-page-title'

interface WorkspaceTab {
  id: string
  applicationCode: string
  path: string
  fullPath: string
  title: string
  route: RouteLocationNormalizedLoaded
  scrollTop: number
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const navigationStore = useNavigationStore()
const workspace = useConsoleWorkspace()
const entries = computed(() => consoleEntries(navigation.value))
watch(() => `${authStore.user?.tenantId || ''}:${authStore.user?.id || ''}`, key => workspace.setSession(key), { immediate: true })
const workspaceTabs = shallowRef<WorkspaceTab[]>([])
const workspaceTabErrors = reactive<Record<string, string>>({})
const tabStrip = ref<HTMLElement | null>(null)
const contentViewport = ref<HTMLElement | null>(null)

const applicationCode = computed(() => String(route.meta.applicationCode || ''))

const navigation = computed(() => navigationStore.getNavigation(applicationCode.value))
const tenantLabel = computed(() => authStore.user?.tenantName || '企业空间')

const currentPageName = computed(() => {
  return (applicationCode.value === 'SUPPLY_CHAIN'
    ? supplyPageName(navigation.value, route.path)
    : findCurrentPageName(navigation.value)) || (route.meta.title as string) || '工作台'
})

function findCurrentPageName(nodes: NavigationNode[]): string | undefined {
  for (const node of nodes) {
    if (!node.visible) continue
    if (node.routePath === route.path) return node.displayName
    const childName = findCurrentPageName(node.children)
    if (childName) return childName
  }
  return undefined
}

const activeTabId = computed(() => workspaceTabId(applicationCode.value, route.path))

function workspaceTabId(appCode: string, path: string) {
  return `${appCode}:${path}`
}

function applicationHomePath(appCode: string) {
  return {
    SUPPLY_CHAIN: '/supply-chain',
  }[appCode]
}

function cloneRoute(source: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
  return {
    fullPath: source.fullPath,
    path: source.path,
    query: { ...source.query },
    hash: source.hash,
    name: source.name,
    params: { ...source.params },
    matched: [...source.matched],
    redirectedFrom: source.redirectedFrom,
    meta: { ...source.meta },
  }
}

function upsertWorkspaceTab(currentRoute: RouteLocationNormalizedLoaded, pageTitle: string) {
  const appCode = String(currentRoute.meta.applicationCode || '')
  if (!currentRoute.path || !appCode) return

  if (workspaceTabs.value.some((tab) => tab.applicationCode !== appCode)) {
    workspaceTabs.value = []
    Object.keys(workspaceTabErrors).forEach((key) => {
      delete workspaceTabErrors[key]
    })
  }

  const id = workspaceTabId(appCode, currentRoute.path)
  const existing = workspaceTabs.value.find((tab) => tab.id === id)
  delete workspaceTabErrors[id]
  if (existing) {
    Object.assign(existing.route, cloneRoute(currentRoute))
    workspaceTabs.value = workspaceTabs.value.map((tab) => tab.id === id
      ? { ...tab, fullPath: currentRoute.fullPath, title: pageTitle }
      : tab)
  } else {
    workspaceTabs.value = [...workspaceTabs.value, {
      id,
      applicationCode: appCode,
      path: currentRoute.path,
      fullPath: currentRoute.fullPath,
      title: pageTitle,
      route: shallowReactive(cloneRoute(currentRoute)) as RouteLocationNormalizedLoaded,
      scrollTop: 0,
    }]
  }
  void nextTick(() => {
    scrollActiveTabIntoView()
    restoreActivePageScroll()
  })
}

async function activateWorkspaceTab(tab: WorkspaceTab) {
  if (route.fullPath !== tab.fullPath) await router.push(tab.fullPath)
}

async function closeWorkspaceTab(tab: WorkspaceTab) {
  const index = workspaceTabs.value.findIndex((item) => item.id === tab.id)
  if (index < 0) return

  if (activeTabId.value === tab.id) {
    const adjacentTab = workspaceTabs.value[index + 1] ?? workspaceTabs.value[index - 1]
    const fallbackPath = applicationHomePath(tab.applicationCode)
    if (adjacentTab) {
      await router.push(adjacentTab.fullPath)
    } else if (fallbackPath && fallbackPath !== tab.path) {
      await router.push(fallbackPath)
    } else {
      return
    }
  }
  workspaceTabs.value = workspaceTabs.value.filter((item) => item.id !== tab.id)
  delete workspaceTabErrors[tab.id]
}

function canCloseWorkspaceTab(tab: WorkspaceTab) {
  return workspaceTabs.value.length > 1
    || applicationHomePath(tab.applicationCode) !== tab.path
}

function scrollActiveTabIntoView() {
  const activeTab = tabStrip.value?.querySelector<HTMLElement>('.workspace-tab.is-active')
  activeTab?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

function savePageScroll(path: string, appCode: string) {
  const id = workspaceTabId(appCode, path)
  const scrollTop = contentViewport.value?.scrollTop ?? 0
  workspaceTabs.value = workspaceTabs.value.map((tab) => tab.id === id
    ? { ...tab, scrollTop }
    : tab)
}

function restoreActivePageScroll() {
  const activeTab = workspaceTabs.value.find((tab) => tab.id === activeTabId.value)
  if (activeTab && contentViewport.value) contentViewport.value.scrollTop = activeTab.scrollTop
}

onErrorCaptured((error, _instance, info) => {
  if (isPageRenderFailure(info)) workspaceTabErrors[activeTabId.value] = '页面暂时无法显示，请关闭后重新打开该菜单。'
  else publishRequestFailure(error)
  return false
})

watch(
  () => [route.fullPath, currentPageName.value] as const,
  ([, pageTitle]) => {
    upsertWorkspaceTab(route, pageTitle)
    if (entries.value.some(entry => entry.path === route.path)) workspace.visit(route.path)
    if (applicationCode.value === 'SUPPLY_CHAIN') document.title = `${pageTitle} - 供应链数字化平台`
  },
  { immediate: true },
)

watch(navigation, (nodes) => {
  if (applicationCode.value !== 'SUPPLY_CHAIN') return
  workspaceTabs.value = workspaceTabs.value.map(tab => ({
    ...tab, title: supplyPageName(nodes, tab.path) || String(tab.route.meta.title || '工作台'),
  }))
}, { deep: true })

onBeforeRouteUpdate((_to, from) => {
  savePageScroll(from.path, String(from.meta.applicationCode || ''))
})

onMounted(() => {
  if (applicationCode.value && !navigationStore.isLoaded(applicationCode.value)) {
    void navigationStore.fetchNavigation(applicationCode.value).catch(() => {})
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.console {
  display: grid;
  grid-template-columns: 296px minmax(0, 1fr);
  min-height: 100vh;
  background: $color-bg-base;
}

.console__main {
  min-width: 0;
}

.topbar {
  position: relative;
  display: flex;
  gap: $spacing-md;
  justify-content: space-between;
  align-items: center;
  height: $topbar-height;
  padding: 0 20px;
  background: $color-bg-white;
  border-bottom: 1px solid $color-border-base;

  &__right {
    display: flex;
    flex: 0 0 auto;
    gap: $spacing-md;
    align-items: center;
  }
}

.workspace-tabs {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1 1 auto;
  gap: 6px;
  align-items: center;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.workspace-tab {
  position: relative;
  display: flex;
  min-width: 104px;
  max-width: 220px;
  height: 38px;
  flex: 0 0 auto;
  gap: 7px;
  align-items: center;
  padding: 0 11px 0 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: $color-text-secondary;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition:
    color $transition-fast,
    border-color $transition-fast,
    background-color $transition-fast;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-muted;
  }

  &:focus-visible {
    border-color: rgba($color-primary, 0.42);
    box-shadow: 0 0 0 2px rgba($color-primary, 0.12);
  }

  &.is-active {
    border-color: rgba($color-primary, 0.16);
    color: $color-primary-dark;
    background: rgba($color-primary, 0.07);
    font-weight: 600;

    &::after {
      position: absolute;
      right: 12px;
      bottom: -1px;
      left: 12px;
      height: 2px;
      border-radius: 999px 999px 0 0;
      background: $color-primary;
      content: '';
    }
  }
}

.workspace-tab__title {
  overflow: hidden;
  min-width: 0;
  flex: 1 1 auto;
  font-size: $font-size-sm;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-tab__close {
  position: relative;
  z-index: 1;
  display: inline-grid;
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: $color-text-placeholder;
  background: transparent;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  place-items: center;

  &:hover,
  &:focus-visible {
    color: $color-text-primary;
    background: rgba(148, 163, 184, 0.2);
    outline: none;
  }
}

.tenant-pill {
  padding: 5px 12px;
  color: $color-text-regular;
  background: $color-bg-muted;
  border-radius: 999px;
  font-size: $font-size-sm;
}

.console__content {
  padding: 28px;
}

.workspace-tab-pane--error {
  display: grid;
  height: auto;
  min-height: 120px;
  gap: 8px;
  margin: 24px;
  padding: 16px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff7ed;
  color: #991b1b;
}

.workspace-tab-pane--error strong {
  font-size: 16px;
}

.workspace-tab-pane--error span {
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.console--collapsed { grid-template-columns: 76px minmax(0, 1fr); }
.console--supply-chain .topbar { height: 70px; flex-basis: 70px; padding: 0 28px; }
.console--home .topbar { justify-content: space-between; }
.console--home { background: #f3f8ff; }
.topbar__right svg { width: 18px; height: 18px; }
.tenant-pill { display: flex; gap: 8px; align-items: center; background: transparent; }
.console--home .console__content { padding: 24px; }
@media (max-width: 1100px) { .tenant-pill { display: none; } }
@media (max-width: 760px) {
  .console, .console--collapsed { grid-template-columns: 64px minmax(0, 1fr); }
  .console--supply-chain .topbar { padding: 0 10px; gap: 8px; }
  .topbar__right { gap: 8px; }
  .console--home .console__content { padding: 18px 14px; }
}
.console--dashboard { height: 100dvh; overflow: hidden; }
.console--dashboard .console__main { display: flex; flex-direction: column; min-height: 0; }
.console--dashboard .topbar { flex-shrink: 0; }
.console--dashboard .console__content { flex: 1; min-height: 0; padding: 0; overflow: hidden; }
</style>
