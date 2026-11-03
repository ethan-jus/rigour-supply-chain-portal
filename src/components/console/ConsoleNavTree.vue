<template>
  <div class="nav-tree" :class="`nav-tree--depth-${Math.min(depth, 3)}`">
    <template v-for="node in visibleNodes" :key="node.id">
      <div
        class="nav-node"
        :class="[
          `nav-node--depth-${Math.min(depth, 3)}`,
          { 'nav-node--active-branch': containsActiveRoute(node) },
        ]"
      >
        <button
          v-if="visibleChildren(node).length"
          type="button"
          class="nav-branch"
          :class="[
            `nav-branch--depth-${Math.min(depth, 3)}`,
            { 'nav-branch--active': containsActiveRoute(node) },
          ]"
          :aria-expanded="isExpanded(node)"
          :aria-controls="`nav-children-${node.id}`"
          @click="toggleNode(node)"
        >
          <ConsoleNavIcon v-if="depth === 0" :icon-key="node.iconKey" />
          <span class="nav-branch__text">{{ node.displayName }}</span>
          <span
            class="nav-chevron"
            :class="{ 'nav-chevron--collapsed': !isExpanded(node) }"
            aria-hidden="true"
          />
        </button>

        <router-link
          v-else-if="node.routePath"
          class="nav-item"
          :class="[
            `nav-item--depth-${Math.min(depth, 3)}`,
            { 'nav-item--active': isExactActive(node) },
          ]"
          :to="node.routePath"
        >
          <ConsoleNavIcon v-if="depth === 0" :icon-key="node.iconKey" />
          <span>{{ node.displayName }}</span>
        </router-link>

        <div
          v-if="visibleChildren(node).length"
          v-show="isExpanded(node)"
          :id="`nav-children-${node.id}`"
          class="nav-children"
        >
          <ConsoleNavTree :nodes="visibleChildren(node)" :depth="depth + 1" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { NavigationNode } from '@/types/management'
import ConsoleNavIcon from '@/components/console/ConsoleNavIcon.vue'

defineOptions({ name: 'ConsoleNavTree' })

const props = withDefaults(
  defineProps<{
    nodes: NavigationNode[]
    depth?: number
  }>(),
  { depth: 0 },
)

const route = useRoute()
const expandedByNode = ref<Record<string, boolean>>({})
const visibleNodes = computed(() => props.nodes.filter((node) => node.visible))

function visibleChildren(node: NavigationNode): NavigationNode[] {
  return node.children.filter((child) => child.visible)
}

function isExactActive(node: NavigationNode): boolean {
  return node.routePath === route.path
}

function containsActiveRoute(node: NavigationNode): boolean {
  return isExactActive(node) || visibleChildren(node).some(containsActiveRoute)
}

function isExpanded(node: NavigationNode): boolean {
  return expandedByNode.value[node.id] ?? containsActiveRoute(node)
}

function toggleNode(node: NavigationNode): void {
  const shouldExpand = !isExpanded(node)

  if (shouldExpand) {
    visibleNodes.value.forEach((sibling) => {
      if (visibleChildren(sibling).length) {
        expandedByNode.value[sibling.id] = false
      }
    })
  }

  expandedByNode.value[node.id] = shouldExpand
}

function syncActiveBranch(nodes: NavigationNode[]): void {
  nodes.forEach((node) => {
    if (visibleChildren(node).length) {
      expandedByNode.value[node.id] = visibleChildren(node).some(containsActiveRoute)
    }
  })
}

watch(
  () => route.path,
  () => syncActiveBranch(props.nodes),
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.nav-tree,
.nav-node {
  display: block;
}

.nav-node--depth-0 {
  margin: 2px 0;
}

.nav-branch,
.nav-item {
  position: relative;
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 12px;
  color: $color-text-regular;
  font: inherit;
  font-size: var(--app-menu-font-size);
  line-height: 22px;
  text-align: left;
  text-decoration: none;
  background: transparent;
  border: 0;
  border-radius: $border-radius-sm;
  cursor: pointer;
  transition:
    color $transition-fast,
    background $transition-fast;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-muted;
  }

  &:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: -2px;
  }
}

.nav-branch :deep(.nav-icon),
.nav-item :deep(.nav-icon) {
  color: $color-text-secondary;
}

.nav-branch {
  font-weight: 500;
}

.nav-branch--depth-1,
.nav-item--depth-1 {
  min-height: 38px;
  padding: 8px 12px;
}

.nav-branch--depth-2,
.nav-item--depth-2,
.nav-branch--depth-3,
.nav-item--depth-3 {
  min-height: 38px;
  padding: 8px 12px;
  font-size: var(--app-menu-font-size);
}

.nav-branch--active {
  color: $color-text-primary;
}

.nav-item--active,
.nav-item--active:hover {
  color: $color-primary;
  background: rgba($color-primary, 0.08);
  font-weight: 600;

  :deep(.nav-icon) {
    color: currentColor;
  }

  &::before {
    position: absolute;
    top: 10px;
    bottom: 10px;
    left: 2px;
    width: 2px;
    background: $color-primary;
    border-radius: 2px;
    content: '';
  }
}

.nav-children {
  margin: 4px 0 8px 20px;
  padding-left: 4px;
  border-left: 1px solid $color-border-base;
}

.nav-tree--depth-2 .nav-children {
  margin-left: 10px;
}

.nav-branch__text,
.nav-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-chevron {
  width: 7px;
  height: 7px;
  margin: 0 3px 3px auto;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  opacity: 0.72;
  transform: rotate(45deg);
  transition: transform $transition-fast;

  &--collapsed {
    margin-bottom: 0;
    transform: rotate(-45deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-branch,
  .nav-item,
  .nav-chevron {
    transition: none;
  }
}
</style>
