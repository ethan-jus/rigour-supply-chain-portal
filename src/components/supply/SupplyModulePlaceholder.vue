<template>
  <section class="unavailable-page" :aria-label="title">
    <SupplyPageTitle>{{ title }}</SupplyPageTitle>
    <el-empty description="当前页面尚未开放">
      <router-link to="/supply-chain">返回供应链首页</router-link>
    </el-empty>
  </section>
</template>

<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
defineProps<{ title: string; description?: string; note?: string }>()
</script>

<style scoped lang="scss">
.unavailable-page {
  padding: 20px;
}
h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0;
}
a {
  color: #2563eb;
  text-underline-offset: 4px;
}
a:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 4px;
}
</style>
