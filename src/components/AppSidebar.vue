<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="collapsed"
    :collapse-transition="false"
    :unique-opened="true"
    mode="vertical"
    background-color="#001529"
    text-color="rgba(255,255,255,0.65)"
    active-text-color="#fff"
    router
  >
    <div class="sidebar-logo">
      <span v-if="!collapsed" class="sidebar-logo-text">瑞盖优选</span>
      <span v-else class="sidebar-logo-short">R</span>
    </div>

    <template v-for="route in menuRoutes" :key="route.path">
      <el-sub-menu v-if="route.children && route.children.length > 0" :index="route.path">
        <template #title>
          <el-icon v-if="route.meta?.icon">
            <component :is="route.meta.icon" />
          </el-icon>
          <span>{{ route.meta?.title }}</span>
        </template>
        <el-menu-item
          v-for="child in route.children"
          :key="child.path"
          :index="resolvePath(route.path, child.path)"
        >
          <span>{{ child.meta?.title || child.path }}</span>
        </el-menu-item>
      </el-sub-menu>

      <el-menu-item v-else :index="route.path">
        <el-icon v-if="route.meta?.icon">
          <component :is="route.meta.icon" />
        </el-icon>
        <template #title>{{ route.meta?.title }}</template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePermissionStore } from '@/stores/permission'
import type { PermissionRoute } from '@/stores/permission'

defineProps<{
  collapsed: boolean
}>()

const route = useRoute()
const permissionStore = usePermissionStore()

const activeMenu = computed(() => {
  const matched = route.matched
  if (matched.length >= 2) {
    const second = matched[1]
    if (second) return second.path
  }
  return route.path
})

function resolvePath(parent: string, child: string): string {
  if (child.startsWith('/')) return child
  return `${parent}/${child}`
}

const menuRoutes = computed<PermissionRoute[]>(() => {
  return (permissionStore.accessibleRoutes || []).filter((r) => !r.meta?.hidden && r.meta?.title)
})
</script>

<style lang="scss" scoped>
.sidebar-logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  &-text {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 1px;
  }

  &-short {
    font-size: 20px;
    font-weight: 700;
    color: #409eff;
  }
}
</style>
