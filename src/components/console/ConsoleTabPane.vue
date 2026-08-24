<template>
  <section v-show="active" class="workspace-tab-pane">
    <router-view :route="route" v-slot="{ Component }">
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
import { provide } from 'vue'
import { routeLocationKey, type RouteLocationNormalizedLoaded } from 'vue-router'

const props = defineProps<{
  active: boolean
  route: RouteLocationNormalizedLoaded
}>()

provide(routeLocationKey, props.route)
</script>

<style scoped>
.workspace-tab-pane {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
