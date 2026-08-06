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
          <span class="nav-chevron" :class="{ 'nav-chevron--collapsed': !isExpanded(node) }" aria-hidden="true" />
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

const props = withDefaults(defineProps<{
  nodes: NavigationNode[]
  depth?: number
}>(), { depth: 0 })

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

watch(() => route.path, () => syncActiveBranch(props.nodes), { immediate: true })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.nav-tree,
.nav-node {
  display: block;
}

.nav-node--depth-0 {
  margin: 3px 0;
}

.nav-branch,
.nav-item {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  color: #fff;
  text-align: left;
  text-decoration: none;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: color $transition-fast, background $transition-fast, transform $transition-fast;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
}

.nav-branch--depth-0,
.nav-item--depth-0 {
  gap: 11px;
  min-height: 44px;
  padding: 0 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.nav-branch--depth-0.nav-branch--active,
.nav-item--depth-0.nav-item--active {
  color: #fff;
  background: rgba(37, 99, 235, 0.2);
  box-shadow: inset 3px 0 0 $color-primary-light;
}

.nav-branch--depth-1,
.nav-item--depth-1 {
  min-height: 38px;
  padding: 0 12px 0 16px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.nav-branch--depth-2,
.nav-item--depth-2,
.nav-branch--depth-3,
.nav-item--depth-3 {
  min-height: 36px;
  padding: 0 10px 0 28px;
  color: #fff;
  font-size: $font-size-sm;
  font-weight: 600;
}

.nav-branch--depth-1.nav-branch--active {
  color: #fff;
}

.nav-item--active {
  color: #fff;
  background: rgba(37, 99, 235, 0.24);

  &::before {
    position: absolute;
    top: 10px;
    bottom: 10px;
    left: 0;
    width: 3px;
    background: $color-primary-light;
    border-radius: 0 3px 3px 0;
    content: '';
  }
}

.nav-children {
  margin: 4px 0 8px 20px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
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
</style>
