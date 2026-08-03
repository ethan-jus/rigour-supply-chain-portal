<template>
  <div class="console">
    <aside class="sidebar">
      <router-link class="sidebar__brand" to="/apps">
        <img src="@/assets/brand/ruigai-logo.png" alt="瑞盖优选">
        <strong>瑞盖优选</strong>
      </router-link>

      <nav class="sidebar__nav" aria-label="应用菜单">
        <template v-for="node in navigation" :key="node.id">
          <!-- 有子节点的顶级节点渲染为分组 -->
          <div v-if="node.visible && visibleChildren(node).length && !node.routePath" class="nav-group">
            <p class="nav-group__label">{{ node.displayName }}</p>
            <router-link v-for="child in visibleChildren(node)" :key="child.id"
              class="nav-item" :class="{ 'nav-item--active': isActive(child) }"
              :to="child.routePath || ''">
              <ConsoleNavIcon :icon-key="child.iconKey" />
              <span>{{ child.displayName }}</span>
            </router-link>
          </div>
          <!-- 无子节点的顶级节点渲染为独立菜单项 -->
          <router-link v-else-if="node.visible && node.routePath" class="nav-item"
            :class="{ 'nav-item--active': isActive(node) }" :to="node.routePath">
            <ConsoleNavIcon :icon-key="node.iconKey" />
            <span>{{ node.displayName }}</span>
          </router-link>
        </template>
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
        <nav class="breadcrumb" aria-label="面包屑">
          <span>{{ title }}</span>
          <i aria-hidden="true">/</i>
          <strong>{{ currentPageName }}</strong>
        </nav>
        <div class="topbar__right">
          <span class="tenant-pill">{{ tenantLabel }}</span>
          <div class="account">
            <span class="account__avatar">{{ authStore.user?.displayName?.slice(0, 1) || '用' }}</span>
            <span class="account__name">{{ authStore.user?.displayName || '当前用户' }}</span>
            <el-button class="logout" text @click="logout">退出</el-button>
          </div>
        </div>
      </header>
      <main class="console__content"><router-view /></main>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 后台主框架（平台管理中心 / 系统管理 / 供应链系统共用）
 *
 * 职责：深色分组侧栏 + 顶栏 + 内容区的统一骨架。
 * 菜单数据由 navigationStore 按应用编码从 IAM 实时加载，
 * 顶级节点有子菜单时渲染为分组标签，否则渲染为独立菜单项。
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useNavigationStore } from '@/stores'
import type { NavigationNode } from '@/types/management'
import ConsoleNavIcon from '@/components/console/ConsoleNavIcon.vue'

const route = useRoute()
const authStore = useAuthStore()
const navigationStore = useNavigationStore()

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
  const path = route.path
  for (const node of navigation.value) {
    if (node.routePath === path) return node.displayName
    const child = node.children.find((item) => item.routePath === path)
    if (child) return child.displayName
  }
  return (route.meta.title as string) || '工作台'
})

function visibleChildren(node: NavigationNode): NavigationNode[] {
  return node.children.filter((child) => child.visible)
}

function isActive(node: NavigationNode): boolean {
  return node.routePath === route.path
}

function logout(): void {
  authStore.logout()
}

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

  &__brand {
    display: flex;
    gap: 10px;
    align-items: center;
    height: $topbar-height;
    padding: 0 20px;
    color: #fff;
    text-decoration: none;

    img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }

    strong {
      font-size: $font-size-md;
      font-weight: 600;
    }
  }

  &__nav {
    flex: 1;
    padding: 8px 12px;
    overflow-y: auto;
  }

  &__footer {
    padding: 12px;
    border-top: 1px solid $color-ink-divider;
  }
}

.nav-group {
  margin-top: 18px;

  &:first-child {
    margin-top: 4px;
  }

  &__label {
    margin: 0 0 6px;
    padding: 0 10px;
    color: $color-ink-text-faint;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
  }
}

.nav-item {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  height: 38px;
  margin: 2px 0;
  padding: 0 10px;
  color: $color-ink-text-muted;
  font-size: $font-size-base;
  text-decoration: none;
  border-radius: $border-radius-base;
  transition: background $transition-fast, color $transition-fast;

  &:hover {
    color: $color-ink-text;
    background: $color-ink-hover;
  }

  &--active {
    color: #fff;
    background: $color-ink-hover;

    &::before {
      position: absolute;
      top: 8px;
      bottom: 8px;
      left: -12px;
      width: 3px;
      background: $color-primary;
      border-radius: 0 2px 2px 0;
      content: '';
    }
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
  justify-content: space-between;
  align-items: center;
  height: $topbar-height;
  padding: 0 28px;
  background: $color-bg-white;
  border-bottom: 1px solid $color-border-base;

  &__right {
    display: flex;
    gap: $spacing-md;
    align-items: center;
  }
}

.breadcrumb {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: $font-size-sm;
  color: $color-text-secondary;

  i {
    font-style: normal;
    color: $color-text-placeholder;
  }

  strong {
    color: $color-text-primary;
    font-weight: 500;
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

    strong,
    img + strong {
      display: none;
    }
  }

  .sidebar__nav {
    padding: 8px;
  }

  .nav-group__label,
  .nav-item span,
  .back-portal {
    display: none;
  }

  .nav-item {
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
