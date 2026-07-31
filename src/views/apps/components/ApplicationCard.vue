<template>
  <button class="application-card" type="button" :aria-label="`进入${application.name}`" @click="$emit('launch')">
    <span class="application-card__top"><span class="application-card__icon">{{ application.name.slice(0, 1) }}</span><span class="mode">{{ modeLabel }}</span></span>
    <span class="application-card__copy"><strong>{{ application.name }}</strong><small>{{ application.code }}</small></span>
    <span class="application-card__action">进入应用 <b aria-hidden="true">→</b>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalApplication } from '@/types/application'
const props = defineProps<{ application: PortalApplication }>()
defineEmits<{ launch: [] }>()
const modeLabel = computed(() => ({
  INTERNAL_ROUTE: '门户内应用', OIDC_CLIENT: '单点登录', EXTERNAL_URL: '外部应用',
  FEISHU_DEEPLINK: '飞书应用', SSO_PROVIDER: '企业 SSO',
}[props.application.launchMode]))
</script>

<style scoped lang="scss">
.application-card { display:flex;flex-direction:column;min-height:180px;padding:22px;text-align:left;color:#17233b;background:white;border:1px solid #e5ebf2;border-radius:17px;box-shadow:0 5px 16px rgb(26 55 91 / 4%);cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease; }
.application-card:hover{border-color:#8ab7de;box-shadow:0 16px 30px rgb(25 78 130 / 12%);transform:translateY(-3px)}.application-card:focus-visible{outline:3px solid rgb(42 117 181 / 25%);outline-offset:3px}.application-card__top{display:flex;justify-content:space-between;align-items:center}.application-card__icon{display:grid;width:50px;height:50px;color:white;background:linear-gradient(145deg,#1b5792,#2779ba);border-radius:14px;font-size:21px;font-weight:800;place-items:center}.mode{padding:5px 9px;color:#54718f;background:#f0f5fa;border-radius:999px;font-size:10px}.application-card__copy{display:grid;gap:5px;margin-top:19px}.application-card__copy strong{font-size:17px}.application-card__copy small{color:#8a97a8;font-size:11px;letter-spacing:.04em}.application-card__action{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:18px;color:#246aa8;font-size:13px;font-weight:700}.application-card__action b{font-size:18px;font-weight:400;transition:transform .2s}.application-card:hover b{transform:translateX(4px)}
</style>
