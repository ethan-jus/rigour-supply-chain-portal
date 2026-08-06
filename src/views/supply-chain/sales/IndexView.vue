<template>
  <section class="sales-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">销售管理 · {{ definition.group }}</p>
        <h1>{{ definition.title }}</h1>
        <p>{{ definition.description }}</p>
      </div>
      <el-tag type="warning" effect="plain">页面骨架 · API待接入</el-tag>
    </header>

    <div v-if="pageKey === 'dashboard'" class="boundary-grid">
      <article v-for="item in boundaries" :key="item.title" class="boundary-card">
        <span>{{ item.step }}</span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.description }}</p>
      </article>
    </div>

    <div class="detail-grid">
      <el-card shadow="never">
        <template #header><strong>职责边界</strong></template>
        <dl class="facts">
          <div><dt>唯一主写</dt><dd>{{ definition.owner }}</dd></div>
          <div><dt>目标接口</dt><dd><code>{{ definition.api }}</code></dd></div>
          <div><dt>当前状态</dt><dd>IAM菜单、受控路由和Sales Work V1表结构已登记；业务查询与命令处理待实现。</dd></div>
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
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SALES_PAGES } from './catalog'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'dashboard'))
const definition = computed(() => SALES_PAGES[pageKey.value] || SALES_PAGES.dashboard)

const boundaries = [
  { step: '01', title: '飞书销售工作台', description: '销售本人在H5完成签到、定位、选择客户门店、拜访和录音。' },
  { step: '02', title: 'Sales Work', description: '主写销售打卡、工作日、拜访、证据、复核和日结候选。' },
  { step: '03', title: 'CRM与AI', description: 'CRM主写客户门店；AI提供录音分析建议，不直接处罚。' },
  { step: '04', title: 'HR与BI', description: 'HR主写正式考勤，BI形成门店覆盖、业绩和绩效快照。' },
]
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.sales-page { display: grid; gap: $spacing-lg; }
.page-header { display: flex; justify-content: space-between; gap: $spacing-lg; align-items: flex-start; }
.page-header h1 { margin: 4px 0 8px; font-size: 26px; }
.page-header p { max-width: 760px; margin: 0; color: $color-text-secondary; line-height: 1.7; }
.eyebrow { color: $color-primary !important; font-size: $font-size-xs; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.boundary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $spacing-md; }
.boundary-card { position: relative; min-height: 144px; padding: 20px; overflow: hidden; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.boundary-card span { color: $color-primary; font-size: 11px; font-weight: 700; }
.boundary-card h2 { margin: 18px 0 8px; font-size: $font-size-md; }
.boundary-card p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.6; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, .75fr); gap: $spacing-md; }
.facts { display: grid; gap: 14px; margin: 0; }
.facts div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; }
.facts dt { color: $color-text-secondary; }
.facts dd { margin: 0; color: $color-text-primary; line-height: 1.6; }
.facts code { color: #0f766e; font-size: 12px; word-break: break-all; }
.constraint-list { display: grid; gap: 10px; margin: 0; padding-left: 20px; color: $color-text-regular; line-height: 1.6; }
@media (max-width: 1100px) { .boundary-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .page-header { flex-direction: column; } .boundary-grid, .detail-grid { grid-template-columns: 1fr; } }
</style>
