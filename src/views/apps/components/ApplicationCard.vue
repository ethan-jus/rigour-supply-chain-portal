<template>
  <button class="application-card" type="button" :aria-label="`进入${application.name}`" @click="$emit('launch')">
    <span class="artwork" :class="`artwork--${theme.key}`" aria-hidden="true">
      <svg viewBox="0 0 180 190" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round">
        <!-- 平台管理中心：网格与节点 -->
        <g v-if="theme.key === 'admin'">
          <path d="M30 40h120M30 80h120M30 120h120M60 20v140M120 20v140" opacity=".35" />
          <circle cx="60" cy="80" r="7" /><circle cx="120" cy="40" r="7" />
          <circle cx="120" cy="120" r="7" /><circle cx="90" cy="150" r="5" opacity=".6" />
          <path d="M67 80h46M113 47l-46 66" opacity=".8" />
        </g>
        <!-- 供应链系统：仓储与干线 -->
        <g v-else-if="theme.key === 'supply'">
          <path d="M28 78 62 52l34 26v54H28z" /><path d="M44 132v-30h36v30" opacity=".7" />
          <path d="M108 96h34l10 16v20h-44z" /><circle cx="118" cy="136" r="6" /><circle cx="142" cy="136" r="6" />
          <path d="M62 158c30 10 60 10 90-4" stroke-dasharray="4 6" opacity=".6" />
        </g>
        <!-- 订货宝商城：商店 -->
        <g v-else-if="theme.key === 'mall'">
          <path d="M40 66h100l-8-22H48z" /><path d="M40 66v14a10 10 0 0 0 20 0V66a10 10 0 0 0 20 0V66a10 10 0 0 0 20 0V66a10 10 0 0 0 20 0V66a10 10 0 0 0 20 0V66" opacity=".85" />
          <path d="M48 94v52h84V94" /><path d="M76 146v-32h28v32" opacity=".7" />
          <path d="M118 112h14M118 124h14" opacity=".55" />
        </g>
        <!-- 销售工作台：地图与路线 -->
        <g v-else-if="theme.key === 'sales'">
          <path d="M36 52 72 40l36 12 36-12v88l-36 12-36-12-36 12z" opacity=".5" />
          <path d="M72 40v88M108 52v88" opacity=".35" />
          <path d="M56 128c22-26 46-30 68-56" stroke-dasharray="4 6" />
          <path d="M124 52a14 14 0 1 0-14 14l14 18 14-18a14 14 0 0 0-14-14z" transform="translate(-8 -14)" />
          <circle cx="116" cy="38" r="4" />
        </g>
        <!-- 默认：抽象网格 -->
        <g v-else>
          <rect x="40" y="46" width="100" height="100" rx="10" opacity=".5" />
          <path d="M40 80h100M40 113h100M73 46v100M107 46v100" opacity=".35" />
          <circle cx="90" cy="96" r="9" />
        </g>
      </svg>
    </span>
    <span class="application-card__body">
      <span class="application-card__head">
        <strong>{{ application.name }}</strong>
        <span v-if="modeTag" class="tag" :class="`tag--${theme.key}`">{{ modeTag }}</span>
      </span>
      <small>{{ theme.description }}</small>
      <span class="application-card__footer">
        <span class="authorized">已授权</span>
        <span class="enter">进入 <b aria-hidden="true">→</b></span>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalApplication } from '@/types/application'

const props = defineProps<{ application: PortalApplication }>()
defineEmits<{ launch: [] }>()

interface CardTheme { key: string; description: string }

const THEMES: Record<string, CardTheme> = {
  PLATFORM_ADMIN: { key: 'admin', description: '统一门户管理、系统设置与权限策略' },
  SYSTEM_ADMIN: { key: 'admin', description: '租户内的组织、用户、角色与菜单管理' },
  SUPPLY_CHAIN: { key: 'supply', description: '订单 · 商品 · 库存 · 客户' },
  SALES_WORKBENCH: { key: 'sales', description: '拜访打卡 · 业绩看板 · 飞书端作业' },
}

const theme = computed<CardTheme>(() => {
  const byCode = THEMES[props.application.code]
  if (byCode) return byCode
  if (props.application.code.includes('DHB')) {
    return { key: 'mall', description: '第三方商城 · 数据同步 · 免密进入' }
  }
  if (props.application.launchMode === 'FEISHU_DEEPLINK') {
    return { key: 'sales', description: '移动作业 · 飞书端应用' }
  }
  return { key: 'default', description: props.application.code }
})

const modeTag = computed(() => ({
  INTERNAL_ROUTE: '', OIDC_CLIENT: '单点登录', EXTERNAL_URL: '第三方',
  FEISHU_DEEPLINK: '飞书应用', SSO_PROVIDER: '企业 SSO',
}[props.application.launchMode]))
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.application-card {
  display: flex;
  min-height: 190px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  font: inherit;
  color: $color-text-primary;
  background: $color-bg-white;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-xl;
  cursor: pointer;
  transition: border-color $transition-fast, box-shadow $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba(37, 99, 235, 0.4);
    box-shadow: $shadow-lg;
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 2px;
  }
}

.artwork {
  display: grid;
  flex: 0 0 38%;
  place-items: center;

  svg {
    width: 78%;
    max-width: 170px;
    height: auto;
  }

  &--admin {
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(150deg, #0b1220, #1e293b);
  }

  &--supply {
    color: rgba(255, 255, 255, 0.92);
    background: linear-gradient(150deg, #0f766e, #14b8a6);
  }

  &--mall {
    color: rgba(255, 255, 255, 0.92);
    background: linear-gradient(150deg, #b45309, #f59e0b);
  }

  &--sales {
    color: rgba(255, 255, 255, 0.92);
    background: linear-gradient(150deg, #047857, #34d399);
  }

  &--default {
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(150deg, #334155, #64748b);
  }
}

.application-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 22px 22px 0;
}

.application-card__head {
  display: flex;
  gap: 10px;
  align-items: center;

  strong {
    font-size: 16px;
    font-weight: 600;
  }
}

.tag {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 999px;

  &--mall {
    color: #b45309;
    background: #fef3c7;
  }

  &--sales {
    color: #047857;
    background: #d1fae5;
  }

  &--admin,
  &--supply,
  &--default {
    color: $color-text-secondary;
    background: $color-bg-muted;
  }
}

.application-card__body > small {
  margin-top: 8px;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.6;
}

.application-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding: 14px 0 16px;
  border-top: 1px solid $color-border-lighter;

  .authorized {
    color: $color-text-placeholder;
    font-size: $font-size-xs;
  }

  .enter {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    color: $color-primary;
    font-size: $font-size-sm;
    font-weight: 500;

    b {
      font-weight: 400;
      transition: transform $transition-fast;
    }
  }
}

.application-card:hover .enter b {
  transform: translateX(4px);
}

@media (max-width: 520px) {
  .application-card {
    flex-direction: column;
  }

  .artwork {
    flex-basis: 110px;

    svg {
      max-height: 100px;
    }
  }
}
</style>
