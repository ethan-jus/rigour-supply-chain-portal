<template>
  <el-card><template #header><strong>IAM管理审计</strong></template><el-table :data="items"><el-table-column prop="occurredAt" label="时间" min-width="180"/><el-table-column prop="actorScope" label="主体范围"/><el-table-column prop="action" label="操作" min-width="180"/><el-table-column prop="targetType" label="目标类型"/><el-table-column prop="targetId" label="目标ID" min-width="220"/><el-table-column prop="result" label="结果"/></el-table></el-card>
</template>
<script setup lang="ts">import{onMounted,ref}from'vue';import{apiClient}from'@/api';import type{AuditRecord}from'@/types/management';const items=ref<AuditRecord[]>([]);onMounted(async()=>{items.value=(await apiClient.get('/management/audits?limit=100')) as AuditRecord[]})</script>
