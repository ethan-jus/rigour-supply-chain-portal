<template>
  <div class="topbar">
    <div class="topbar-left">
      <el-icon class="collapse-btn" :size="20" @click="$emit('toggle-sidebar')">
        <Fold v-if="!collapsed" />
        <Expand v-else />
      </el-icon>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="crumb in breadcrumbs"
          :key="crumb.title"
          :to="crumb.path || undefined"
        >
          {{ crumb.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="topbar-right">
      <el-dropdown trigger="click" @command="handleCommand">
        <span class="user-info">
          <el-avatar :size="32" icon="UserFilled" />
          <span class="user-name">{{ userName || '用户' }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, useAppStore } from '@/stores'

defineProps<{
  collapsed: boolean
}>()

defineEmits<{
  'toggle-sidebar': []
}>()

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const userName = computed(() => authStore.user?.displayName)
const breadcrumbs = computed(() => appStore.breadcrumbs)

function handleCommand(command: string) {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $topbar-height;
  padding: 0 20px;
  background: $color-bg-white;
  border-bottom: 1px solid $color-border-lighter;
  box-shadow: $shadow-sm;

  &-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &-right {
    display: flex;
    align-items: center;
  }
}

.collapse-btn {
  cursor: pointer;
  color: $color-text-regular;

  &:hover {
    color: $color-primary;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: $border-radius-base;
  transition: background $transition-fast;

  &:hover {
    background: $color-bg-base;
  }
}

.user-name {
  font-size: $font-size-base;
  color: $color-text-primary;
}
</style>
