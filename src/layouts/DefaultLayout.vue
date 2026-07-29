<template>
  <div class="layout" :class="{ 'layout--collapsed': appStore.sidebarCollapsed }">
    <aside class="layout-sidebar">
      <AppSidebar :collapsed="appStore.sidebarCollapsed" />
    </aside>

    <div class="layout-main">
      <AppTopbar
        :collapsed="appStore.sidebarCollapsed"
        @toggle-sidebar="appStore.toggleSidebar"
      />

      <main class="layout-content">
        <router-view v-slot="{ Component, route }">
          <keep-alive>
            <component :is="Component" v-if="route.meta?.keepAlive" :key="route.path" />
          </keep-alive>
          <component :is="Component" v-if="!route.meta?.keepAlive" :key="route.path" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'

const appStore = useAppStore()

</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;
.layout {
  display: flex;
  height: 100vh;

  &--collapsed {
    .layout-sidebar {
      width: var(--sidebar-collapsed-width);
    }
  }

  &-sidebar {
    width: var(--sidebar-width);
    background-color: #001529;
    overflow-y: auto;
    transition: width $transition-base;
    flex-shrink: 0;
  }

  &-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &-content {
    flex: 1;
    padding: $spacing-lg;
    overflow-y: auto;
    background-color: $color-bg-page;
  }
}
</style>
