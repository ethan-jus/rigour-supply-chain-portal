<template>
  <div class="app-layout"><aside><div class="brand">供应链系统</div><el-menu :default-active="route.path" router background-color="#001529" text-color="rgba(255,255,255,.72)" active-text-color="#fff"><ManagementNavigationNode v-for="node in navigation" :key="node.id" :node="node" /></el-menu></aside><section>
    <header><router-link to="/apps">← 返回我的应用</router-link><strong>供应链系统</strong></header>
    <main><router-view /></main></section>
  </div>
</template>

<script setup lang="ts">
import{computed,onMounted}from'vue';import{useRoute}from'vue-router';import{useNavigationStore}from'@/stores';import ManagementNavigationNode from '@/components/management/ManagementNavigationNode.vue';const route=useRoute();const store=useNavigationStore();const navigation=computed(()=>store.getNavigation('SUPPLY_CHAIN'));onMounted(()=>{if(!store.isLoaded('SUPPLY_CHAIN'))void store.fetchNavigation('SUPPLY_CHAIN')})
</script>

<style scoped>
.app-layout { min-height: 100vh; display:grid;grid-template-columns:240px 1fr;background: #f5f7fa; }
aside{background:#001529;min-height:100vh}.brand{height:64px;display:grid;place-items:center;color:white;font-weight:700}section{min-width:0}
header { height: 64px; padding: 0 32px; background: white; display: flex; gap: 24px; align-items: center; }
main { padding: 24px; }:deep(.el-menu){border-right:0}
</style>
