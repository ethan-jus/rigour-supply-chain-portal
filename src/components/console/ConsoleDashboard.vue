<template>
  <section class="dashboard">
    <div class="dashboard__heading">
      <div>
        <h1>{{ greeting }}，{{ authStore.user?.displayName || '当前用户' }}</h1>
        <p>{{ todayText }} · 当前仅展示已接入且已授权的业务能力</p>
      </div>
      <span class="data-status" :class="{ 'data-status--pending': !isSupply }">
        <i />{{ isSupply ? '新业务主流程' : '数据接口未接入' }}
      </span>
    </div>

    <template v-if="isSupply">
      <article class="business-overview" aria-live="polite">
        <div class="business-overview__main">
          <span class="business-overview__eyebrow">供应链系统 · 当前落地范围</span>
          <h2>主业务按我方流程展示，订货宝只作为后台同步来源</h2>
          <p>
            ERP、CRM、订单、数据字典只承载新业务主流程；订货宝同步规则沉到后台映射链路，
            同步任务把数据写入我方新表，不再提供旧订货宝档案菜单。
          </p>
        </div>
        <div class="business-overview__rule">
          <span>当前原则</span>
          <strong>业务菜单看新表，外部同步看来源，页面不展示未落地动作</strong>
        </div>
      </article>

      <div class="business-progress">
        <article v-for="item in businessProgress" :key="item.title" class="business-progress__card">
          <div class="business-progress__header">
            <span>{{ item.domain }}</span>
            <strong>{{ item.title }}</strong>
          </div>
          <p>{{ item.description }}</p>
          <dl>
            <div>
              <dt>已接入</dt>
              <dd>{{ item.done }}</dd>
            </div>
            <div>
              <dt>下一步</dt>
              <dd>{{ item.next }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </template>

    <article v-else class="integration-empty" aria-live="polite">
      <div class="integration-empty__mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="7" />
          <path d="M15 30l6-6 5 4 7-9" />
          <path d="M15 17h8" />
        </svg>
      </div>
      <div class="integration-empty__content">
        <span class="integration-empty__eyebrow">{{ isSupply ? '供应链业务概览' : '平台运营概览' }}</span>
        <h2>{{ isSupply ? '供应链首页数据接口尚未接入' : '平台首页数据接口尚未接入' }}</h2>
        <p>
          当前页面不生成模拟指标，也不推断待办或最近动态。后端提供真实统计、趋势和待办接口后，
          这里再按当前账号权限展示可核对的数据。
        </p>
        <div class="integration-empty__scope">
          <span>当前可用</span>
          <strong>身份与页面权限</strong>
          <span>等待接入</span>
          <strong>统计、趋势、待办与动态</strong>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'

const route = useRoute()
const authStore = useAuthStore()
const isSupply = computed(() => route.meta.applicationCode === 'SUPPLY_CHAIN')
const greeting = computed(() => new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好')
const todayText = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const businessProgress = [
  {
    domain: 'ERP',
    title: '商品、采购、库存',
    description: '围绕我方商品库、供应商、采购订单、入库单、出库单、库存调拨和仓库信息组织菜单。',
    done: '商品管理、基础资料、供应商档案、采购订单、入库单、出库单、库存调拨、仓库信息',
    next: '订货宝商品、采购、库存数据映射到我方 ERP 新表',
  },
  {
    domain: 'CRM',
    title: '客户管理',
    description: '客户、商家、门店统一为客户管理，联系方式、归属销售、归属地区在客户内维护。',
    done: '客户新增、编辑、删除、详情、联系方式、归属信息',
    next: '订货宝客户资料映射到我方客户表',
  },
  {
    domain: 'Order',
    title: '销售订单',
    description: '订单主流程走我方销售订单接口，后续订货宝订单只作为来源映射到销售订单表。',
    done: '销售订单列表、保存、提交、编辑、详情、确认出库',
    next: '订货宝订单重新同步到我方销售订单表',
  },
  {
    domain: 'Dict',
    title: '数据字典',
    description: '字典主表与字典项统一支撑单位、类型、状态、支付方式等业务选项。',
    done: 'DATA_DICTIONARY、DATA_DICTIONARY_ITEM 业务页面',
    next: '补齐 ERP、CRM、Order 必需字典项和调用方 dictionaryCode',
  },
]
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.dashboard { width: 100%; max-width: 1200px; margin: 0 auto; }
.dashboard__heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
.dashboard__heading h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
.dashboard__heading p { margin: 7px 0 0; color: $color-text-secondary; font-size: $font-size-sm; }
.data-status { display: flex; gap: 7px; align-items: center; color: $color-success; font-size: $font-size-xs; }
.data-status i { width: 7px; height: 7px; background: $color-success; border-radius: 50%; }
.data-status--pending { color: #b45309; }
.data-status--pending i { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, .12); }
.business-overview { display: grid; margin-bottom: 18px; padding: 26px 28px; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; background: #fff; border: 1px solid #dbe5f2; border-radius: 18px; box-shadow: 0 14px 32px rgba(15, 23, 42, .05); }
.business-overview__eyebrow { color: $color-primary; font-size: $font-size-xs; font-weight: 700; letter-spacing: .08em; }
.business-overview h2 { margin: 8px 0 10px; color: $color-text-primary; font-size: 26px; line-height: 1.32; }
.business-overview p { max-width: 760px; margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.85; }
.business-overview__rule { display: grid; min-width: 280px; padding: 16px 18px; gap: 7px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; }
.business-overview__rule span { color: #2563eb; font-size: $font-size-xs; font-weight: 700; }
.business-overview__rule strong { color: $color-text-regular; font-size: $font-size-sm; line-height: 1.6; }
.business-progress { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.business-progress__card { display: grid; padding: 20px; gap: 14px; background: #fff; border: 1px solid #dbe5f2; border-radius: 16px; box-shadow: 0 10px 24px rgba(15, 23, 42, .045); }
.business-progress__header { display: flex; gap: 10px; align-items: center; }
.business-progress__header span { display: inline-flex; min-width: 48px; height: 28px; align-items: center; justify-content: center; color: $color-primary; font-size: $font-size-xs; font-weight: 800; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; }
.business-progress__header strong { color: $color-text-primary; font-size: 18px; }
.business-progress__card p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.75; }
.business-progress__card dl { display: grid; margin: 0; gap: 10px; }
.business-progress__card dl > div { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 10px; }
.business-progress__card dt { color: $color-text-placeholder; font-size: $font-size-xs; }
.business-progress__card dd { margin: 0; color: $color-text-regular; font-size: $font-size-sm; line-height: 1.65; }
.integration-empty { position: relative; display: grid; min-height: 440px; padding: clamp(28px, 5vw, 64px); overflow: hidden; grid-template-columns: auto minmax(0, 640px); align-content: center; justify-content: center; gap: clamp(24px, 4vw, 48px); background: linear-gradient(145deg, #fff 0%, #f8fbff 55%, #eff6ff 100%); border: 1px solid #dbeafe; border-radius: 18px; box-shadow: 0 18px 45px rgba(15, 23, 42, .06); }
.integration-empty::after { position: absolute; right: -90px; bottom: -110px; width: 260px; height: 260px; content: ''; background: radial-gradient(circle, rgba(37, 99, 235, .14), rgba(37, 99, 235, 0) 70%); }
.integration-empty__mark { display: grid; width: 92px; height: 92px; color: $color-primary; background: rgba(255, 255, 255, .88); border: 1px solid #bfdbfe; border-radius: 26px; box-shadow: 0 16px 35px rgba(37, 99, 235, .14); place-items: center; }
.integration-empty__mark svg { width: 52px; height: 52px; }
.integration-empty__mark rect, .integration-empty__mark path { stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.integration-empty__content { position: relative; z-index: 1; }
.integration-empty__eyebrow { color: $color-primary; font-size: $font-size-xs; font-weight: 700; letter-spacing: .1em; }
.integration-empty__content h2 { margin: 9px 0 12px; color: $color-text-primary; font-size: clamp(24px, 3vw, 32px); line-height: 1.25; }
.integration-empty__content p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.9; }
.integration-empty__scope { display: grid; margin-top: 28px; padding: 16px 18px; grid-template-columns: auto 1fr; gap: 8px 16px; background: rgba(255, 255, 255, .78); border: 1px solid rgba(191, 219, 254, .78); border-radius: 12px; }
.integration-empty__scope span { color: $color-text-placeholder; font-size: $font-size-xs; }
.integration-empty__scope strong { color: $color-text-regular; font-size: $font-size-sm; font-weight: 600; }
@media (max-width: 960px) { .business-overview { grid-template-columns: 1fr; } .business-progress { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .integration-empty { min-height: 380px; grid-template-columns: 1fr; justify-items: start; } }
@media (max-width: 520px) { .dashboard__heading { align-items: flex-start; flex-direction: column; gap: 12px; } }
</style>
