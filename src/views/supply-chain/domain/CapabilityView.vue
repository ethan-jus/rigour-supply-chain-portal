<template>
  <el-card shadow="never" class="capability-page supply-page supply-page--static">
    <template #header>
      <div class="page-header">
        <div>
          <span>{{ page.domainTitle }}<template v-if="page.groupTitle"> · {{ page.groupTitle }}</template></span>
          <h1>{{ page.title }}</h1>
        </div>
        <el-tag type="info" effect="plain">接口预占</el-tag>
      </div>
    </template>
    <el-empty description="业务接口尚未接入；当前仅预占菜单和页面，不生成模拟业务数据。" />
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="`${page.title}由 ${page.owner} 持有业务事实；接口接入前仅提供稳定菜单、路由和权限挂载点。`"
    />
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SUPPLY_DOMAIN_PAGES } from './catalog'

const route = useRoute()
const page = computed(() => {
  const routeKey = String(route.meta.routeKey || '')
  const definition = SUPPLY_DOMAIN_PAGES.find((item) => item.routeKey === routeKey)
  if (!definition) throw new Error(`未注册的供应链能力页面: ${routeKey}`)
  return definition
})
</script>

<style scoped lang="scss">
.capability-page {
  h1 { margin: 6px 0 0; font-size: 22px; }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  span { color: #64748b; font-size: 13px; }
}
</style>
