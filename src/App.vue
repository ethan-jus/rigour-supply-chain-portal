<template>
  <el-config-provider :locale="zhCn">
    <router-view />
    <RequestFailureNotice />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import RequestFailureNotice from '@/components/RequestFailureNotice.vue'
</script>

<style lang="scss">
@use '@/assets/styles/index';
</style>
