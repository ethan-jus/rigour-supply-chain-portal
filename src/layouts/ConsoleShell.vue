<template>
  <div
    class="console"
    :class="{ 'console--supply-chain': applicationCode === 'SUPPLY_CHAIN' }"
  >
    <aside class="sidebar">
      <router-link class="sidebar__brand" to="/apps">
        <img src="@/assets/brand/ruigai-logo.png" alt="瑞盖优选">
        <span class="sidebar__brand-copy">
          <strong>瑞盖优选</strong>
          <small>{{ title }}</small>
        </span>
      </router-link>

      <nav class="sidebar__nav" aria-label="应用菜单">
        <ConsoleNavTree :nodes="navigation" />
      </nav>

      <div class="sidebar__footer">
        <router-link class="back-portal" to="/apps">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          返回门户
        </router-link>
      </div>
    </aside>

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
          <span class="tenant-pill">{{ tenantLabel }}</span>
          <div class="account">
            <span class="account__avatar">{{ authStore.user?.displayName?.slice(0, 1) || '用' }}</span>
            <span class="account__name">{{ authStore.user?.displayName || '当前用户' }}</span>
            <el-button class="logout" text @click="logout">退出</el-button>
          </div>
        </div>
      </header>
      <main ref="contentViewport" class="console__content">
        <ConsoleTabPane
          v-for="tab in workspaceTabs"
          :key="tab.id"
          :active="activeTabId === tab.id"
          :route="tab.route"
        />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 后台主框架（平台管理中心 / 系统管理 / 供应链系统共用）
 *
 * 职责：深色分组侧栏 + 顶栏 + 内容区的统一骨架。
 * 菜单数据由 navigationStore 按应用编码从 IAM 实时加载，
 * 菜单树由递归导航组件渲染，支持业务分组、二级菜单和三级页面。
 */
import { computed, nextTick, onMounted, shallowReactive, shallowRef, ref, watch } from 'vue'
import {
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
  type RouteLocationNormalizedLoaded,
} from 'vue-router'
import { useAuthStore, useNavigationStore } from '@/stores'
import type { NavigationNode } from '@/types/management'
import ConsoleNavTree from '@/components/console/ConsoleNavTree.vue'
import ConsoleTabPane from '@/components/console/ConsoleTabPane.vue'

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
const workspaceTabs = shallowRef<WorkspaceTab[]>([])
const tabStrip = ref<HTMLElement | null>(null)
const contentViewport = ref<HTMLElement | null>(null)

const applicationCode = computed(() => String(route.meta.applicationCode || ''))
const title = computed(() => ({
  PLATFORM_ADMIN: '平台管理中心',
  SYSTEM_ADMIN: '系统管理',
  SUPPLY_CHAIN: '供应链系统',
}[applicationCode.value] || '工作台'))

const navigation = computed(() => navigationStore.getNavigation(applicationCode.value))
const tenantLabel = computed(() => authStore.user?.principalScope === 'PLATFORM'
  ? '瑞盖优选 · 平台'
  : authStore.user?.tenantName || '企业空间')

const currentPageName = computed(() => {
  return findCurrentPageName(navigation.value) || (route.meta.title as string) || '工作台'
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
    PLATFORM_ADMIN: '/platform-admin',
    SYSTEM_ADMIN: '/system-admin',
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
  }

  const id = workspaceTabId(appCode, currentRoute.path)
  const existing = workspaceTabs.value.find((tab) => tab.id === id)
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

function logout(): void {
  authStore.logout()
}

watch(
  () => [route.fullPath, currentPageName.value] as const,
  ([, pageTitle]) => upsertWorkspaceTab(route, pageTitle),
  { immediate: true },
)

onBeforeRouteUpdate((_to, from) => {
  savePageScroll(from.path, String(from.meta.applicationCode || ''))
})

onMounted(() => {
  if (applicationCode.value && !navigationStore.isLoaded(applicationCode.value)) {
    void navigationStore.fetchNavigation(applicationCode.value)
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.console {
  display: grid;
  grid-template-columns: $sidebar-width 1fr;
  min-height: 100vh;
  background: $color-bg-base;
}

.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $color-ink;
  border-right: 1px solid rgba(148, 163, 184, 0.1);

  &__brand {
    display: flex;
    gap: 10px;
    align-items: center;
    height: 72px;
    padding: 0 18px;
    color: #fff;
    text-decoration: none;

    img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }

    strong {
      font-size: $font-size-md;
      font-weight: 650;
      letter-spacing: 0.01em;
    }
  }

  &__brand-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    small {
      color: $color-ink-text-faint;
      font-size: 11px;
      font-weight: 500;
    }
  }

  &__nav {
    flex: 1;
    padding: 12px 12px 20px;
    overflow-y: auto;
    scrollbar-color: rgba(148, 163, 184, 0.24) transparent;
    scrollbar-width: thin;
  }

  &__footer {
    padding: 12px;
    border-top: 1px solid $color-ink-divider;
  }
}

.back-portal {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  color: $color-ink-text-faint;
  font-size: $font-size-sm;
  text-decoration: none;
  border-radius: $border-radius-base;

  &:hover {
    color: $color-ink-text;
    background: $color-ink-hover;
  }
}

.console__main {
  min-width: 0;
}

.topbar {
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

.account {
  display: flex;
  gap: 8px;
  align-items: center;

  &__avatar {
    display: grid;
    width: 30px;
    height: 30px;
    color: $color-primary;
    background: #eff6ff;
    border-radius: 50%;
    font-size: $font-size-sm;
    font-weight: 600;
    place-items: center;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: 500;
  }
}

.logout {
  color: $color-text-secondary;
}

.console__content {
  padding: 28px;
}

@media (max-width: 900px) {
  .console {
    grid-template-columns: 64px 1fr;
  }

  .sidebar__brand {
    justify-content: center;
    padding: 0;

    .sidebar__brand-copy {
      display: none;
    }
  }

  .sidebar__nav {
    padding: 8px;
  }

  :deep(.nav-branch__text),
  :deep(.nav-item span),
  .back-portal {
    display: none;
  }

  :deep(.nav-item),
  :deep(.nav-branch) {
    justify-content: center;
    padding: 0;
  }

  .topbar {
    padding: 0 16px;
  }

  .tenant-pill,
  .account__name {
    display: none;
  }

  .console__content {
    padding: 20px 16px;
  }
}
</style>
