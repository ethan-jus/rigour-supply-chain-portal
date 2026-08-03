<template>
  <section class="applications">
    <div class="hero">
      <div class="hero__copy">
        <h1>{{ greeting }}，{{ authStore.user?.displayName }}</h1>
        <p>{{ todayText }} · 选择一个已授权应用开始工作</p>
      </div>
      <div class="hero__stats">
        <span class="stat-chip"><strong>{{ applicationStore.applications.length }}</strong> 可用应用</span>
      </div>
    </div>

    <div class="section-bar">
      <h2>我的应用 <span class="count">{{ filteredApplications.length }}</span></h2>
      <div class="section-bar__right">
        <label class="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input v-model="keyword" type="search" placeholder="搜索应用" aria-label="搜索应用">
        </label>
        <el-button :loading="applicationStore.loading" text @click="reload">刷新权限</el-button>
      </div>
    </div>

    <div v-if="applicationStore.loading && !applicationStore.loaded" class="application-grid" aria-label="正在加载应用">
      <el-skeleton v-for="index in 2" :key="index" animated>
        <template #template><div class="skeleton-card" /></template>
      </el-skeleton>
    </div>
    <el-result v-else-if="applicationStore.error" icon="error" title="应用目录加载失败" :sub-title="applicationStore.error">
      <template #extra><el-button type="primary" @click="reload">重新加载</el-button></template>
    </el-result>
    <el-empty v-else-if="applicationStore.loaded && applicationStore.applications.length === 0" description="当前账号暂无已授权应用">
      <p class="empty-hint">请联系租户管理员检查套餐、角色和应用资源授权。</p>
    </el-empty>
    <el-empty v-else-if="filteredApplications.length === 0" description="没有匹配的应用" />
    <div v-else class="application-grid">
      <ApplicationCard v-for="application in filteredApplications" :key="application.id"
        :application="application" @launch="launch(application)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useApplicationStore, useAuthStore, useNavigationStore } from '@/stores'
import type { PortalApplication } from '@/types/application'
import { launchApplication } from '@/utils/safe-launch'
import { devInfo, devWarn } from '@/utils/dev-log'
import ApplicationCard from './components/ApplicationCard.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const applicationStore = useApplicationStore()
const navigationStore = useNavigationStore()
const keyword = ref('')

const greeting = computed(() => new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好')
const todayText = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const filteredApplications = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return applicationStore.applications
  return applicationStore.applications.filter((application) =>
    application.name.toLowerCase().includes(value) || application.code.toLowerCase().includes(value))
})

onMounted(() => { if (!applicationStore.loaded) void reload() })
watch(() => route.query.launchError, (launchError) => {
  if (launchError === 'navigation-unavailable') ElMessage.error('应用菜单加载失败，请稍后重试')
  if (launchError === 'applications-unavailable') ElMessage.error('应用目录加载失败，请稍后重试')
  if (launchError) {
    void router.replace({ path: '/service-unavailable', query: { reason: String(launchError) } })
  }
}, { immediate: true })

async function reload() {
  try {
    await authStore.fetchUser()
    navigationStore.reset()
    await applicationStore.fetchApplications()
    const navigationResults = await Promise.allSettled(applicationStore.applications
      .filter((application) => application.launchMode === 'INTERNAL_ROUTE')
      .map((application) => navigationStore.fetchNavigation(application.code)))
    const failedApplications = navigationResults
      .map((result, index) => result.status === 'rejected'
        ? applicationStore.applications.filter((application) => application.launchMode === 'INTERNAL_ROUTE')[index]?.code
        : null)
      .filter((code): code is string => Boolean(code))
    if (failedApplications.length > 0) {
      devWarn('部分应用菜单加载失败，保留其他应用入口', { applications: failedApplications })
    }
  } catch (error) {
    devWarn('统一门户数据加载未完成，页面保留稳定错误态', {
      message: error instanceof Error ? error.message : error,
    })
  }
}

async function launch(application: PortalApplication) {
  try {
    devInfo('用户点击应用卡片', { code: application.code, targetUri: application.targetUri })
    await launchApplication(application, router)
  } catch (error) {
    devWarn('应用卡片打开失败', {
      code: application.code,
      message: error instanceof Error ? error.message : error,
    })
    ElMessage.error(error instanceof Error ? error.message : '应用启动失败')
  }
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.hero {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-lg;
  margin-bottom: 36px;
  padding: 36px 40px;
  overflow: hidden;
  color: #fff;
  background: $color-ink;
  border-radius: $border-radius-xl;

  &::before {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
    background-size: 20px 20px;
    content: '';
  }

  &::after {
    position: absolute;
    top: -160px;
    right: -120px;
    width: 420px;
    height: 420px;
    background: radial-gradient(circle, rgba(79, 70, 229, 0.35) 0%, transparent 65%);
    border-radius: 50%;
    content: '';
  }

  &__copy {
    position: relative;
    z-index: 1;

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    p {
      margin: 10px 0 0;
      color: $color-ink-text-muted;
      font-size: $font-size-sm;
    }
  }

  &__stats {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 10px;
  }
}

.stat-chip {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  padding: 8px 14px;
  color: $color-ink-text;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  font-size: $font-size-sm;

  strong {
    font-size: $font-size-md;
    font-weight: 600;
  }
}

.section-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0;
    font-size: $font-size-md;
    font-weight: 600;
  }

  .count {
    margin-left: 4px;
    color: $color-text-placeholder;
    font-weight: 400;
  }

  &__right {
    display: flex;
    gap: $spacing-sm;
    align-items: center;
  }
}

.search {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  color: $color-text-placeholder;
  background: $color-bg-white;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;

  input {
    width: 160px;
    font: inherit;
    font-size: $font-size-sm;
    color: $color-text-primary;
    background: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      color: $color-text-placeholder;
    }
  }
}

.application-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-md;
}

.skeleton-card {
  height: 190px;
  background: $color-bg-white;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-xl;
}

.empty-hint {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

@media (max-width: 900px) {
  .application-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 28px;
  }
}
</style>
