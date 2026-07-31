<template>
  <el-sub-menu v-if="visibleChildren.length" :index="node.routeKey">
    <template #title><span>{{ node.displayName }}</span></template>
    <ManagementNavigationNode v-for="child in visibleChildren" :key="child.id" :node="child" />
  </el-sub-menu>
  <el-menu-item v-else-if="node.routePath" :index="node.routePath">{{ node.displayName }}</el-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationNode } from '@/types/management'
const props = defineProps<{ node: NavigationNode }>()
const visibleChildren = computed(() => props.node.children.filter((child) => child.visible))
</script>
