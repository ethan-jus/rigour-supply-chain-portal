<template>
  <section v-show="active" class="workspace-tab-pane">
    <div v-if="renderError" class="workspace-tab-pane__error">
      <strong>页面加载失败</strong>
      <span>{{ renderError }}</span>
    </div>
    <router-view v-else :route="route" v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" v-if="active && Component" />
      </KeepAlive>
    </router-view>
  </section>
</template>

<script setup lang="ts">
/**
 * 单个工作页签的私有路由出口与缓存边界。
 *
 * 多个菜单会复用同一个业务组件。为页签提供独立 routeLocationKey 后，
 * 非活动页不会再跟随全局路由变化而重置筛选；移除本组件也会一并释放缓存。
 */
import { onErrorCaptured, provide, ref, watch } from 'vue'
import { routeLocationKey, type RouteLocationNormalizedLoaded } from 'vue-router'

const props = defineProps<{
  active: boolean
  route: RouteLocationNormalizedLoaded
}>()

const renderError = ref('')

provide(routeLocationKey, props.route)

watch(
  () => props.route.fullPath,
  () => {
    renderError.value = ''
  },
)

onErrorCaptured((error) => {
  renderError.value = error instanceof Error ? error.message : String(error)
  return false
})
</script>

<style scoped>
.workspace-tab-pane {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.workspace-tab-pane__error {
  display: grid;
  gap: 8px;
  margin: 24px;
  padding: 16px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff7ed;
  color: #991b1b;
}

.workspace-tab-pane__error strong {
  font-size: 16px;
}

.workspace-tab-pane__error span {
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
