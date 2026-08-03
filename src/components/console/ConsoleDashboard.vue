<template>
  <section class="dashboard">
    <div class="dashboard__heading">
      <div>
        <h1>{{ greeting }}，{{ authStore.user?.displayName || '当前用户' }}</h1>
        <p>{{ todayText }} · 数据按当前账号权限展示</p>
      </div>
      <span class="data-status"><i />实时权限</span>
    </div>

    <div class="metrics">
      <article v-for="metric in metrics" :key="metric.label" class="metric">
        <span class="metric__label">{{ metric.label }}</span>
        <strong class="metric__value">{{ metric.value }}</strong>
        <span class="metric__hint">{{ metric.hint }}</span>
        <svg class="metric__spark" viewBox="0 0 100 30" fill="none" aria-hidden="true">
          <path :d="metric.path" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </article>
    </div>

    <div class="dashboard__grid">
      <article class="panel trend-panel">
        <div class="panel__header"><div><h2>{{ isSupply ? '近30天订单趋势' : '运营活动趋势' }}</h2><p>业务数据接入后自动更新</p></div><button class="period">近30天⌄</button></div>
        <div class="chart-empty">
          <svg viewBox="0 0 680 240" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path d="M0 40H680M0 100H680M0 160H680M0 220H680" stroke="#e2e8f0" stroke-dasharray="3 5" />
            <path d="M0 220H680" stroke="#cbd5e1" />
          </svg>
          <span>暂无可展示的数据</span>
        </div>
      </article>

      <div class="dashboard__side">
        <article class="panel todo-panel">
          <div class="panel__header"><h2>待办事项</h2><a href="#">查看全部 →</a></div>
          <div class="todo-empty"><span class="todo-empty__icon">✓</span><p>当前没有待处理事项</p><small>新的审批和任务会显示在这里</small></div>
        </article>
        <article class="panel quick-panel">
          <div class="panel__header"><h2>快捷操作</h2></div>
          <div class="quick-actions">
            <button v-for="action in quickActions" :key="action" type="button"><span>{{ action.slice(0, 1) }}</span>{{ action }}</button>
          </div>
        </article>
      </div>
    </div>

    <article class="panel activity-panel">
      <div class="panel__header"><h2>最近动态</h2><span class="muted">暂无记录</span></div>
      <div class="activity-empty">完成业务操作后，最近动态会显示在这里</div>
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
const metrics = computed(() => isSupply.value
  ? [
      { label: '今日订单金额', value: '—', hint: '等待订单服务接入', path: 'M0 22C12 22 12 12 24 16s12 5 24-2 12 9 24 3 13 3 28-9' },
      { label: '本月业绩', value: '—', hint: '等待业绩数据接入', path: 'M0 20c10-8 18 4 28-3s16-8 26 1 18-2 25-8 13 5 21-3' },
      { label: '活跃客户', value: '—', hint: '等待客户服务接入', path: 'M0 24c12-3 15-13 27-8s18 5 27-3 13 8 22 3 14-7 24-12' },
      { label: '待办审批', value: '—', hint: '等待审批服务接入', path: 'M0 10c11 5 18-1 27 4s16 2 25 6 14-4 22-1 13 7 26 1' },
    ]
  : [
      { label: '平台租户', value: '—', hint: '等待租户数据接入', path: 'M0 22c12-7 16-7 28-1s14-11 26-7 14 1 24-5 12 4 22-5' },
      { label: '应用目录', value: '—', hint: '按权限实时计算', path: 'M0 18c12 0 16-10 28-5s16-2 26 3 16 2 24-6 13 4 22-2' },
      { label: '授权用户', value: '—', hint: '等待用户数据接入', path: 'M0 24c12-2 16-11 26-7s17 6 26-2 14 4 24 0 14-10 24-12' },
      { label: '待办审计', value: '—', hint: '暂无待处理事项', path: 'M0 8c12 6 18 1 28 7s15-2 25 1 16 6 24-2 14 2 23-5' },
    ])
const quickActions = computed(() => isSupply.value ? ['新建订单', '新增客户', '邀请成员', '数据报表'] : ['新建租户', '新增用户', '配置应用', '查看审计'])
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.dashboard { max-width: 1200px; margin: 0 auto; }
.dashboard__heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
.dashboard__heading h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
.dashboard__heading p { margin: 7px 0 0; color: $color-text-secondary; font-size: $font-size-sm; }
.data-status { display: flex; gap: 7px; align-items: center; color: $color-success; font-size: $font-size-xs; }
.data-status i { width: 7px; height: 7px; background: $color-success; border-radius: 50%; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $spacing-md; margin-bottom: $spacing-md; }
.metric { position: relative; min-height: 136px; padding: 20px; overflow: hidden; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.metric__label { display: block; color: $color-text-secondary; font-size: $font-size-sm; }
.metric__value { display: block; margin-top: 14px; color: $color-text-primary; font-size: 27px; font-weight: 600; letter-spacing: -.02em; }
.metric__hint { display: block; margin-top: 9px; color: $color-text-placeholder; font-size: $font-size-xs; }
.metric__spark { position: absolute; right: 16px; bottom: 17px; width: 78px; height: 28px; color: rgba(37,99,235,.65); }
.dashboard__grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr); gap: $spacing-md; }
.dashboard__side { display: grid; gap: $spacing-md; grid-template-rows: 1fr auto; }
.panel { padding: 20px; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.panel__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.panel__header h2 { margin: 0; font-size: $font-size-md; font-weight: 600; }
.panel__header p, .muted { margin: 6px 0 0; color: $color-text-placeholder; font-size: $font-size-xs; }
.panel__header a { color: $color-primary; font-size: $font-size-xs; text-decoration: none; }
.period { padding: 5px 9px; color: $color-text-secondary; background: #fff; border: 1px solid $color-border-base; border-radius: 6px; font: inherit; font-size: $font-size-xs; }
.chart-empty { position: relative; display: grid; min-height: 248px; color: $color-text-placeholder; place-items: center; }
.chart-empty svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.chart-empty span { position: relative; z-index: 1; padding: 8px 12px; background: rgba(255,255,255,.9); border-radius: 6px; font-size: $font-size-sm; }
.todo-empty { display: grid; min-height: 138px; justify-items: center; align-content: center; color: $color-text-secondary; text-align: center; }
.todo-empty__icon { display: grid; width: 32px; height: 32px; margin-bottom: 10px; color: $color-success; background: #ecfdf5; border-radius: 50%; font-size: 18px; place-items: center; }
.todo-empty p { margin: 0; font-size: $font-size-sm; }.todo-empty small { margin-top: 5px; color: $color-text-placeholder; font-size: $font-size-xs; }
.quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.quick-actions button { display: flex; gap: 7px; align-items: center; height: 38px; padding: 0 10px; color: $color-text-regular; background: #fff; border: 1px solid $color-border-base; border-radius: 7px; font: inherit; font-size: $font-size-xs; cursor: pointer; }
.quick-actions button:hover { color: $color-primary; border-color: rgba(37,99,235,.5); background: #eff6ff; }.quick-actions span { display: grid; width: 20px; height: 20px; color: $color-primary; background: #eff6ff; border-radius: 5px; font-size: 11px; place-items: center; }
.activity-panel { margin-top: $spacing-md; }.activity-empty { display: grid; min-height: 55px; color: $color-text-placeholder; background: $color-bg-base; border-radius: 7px; font-size: $font-size-sm; place-items: center; }
@media (max-width: 900px) { .metrics { grid-template-columns: repeat(2, 1fr); } .dashboard__grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .metrics { grid-template-columns: 1fr; } .dashboard__heading { align-items: flex-start; flex-direction: column; gap: 12px; } }
</style>
