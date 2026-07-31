<template>
  <el-card><h1>{{ title }}</h1><p>应用、菜单、用户、角色和数据范围均由IAM真实数据库驱动。</p></el-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const title = computed(() => route.meta.applicationCode === 'PLATFORM_ADMIN' ? '平台管理中心' : '租户系统管理')
</script>
