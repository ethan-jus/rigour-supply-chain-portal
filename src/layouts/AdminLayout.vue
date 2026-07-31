<template>
  <div class="management-layout">
    <aside>
      <div class="brand">{{ title }}</div>
      <el-menu :default-active="route.path" router background-color="#001529"
        text-color="rgba(255,255,255,.72)" active-text-color="#fff">
        <ManagementNavigationNode v-for="node in navigation" :key="node.id" :node="node" />
      </el-menu>
    </aside>
    <section>
      <header><router-link to="/apps">← 返回统一门户</router-link><strong>{{ title }}</strong></header>
      <main><router-view /></main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigationStore } from '@/stores'
import ManagementNavigationNode from '@/components/management/ManagementNavigationNode.vue'

const route = useRoute()
const navigationStore = useNavigationStore()
const applicationCode = computed(() => String(route.meta.applicationCode || ''))
const title = computed(() => applicationCode.value === 'PLATFORM_ADMIN' ? '平台管理中心' : '系统管理')
const navigation = computed(() => navigationStore.getNavigation(applicationCode.value))
onMounted(() => {
  if (applicationCode.value && !navigationStore.isLoaded(applicationCode.value)) {
    void navigationStore.fetchNavigation(applicationCode.value)
  }
})
</script>

<style scoped>
.management-layout { min-height: 100vh; display: grid; grid-template-columns: 240px 1fr; background: #f5f7fa; }
aside { background: #001529; min-height: 100vh; }
.brand { height: 64px; display: grid; place-items: center; color: white; font-weight: 700; }
section { min-width: 0; }
header { height: 64px; padding: 0 32px; background: white; display: flex; gap: 24px; align-items: center; }
main { padding: 24px; }
:deep(.el-menu) { border-right: 0; }
</style>
