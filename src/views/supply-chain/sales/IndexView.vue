<template>
  <section class="sales-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">销售管理 · {{ definition.group }}</p>
        <h1>{{ definition.title }}</h1>
        <p>{{ definition.description }}</p>
      </div>
      <el-tag v-if="!isImplemented" type="warning" effect="plain">页面骨架 · API待接入</el-tag>
      <el-tag v-else type="success" effect="plain">真实数据</el-tag>
    </header>

    <SalesDashboard v-if="pageKey === 'dashboard'" />
    <SalesReviewQueue v-else-if="isReviewPage" />
    <SalesTrackComparison v-else-if="isTrackPage" />
    <template v-else>
      <div class="detail-grid">
        <el-card shadow="never">
          <template #header><strong>职责边界</strong></template>
          <dl class="facts">
            <div><dt>唯一主写</dt><dd>{{ definition.owner }}</dd></div>
            <div><dt>目标接口</dt><dd><code>{{ definition.api }}</code></dd></div>
            <div><dt>当前状态</dt><dd>IAM菜单和受控路由已登记，业务接口未完成的页面保持失败关闭。</dd></div>
          </dl>
        </el-card>

        <el-card shadow="never">
          <template #header><strong>实现约束</strong></template>
          <ul class="constraint-list">
            <li v-for="fact in definition.facts" :key="fact">{{ fact }}</li>
          </ul>
        </el-card>
      </div>

      <el-alert
        title="当前页面不展示模拟业务数据"
        description="真实数据必须通过Gateway调用所属领域API；在Repository、权限和接口完成前，仅交付可授权菜单及页面职责骨架。"
        type="info"
        :closable="false"
        show-icon
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SALES_PAGES } from './catalog'
import SalesDashboard from './SalesDashboard.vue'
import SalesReviewQueue from './SalesReviewQueue.vue'
import SalesTrackComparison from './SalesTrackComparison.vue'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'dashboard'))
const definition = computed(() => SALES_PAGES[pageKey.value] || SALES_PAGES.dashboard)
const isReviewPage = computed(() => ['visit-reviews', 'exceptions-reviews'].includes(pageKey.value))
const isTrackPage = computed(() => pageKey.value === 'exceptions-location')
const isImplemented = computed(() => pageKey.value === 'dashboard' || isReviewPage.value || isTrackPage.value)

</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.sales-page { display: grid; gap: $spacing-lg; }
.page-header { display: flex; justify-content: space-between; gap: $spacing-lg; align-items: flex-start; }
.page-header h1 { margin: 4px 0 8px; font-size: 26px; }
.page-header p { max-width: 760px; margin: 0; color: $color-text-secondary; line-height: 1.7; }
.eyebrow { color: $color-primary !important; font-size: $font-size-xs; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, .75fr); gap: $spacing-md; }
.facts { display: grid; gap: 14px; margin: 0; }
.facts div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; }
.facts dt { color: $color-text-secondary; }
.facts dd { margin: 0; color: $color-text-primary; line-height: 1.6; }
.facts code { color: #0f766e; font-size: 12px; word-break: break-all; }
.constraint-list { display: grid; gap: 10px; margin: 0; padding-left: 20px; color: $color-text-regular; line-height: 1.6; }
@media (max-width: 760px) { .page-header { flex-direction: column; } .detail-grid { grid-template-columns: 1fr; } }
</style>
