<template>
  <Teleport to="body">
    <aside class="request-failure-notices" aria-label="系统错误提示" aria-live="assertive">
      <section v-for="notice in requestFailureNotices" :key="notice.id" class="request-failure" role="alert">
        <div class="request-failure-heading">
          <strong>请求未完成<span v-if="notice.count > 1">（{{ notice.count }} 次）</span></strong>
          <button type="button" aria-label="关闭错误提示" @click="dismissRequestFailure(notice.id)">×</button>
        </div>
        <p>{{ notice.message }}</p>
        <details v-if="notice.requestId"><summary>问题追踪编号</summary><code>{{ notice.requestId }}</code></details>
      </section>
    </aside>
  </Teleport>
</template>

<script setup lang="ts">
import { requestFailureNotices, dismissRequestFailure } from '@/utils/request-feedback'
</script>

<style scoped>
.request-failure-notices { position: fixed; z-index: 2147483000; top: 16px; right: 16px; width: min(420px, calc(100vw - 32px)); pointer-events: none; }
.request-failure { background: #fff; color: #303133; border: 1px solid #f1b9b9; border-left: 4px solid #c45656; border-radius: 8px; box-shadow: 0 4px 18px #0002; padding: 12px 16px; margin-bottom: 10px; pointer-events: auto; overflow-wrap: anywhere; }
.request-failure-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #b42318; }
.request-failure-heading button { border: 0; background: transparent; font-size: 24px; cursor: pointer; color: #606266; line-height: 1; padding: 4px; }
.request-failure p { margin: 8px 0 0; line-height: 1.6; }
.request-failure details { margin-top: 8px; font-size: 12px; color: #606266; }
.request-failure summary { cursor: pointer; }
</style>
