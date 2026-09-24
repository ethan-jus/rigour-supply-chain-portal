<template>
  <section class="settings-home" v-loading="loading">
    <el-result
      v-if="!access.context?.initialized"
      icon="info"
      title="供应链系统设置"
      sub-title="初始化后可维护本系统的菜单、用户和角色。"
    >
      <template #extra
        ><el-button
          v-if="access.context?.canInitialize"
          type="primary"
          :loading="initializing"
          @click="initialize"
          >初始化系统设置</el-button
        >
        <p v-else>请联系本租户管理员完成初始化。</p></template
      >
    </el-result>
    <template v-else>
      <SupplyPageTitle tag="h2">系统设置</SupplyPageTitle>
      <p class="description">维护供应链系统的用户、角色、菜单和业务配置。</p>
      <el-alert
        title="权限配置保存后立即生效"
        description="在角色管理配置菜单、按钮和数据范围；在用户管理分配角色及地区、仓库范围。"
        type="info"
        :closable="false"
      />
      <div class="settings-grid">
        <router-link
          v-for="entry in entries"
          :key="entry.path"
          :to="entry.path"
          class="settings-card"
          ><strong>{{ entry.name }}</strong
          ><span>{{ entry.description }}</span></router-link
        >
      </div>
    </template>
  </section>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onMounted, ref } from 'vue'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { useNavigationStore } from '@/stores/navigation'
const access = useSupplyAuthorizationStore(),
  navigation = useNavigationStore()
const loading = ref(false),
  initializing = ref(false)
const descriptions: Record<string, string> = {
  users: '关联员工与账号，分配角色和业务范围',
  roles: '配置功能与数据权限',
  menus: '设置菜单名称、层级、图标和操作权限',
  'numbering-dictionaries': '维护业务使用的字典项',
  parameters: '维护各业务模块的参数',
  audits: '查询系统设置操作记录',
}
const entries = computed(() => {
  const result: { path: string; name: string; description: string }[] = []
  const visit = (nodes: ReturnType<typeof navigation.getNavigation>) => {
    for (const node of nodes) {
      if (
        node.visible &&
        node.routePath?.startsWith('/supply-chain/settings/') &&
        node.type === 'PAGE'
      )
        result.push({
          path: node.routePath,
          name: node.displayName,
          description: descriptions[node.routePath.split('/').at(-1)!] || '',
        })
      visit(node.children)
    }
  }
  visit(navigation.getNavigation('SUPPLY_CHAIN'))
  return result
})
async function initialize() {
  initializing.value = true
  try {
    await access.initialize()
  } finally {
    initializing.value = false
  }
}
onMounted(async () => {
  loading.value = true
  try {
    await access.refresh()
  } finally {
    loading.value = false
  }
})
</script>
<style scoped>
.settings-home {
  padding: 24px;
}
.description {
  color: var(--el-text-color-secondary);
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.settings-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--el-border-color);
  padding: 24px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--el-text-color-primary);
}
.settings-card:hover {
  border-color: var(--el-color-primary);
}
.settings-card span {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
