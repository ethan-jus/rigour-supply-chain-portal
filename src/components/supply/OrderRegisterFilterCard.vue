<template>
  <el-card class="filter-card order-register-filter" shadow="never">
    <form class="order-register-filter__form" aria-label="查询条件" @submit.prevent="emit('search')">
      <div class="order-register-filter__line order-register-filter__line--primary">
        <div class="order-register-filter__fields">
          <slot name="primary" />
        </div>
        <div class="order-register-filter__actions">
          <slot name="actions" />
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="emit('reset')">重置</el-button>
          <el-button
            v-if="$slots.extra"
            text
            type="primary"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? '收起' : '展开' }}
            <el-icon class="el-icon--right">
              <ArrowUp v-if="expanded" />
              <ArrowDown v-else />
            </el-icon>
          </el-button>
        </div>
      </div>
      <div
        v-if="$slots.extra"
        v-show="expanded"
        class="order-register-filter__line order-register-filter__line--extra"
      >
        <slot name="extra" />
      </div>
    </form>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'

defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ search: []; reset: [] }>()
const expanded = ref(false)
</script>

<style scoped>
.order-register-filter__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.order-register-filter__line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.order-register-filter__line--primary {
  justify-content: space-between;
}
.order-register-filter__fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.order-register-filter__line--extra {
  padding-top: 2px;
  border-top: 1px dashed var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.order-register-filter__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}
</style>
