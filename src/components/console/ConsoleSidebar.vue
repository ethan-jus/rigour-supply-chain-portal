<template>
  <aside class="console-navigation" :class="{ 'is-collapsed': workspace.collapsed }">
    <nav class="module-rail" aria-label="业务模块">
      <router-link
        v-if="home"
        class="module-rail__logo"
        :to="home.routePath!"
        aria-label="供应链工作首页"
        ><img src="@/assets/brand/scdp-logo.png" alt="供应链数字化平台"
      /></router-link>
      <div v-else class="module-rail__logo">
        <img src="@/assets/brand/scdp-logo.png" alt="供应链数字化平台" />
      </div>
      <div class="module-rail__items">
        <template v-for="node in roots" :key="node.id">
          <button
            v-if="node.children.some((child) => child.visible)"
            class="module-link"
            :class="{
              'is-active': selected?.id === node.id,
              'module-link--utility': isUtility(node),
            }"
            type="button"
            :title="node.displayName"
            :aria-label="node.displayName"
            :aria-pressed="selected?.id === node.id"
            @click="selectModule(node)"
          >
            <ConsoleNavIcon :icon-key="node.iconKey" /><span>{{ shortName(node) }}</span>
          </button>
          <router-link
            v-else-if="node.routePath"
            class="module-link nav-item"
            :class="{
              'is-active': node.routePath === route.path,
              'module-link--utility': isUtility(node),
            }"
            :to="node.routePath"
            :title="node.displayName"
            @click="selectModule(node)"
          >
            <ConsoleNavIcon :icon-key="node.iconKey" /><span>{{ shortName(node) }}</span>
          </router-link>
        </template>
      </div>
      <button
        v-if="workspace.collapsed"
        class="module-rail__expand"
        type="button"
        aria-label="展开二级菜单"
        aria-controls="console-secondary-nav"
        aria-expanded="false"
        title="展开二级菜单"
        @click="workspace.collapsed = false"
      >
        <Expand />
      </button>
    </nav>
    <section v-show="!workspace.collapsed" id="console-secondary-nav" class="secondary-nav">
      <div class="secondary-nav__brand">供应链数字化平台</div>
      <header class="secondary-nav__heading">
        <strong>{{ isHome ? '工作空间' : selected?.displayName || '应用菜单' }}</strong
        ><button
          type="button"
          aria-label="收起二级菜单"
          title="收起二级菜单"
          aria-controls="console-secondary-nav"
          :aria-expanded="!workspace.collapsed"
          @click="workspace.collapsed = true"
        >
          <Fold />
        </button>
      </header>
      <div class="secondary-nav__body">
        <template v-if="isHome">
          <router-link v-if="home" :to="home.routePath!" class="secondary-link is-active"
            ><ConsoleNavIcon icon-key="House" /><span>工作首页</span></router-link
          >
          <section v-if="shortcuts.length" class="secondary-group">
            <h2>常用业务</h2>
            <router-link
              v-for="entry in shortcuts"
              :key="entry.path"
              class="secondary-link"
              :to="entry.path"
              ><ConsoleNavIcon :icon-key="entry.iconKey" /><span>{{
                entry.name
              }}</span></router-link
            >
          </section>
          <section v-if="analysis.length" class="secondary-group">
            <h2>数据看板</h2>
            <router-link
              v-for="entry in analysis"
              :key="entry.path"
              class="secondary-link"
              :to="entry.path"
              ><ConsoleNavIcon :icon-key="entry.iconKey" /><span>{{
                entry.name
              }}</span></router-link
            >
          </section>
          <section v-if="recent.length" class="secondary-group secondary-group--recent">
            <h2>最近访问</h2>
            <router-link
              v-for="entry in recent"
              :key="entry.path"
              class="secondary-link"
              :to="entry.path"
              ><ConsoleNavIcon :icon-key="entry.iconKey" /><span>{{
                entry.name
              }}</span></router-link
            >
          </section>
        </template>
        <ConsoleNavTree v-else :nodes="secondaryNodes" />
        <p v-if="!roots.length" class="secondary-nav__empty">暂无可用菜单</p>
      </div>
    </section>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Fold, Expand } from '@element-plus/icons-vue'
import type { NavigationNode } from '@/types/management'
import {
  consoleEntries,
  homeAnalysisPaths,
  homeShortcutPaths,
  selectEntries,
} from '@/utils/console-navigation'
import { useConsoleWorkspace } from '@/stores/console-workspace'
import ConsoleNavTree from './ConsoleNavTree.vue'
import ConsoleNavIcon from './ConsoleNavIcon.vue'
const props = defineProps<{ nodes: NavigationNode[] }>()
const route = useRoute()
const workspace = useConsoleWorkspace()
const selectedId = ref('')
const roots = computed(() =>
  props.nodes.filter(
    (node) => node.visible && (node.routePath || consoleEntries(node.children).length),
  ),
)
const entries = computed(() => consoleEntries(props.nodes))
const home = computed(() =>
  props.nodes.find((node) => node.visible && node.routePath === '/supply-chain'),
)
const selected = computed(() => roots.value.find((node) => node.id === selectedId.value))
const isHome = computed(() => selected.value?.routePath === '/supply-chain')
const secondaryNodes = computed(() =>
  selected.value?.children.length
    ? selected.value.children
    : roots.value.filter((node) => node.routePath !== '/supply-chain'),
)
const shortcuts = computed(() => selectEntries(entries.value, homeShortcutPaths))
const analysis = computed(() => selectEntries(entries.value, homeAnalysisPaths))
const recent = computed(() =>
  selectEntries(
    entries.value,
    workspace.recent.map((item) => item.path),
  ).slice(0, 3),
)
function isUtility(node: NavigationNode) {
  return /supply\.(integration|setting)\./.test(node.routeKey)
}
function shortName(node: NavigationNode) {
  const domain = node.routeKey.split('.')[1]
  return (
    (
      {
        dashboard: '首页',
        bi: '看板',
        order: '订单',
        crm: '客户',
        erp: 'ERP',
        sales: '销售',
        hr: '人事',
        integration: '同步',
        setting: '设置',
      } as Record<string, string>
    )[domain] || node.displayName
  )
}
function selectModule(node: NavigationNode) {
  selectedId.value = node.id
  workspace.collapsed = false
}
watch(
  [() => route.path, roots],
  () => {
    const active = roots.value.find(
      (node) =>
        node.routePath === route.path ||
        consoleEntries(node.children).some((entry) => entry.path === route.path),
    )
    selectedId.value = active?.id || roots.value[0]?.id || ''
  },
  { immediate: true },
)
watch(() => route.path, () => {
  if (window.matchMedia?.('(max-width: 760px)').matches) workspace.collapsed = true
})
</script>
<style scoped lang="scss">
.console-navigation {
  display: grid;
  grid-template-columns: 76px 220px;
  min-height: 0;
  height: 100dvh;
}
.console-navigation.is-collapsed {
  grid-template-columns: 76px;
}
.module-rail {
  background: #152a40;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: #e7edf7;
}
.module-rail__logo {
  display: grid;
  place-items: center;
  height: 70px;
  flex-shrink: 0;
}
.module-rail__logo img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}
.module-rail__items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 18px 0 12px;
}
.module-link {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  min-height: 70px;
  padding: 10px 5px;
  flex-shrink: 0;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  text-decoration: none;
  background: transparent;
  color: #edf3fc;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
}
.module-link :deep(.nav-icon) {
  width: 23px;
  height: 23px;
}
.module-link:hover {
  background: #213e5b;
}
.module-link.is-active {
  border-left-color: #2d81ff;
  background: #214e87;
  color: white;
}
.module-link--utility {
  margin-top: auto;
}
.module-link--utility ~ .module-link--utility {
  margin-top: 0;
}
.module-rail__expand {
  display: grid;
  place-items: center;
  padding: 14px;
  border: 0;
  background: transparent;
  color: white;
  cursor: pointer;
}
.module-rail__expand svg {
  width: 22px;
  height: 22px;
}
.secondary-nav {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #d5e1f1;
  border-right: 1px solid #becde1;
  color: #273d5b;
}
.secondary-nav__brand {
  height: 70px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 20px;
  letter-spacing: -0.4px;
  font-weight: 700;
  white-space: nowrap;
  color: #10213e;
}
.secondary-nav__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 23px 19px 15px;
  gap: 6px;
  font-size: 14px;
}
.secondary-nav__heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.secondary-nav__heading button {
  display: flex;
  flex-shrink: 0;
  border: 0;
  padding: 5px;
  background: none;
  color: #395472;
  border-radius: 4px;
  cursor: pointer;
}
.secondary-nav__heading button:hover {
  background: #c3d5ed;
}
.secondary-nav__heading svg {
  width: 18px;
  height: 18px;
}
.secondary-nav__body {
  padding: 0 12px 20px;
  flex: 1;
  overflow: auto;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
}
.secondary-link {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 44px;
  padding: 10px 14px;
  border-left: 3px solid transparent;
  border-radius: 6px;
  text-decoration: none;
  color: #273d5b;
  font-size: 14px;
}
.secondary-link span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.secondary-link.is-active,
.secondary-link.router-link-exact-active {
  color: #1764e8;
  background: white;
  border-left-color: #257bff;
  font-weight: 600;
}
.secondary-link:hover {
  background: #e8f0fb;
}
.secondary-group {
  padding: 20px 0 10px;
  margin-top: 8px;
  border-bottom: 1px solid #bdcfe6;
}
.secondary-group h2 {
  margin: 0 14px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #526b8b;
}
.secondary-group--recent {
  margin-top: auto;
}
.secondary-nav__empty {
  font-size: 13px;
  padding: 14px;
  color: #526b8b;
}
.secondary-nav :deep(.nav-branch),
.secondary-nav :deep(.nav-item) {
  color: #273d5b;
  font-weight: 500;
  border-radius: 6px;
}
.secondary-nav :deep(.nav-item--active) {
  color: #1764e8;
  background: white;
}
.secondary-nav :deep(.nav-branch--active) {
  color: #1764e8;
  background: #eaf1fb;
  box-shadow: none;
}
.secondary-nav :deep(.nav-branch:hover),
.secondary-nav :deep(.nav-item:hover) {
  background: #e8f0fb;
}
.secondary-nav :deep(.nav-children) {
  border-color: #b7c9e0;
  margin-left: 12px;
  padding-left: 4px;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #3485ff;
  outline-offset: -2px;
}
@media (max-height: 800px) {
  .module-rail__items {
    gap: 3px;
    padding-top: 8px;
  }
  .module-link {
    min-height: 57px;
    gap: 5px;
  }
  .secondary-group {
    padding-top: 12px;
  }
}
@media (max-width: 760px) {
  .secondary-nav {
    position: fixed;
    top: 0;
    left: 64px;
    bottom: 0;
    width: 220px;
    z-index: 25;
    box-shadow: 8px 0 24px #17304a22;
  }
  .console-navigation,
  .console-navigation.is-collapsed {
    grid-template-columns: 64px;
  }
  .module-rail {
    width: 64px;
  }
}
</style>
