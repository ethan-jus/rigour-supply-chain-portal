<template>
  <section class="applications">
    <div class="hero">
      <div><p class="eyebrow">WORKSPACE</p><h1>{{ greeting }}，{{ authStore.user?.displayName }}</h1>
        <p>选择一个已授权应用开始工作。应用卡片、菜单和按钮权限均由 IAM 实时计算。</p></div>
      <div class="summary"><strong>{{ applicationStore.applications.length }}</strong><span>个可用应用</span></div>
    </div>

    <div class="section-title"><div><h2>我的应用</h2><p>{{ authStore.user?.tenantName || '平台运营空间' }}</p></div>
      <el-button :loading="applicationStore.loading" text @click="reload">刷新权限</el-button></div>

    <div v-if="applicationStore.loading && !applicationStore.loaded" class="application-grid" aria-label="正在加载应用">
      <el-skeleton v-for="index in 3" :key="index" animated><template #template><div class="skeleton-card"><el-skeleton-item variant="circle" class="skeleton-icon"/><div><el-skeleton-item variant="h3" style="width:55%"/><el-skeleton-item variant="text" style="width:80%;margin-top:12px"/></div></div></template></el-skeleton>
    </div>
    <el-result v-else-if="applicationStore.error" icon="error" title="应用目录加载失败" :sub-title="applicationStore.error">
      <template #extra><el-button type="primary" @click="reload">重新加载</el-button></template>
    </el-result>
    <el-empty v-else-if="applicationStore.loaded && applicationStore.applications.length === 0" description="当前账号暂无已授权应用">
      <p class="empty-hint">请联系租户管理员检查套餐、角色和应用资源授权。</p>
    </el-empty>
    <div v-else class="application-grid">
      <ApplicationCard v-for="application in applicationStore.applications" :key="application.id"
        :application="application" @launch="launch(application)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useApplicationStore, useAuthStore } from '@/stores'
import type { PortalApplication } from '@/types/application'
import { launchApplication } from '@/utils/safe-launch'
import ApplicationCard from './components/ApplicationCard.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const applicationStore = useApplicationStore()
const greeting = computed(() => new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好')
onMounted(() => { if (!applicationStore.loaded) void reload() })
watch(() => route.query.launchError, (launchError) => {
  if (launchError === 'navigation-unavailable') ElMessage.error('应用菜单加载失败，请稍后重试')
  if (launchError === 'applications-unavailable') ElMessage.error('应用目录加载失败，请稍后重试')
  if (launchError) void router.replace('/apps')
}, { immediate: true })
async function reload() { try { await applicationStore.fetchApplications() } catch { /* 页面已展示稳定错误态 */ } }
async function launch(application: PortalApplication) {
  try { await launchApplication(application, router) }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '应用启动失败') }
}
</script>

<style scoped lang="scss">
.hero { display: flex; justify-content: space-between; gap: 28px; align-items: flex-end; margin-bottom: 44px; padding: clamp(28px,4vw,42px); color: white; background: linear-gradient(125deg,#12345f,#1b5f9c 65%,#2678bb); border-radius: 22px; box-shadow: 0 18px 42px rgb(23 73 124 / 17%); }
.eyebrow { margin: 0 0 8px; color: rgb(255 255 255 / 62%); font-size: 11px; font-weight: 800; letter-spacing: .16em; }.hero h1{margin:0;font-size:clamp(28px,4vw,40px);letter-spacing:-.03em}.hero p:last-child{max-width:690px;margin:12px 0 0;color:rgb(255 255 255 / 72%);line-height:1.75}.summary{display:grid;min-width:130px;text-align:right}.summary strong{font-size:42px;line-height:1}.summary span{margin-top:7px;color:rgb(255 255 255 / 68%);font-size:12px}
.section-title{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px}.section-title h2{margin:0;font-size:21px}.section-title p{margin:6px 0 0;color:#8190a4;font-size:13px}.application-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px}.skeleton-card{display:grid;grid-template-columns:52px 1fr;gap:16px;align-items:center;height:146px;padding:24px;background:white;border:1px solid #e8edf3;border-radius:16px}.skeleton-icon{width:52px!important;height:52px!important}.empty-hint{color:#8a97a8;font-size:13px}.applications :deep(.el-result){background:white;border:1px solid #e8edf3;border-radius:16px}
@media(max-width:640px){.hero{align-items:flex-start;flex-direction:column;margin-bottom:30px}.summary{text-align:left}.application-grid{grid-template-columns:1fr}}
</style>
