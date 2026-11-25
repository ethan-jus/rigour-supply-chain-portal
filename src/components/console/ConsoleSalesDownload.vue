<template>
  <el-popover
    ref="popover"
    trigger="click"
    placement="bottom"
    role="dialog"
    aria-labelledby="sales-download-title"
    width="min(540px, calc(100vw - 24px))"
    :offset="8"
    @before-enter="refresh"
  >
    <template #reference>
      <el-button
        text
        class="download-trigger"
        :icon="Iphone"
        aria-label="下载销售工作台"
        title="下载销售工作台"
      >
        <span class="trigger-label">下载销售工作台</span>
      </el-button>
    </template>
    <div class="download-heading">
      <img src="/downloads/sales/icon.png" alt="" width="32" height="32" />
      <h2 id="sales-download-title">下载销售工作台</h2>
      <el-button text circle :icon="Close" aria-label="关闭下载面板" @click="popover?.hide()" />
    </div>
    <p v-if="loading" role="status">正在读取版本…</p>
    <div v-else-if="failed" role="alert">
      下载信息暂时无法加载。<el-button link type="primary" @click="refresh">重试</el-button>
    </div>
    <div v-else class="download-platforms">
      <section v-for="platform in platforms" :key="platform.id" class="platform">
        <h3>{{ platform.name }}</h3>
        <small>{{ platform.method }}</small>
        <template v-if="releases[platform.id]">
          <div
            v-if="scanLink(platform.id)"
            class="qr"
            role="img"
            :aria-label="platform.name + ' 安装二维码'"
          >
            <QrcodeSvg :value="scanLink(platform.id)" :size="144" :margin="4" level="M" />
          </div>
          <p v-else>请通过局域网地址打开本系统后扫码</p>
          <small>版本 {{ releases[platform.id]?.version }}</small>
          <a
            :href="releases[platform.id]?.url"
            :download="platform.id === 'android' ? '' : undefined"
            >下载安装</a
          >
        </template>
        <p v-else class="unavailable">暂未开放</p>
      </section>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PopoverInstance } from 'element-plus'
import { Close, Iphone } from '@element-plus/icons-vue'
import { QrcodeSvg } from 'qrcode.vue'
import { loadReleases, platforms, scanLink, type Releases } from '@/utils/sales-downloads'

const popover = ref<PopoverInstance>()
const loading = ref(false)
const failed = ref(false)
const releases = ref<Releases>({})
async function refresh() {
  if (loading.value) return
  loading.value = true
  failed.value = false
  try {
    releases.value = await loadReleases()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.download-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.download-heading h2 {
  flex: 1;
  margin: 0;
  font-size: 16px;
}
.download-heading img {
  border-radius: 8px;
}
.download-platforms {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.platform {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 16px 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  text-align: center;
}
.platform h3 {
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}
.platform small,
.unavailable {
  color: var(--el-text-color-secondary);
}
.qr {
  margin: 10px 0 4px;
  background: white;
  line-height: 0;
}
.platform a {
  margin-top: 8px;
  color: var(--el-color-primary);
}
.unavailable {
  margin: auto 0;
  padding: 14px 0;
}
@media (max-width: 680px) {
  .trigger-label {
    display: none;
  }
  .download-trigger {
    padding-inline: 6px;
  }
  .download-trigger :deep(.el-icon + span) {
    display: none;
  }
  .download-platforms {
    grid-template-columns: 1fr;
    max-height: 68dvh;
    overflow-y: auto;
  }
}
</style>
