<template>
  <div class="nav-tree">
    <template v-for="node in nodes" :key="node.id">
      <div v-if="node.visible" class="nav-node">
        <button
          v-if="!node.routePath && visibleChildren(node).length"
          type="button"
          :class="[
            depth === 0 ? 'nav-group__label' : 'nav-subgroup__label',
            'nav-group__toggle',
          ]"
          :aria-expanded="isExpanded(node)"
          @click="toggleNode(node)"
        >
          {{ node.displayName }}
          <span class="nav-chevron" :class="{ 'nav-chevron--collapsed': !isExpanded(node) }" aria-hidden="true" />
        </button>
        <p v-else-if="!node.routePath" :class="depth === 0 ? 'nav-group__label' : 'nav-subgroup__label'">
          {{ node.displayName }}
        </p>
        <button
          v-else-if="visibleChildren(node).length"
          type="button"
          class="nav-item nav-item--group-toggle"
          :class="[
            `nav-item--depth-${Math.min(depth, 3)}`,
            { 'nav-item--active': isActive(node) },
          ]"
          :aria-label="`${isExpanded(node) ? '收起' : '展开'}${node.displayName}`"
          :aria-expanded="isExpanded(node)"
          @click="toggleNode(node)"
        >
          <ConsoleNavIcon :icon-key="node.iconKey" />
          <span>{{ node.displayName }}</span>
          <span class="nav-chevron" :class="{ 'nav-chevron--collapsed': !isExpanded(node) }" aria-hidden="true" />
        </button>
        <router-link
          v-else-if="node.routePath"
          class="nav-item"
          :class="[
            `nav-item--depth-${Math.min(depth, 3)}`,
            { 'nav-item--active': isActive(node) },
          ]"
          :to="node.routePath"
        >
          <ConsoleNavIcon :icon-key="node.iconKey" />
          <span>{{ node.displayName }}</span>
        </router-link>
        <div
          v-if="visibleChildren(node).length"
          :id="`nav-children-${node.id}`"
          class="nav-children"
          :class="{ 'nav-children--collapsed': !isExpanded(node) }"
          :aria-hidden="!isExpanded(node)"
        >
          <ConsoleNavTree
            :nodes="visibleChildren(node)"
            :depth="depth + 1"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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

function visibleChildren(node: NavigationNode): NavigationNode[] {
  return node.children.filter((child) => child.visible)
}

function isActive(node: NavigationNode): boolean {
  return node.routePath === route.path
    || node.children.filter((child) => child.visible).some(isActive)
}

function isExpanded(node: NavigationNode): boolean {
  return expandedByNode.value[node.id] ?? true
}

function toggleNode(node: NavigationNode): void {
  expandedByNode.value[node.id] = !isExpanded(node)
}

// 通过其他入口进入子页面时，自动展开其父分组，避免当前页面被收起的菜单遮挡。
watch(() => route.path, () => {
  props.nodes.forEach((node) => {
    if (node.children.filter((child) => child.visible).some(isActive)) {
      expandedByNode.value[node.id] = true
    }
  })
}, { immediate: true })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.nav-tree {
  display: block;
}

.nav-node {
  margin-top: 18px;

  &:first-child {
    margin-top: 4px;
  }
}

.nav-node > .nav-tree {
  margin-top: 4px;
}

.nav-group__label,
.nav-subgroup__label {
  margin: 0 0 6px;
  color: $color-ink-text-faint;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.nav-group__toggle,
.nav-subgroup__toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover {
    color: $color-ink-text;
  }
}

.nav-group__label {
  padding: 0 10px;
}

.nav-subgroup__label {
  margin-left: 26px;
  padding: 0 10px;
  color: $color-ink-text-muted;
  font-size: 12px;
  letter-spacing: 0;
}

.nav-chevron {
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  transition: transform $transition-fast;

  &--collapsed {
    transform: rotate(-45deg) translate(-1px, 1px);
  }
}

.nav-item--group-toggle {
  justify-content: flex-start;
  color: $color-ink-text-faint;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover {
    color: $color-ink-text;
    background: $color-ink-hover;
  }

  .nav-chevron {
    margin-left: auto;
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

  &--depth-2 {
    margin-left: 16px;
  }

  &--depth-3 {
    margin-left: 32px;
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

.nav-children {
  display: block;

  &--collapsed {
    display: none;
  }
}
</style>
