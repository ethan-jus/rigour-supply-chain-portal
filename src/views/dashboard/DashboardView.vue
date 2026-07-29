<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col v-for="stat in stats" :key="stat.label" :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value">
            {{ stat.value }}
          </div>
          <div class="stat-label">
            {{ stat.label }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="welcome-card" shadow="hover">
      <h3>欢迎回来，{{ userName }}</h3>
      <p class="welcome-text">
        今日运营数据将在业务服务接入后按权限汇总展示。
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores'

const authStore = useAuthStore()
const userName = computed(() => authStore.user?.displayName || '用户')

const stats = [
  { label: '今日订单', value: '—' },
  { label: '本月业绩', value: '—' },
  { label: '待处理', value: '—' },
  { label: '预警事项', value: '—' },
]
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;
.dashboard {
  .stat-card {
    text-align: center;
    margin-bottom: 16px;

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: $color-primary;
    }

    .stat-label {
      font-size: 13px;
      color: $color-text-secondary;
      margin-top: 4px;
    }
  }

  .welcome-card {
    margin-top: 16px;

    h3 {
      font-size: 18px;
      margin-bottom: 12px;
    }

    .welcome-text {
      color: $color-text-regular;
      line-height: 1.6;
    }
  }
}
</style>
