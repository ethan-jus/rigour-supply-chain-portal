<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const configuredUrl = (import.meta.env.VITE_FEISHU_SALES_WORKBENCH_URL || '').trim()
const targetUrl = computed(() => resolveWorkbenchUrl(configuredUrl))

const launchState = computed(() => {
  if (!targetUrl.value) return { ready: false, text: '尚未配置飞书H5地址' }
  try {
    const target = new URL(targetUrl.value)
    const local = import.meta.env.DEV && target.protocol === 'http:' && isLoopbackOrPrivateHost(target.hostname)
    if (target.protocol === 'https:' || local) return { ready: true, text: '移动工作台入口已就绪' }
  } catch {
    // 统一返回不可启动状态，不把无效地址交给window.open。
  }
  return { ready: false, text: '飞书H5地址配置无效' }
})

function openWorkbench(): void {
  if (!launchState.value.ready) {
    ElMessage.warning('请先配置飞书销售工作台地址')
    return
  }
  window.open(targetUrl.value, '_blank', 'noopener,noreferrer')
}

function resolveWorkbenchUrl(value: string): string {
  if (!value) return ''
  try {
    const target = new URL(value)
    const currentHost = window.location.hostname
    const isLocalDevTarget = import.meta.env.DEV && target.protocol === 'http:' && isLoopbackHost(target.hostname)
    if (isLocalDevTarget && isPrivateIpv4Host(currentHost)) {
      // Portal与工作台运行在同一台开发机时，局域网设备不能把localhost解析成自己。
      // 仅替换开发环境的loopback工作台地址；生产HTTPS地址保持配置原值。
      target.hostname = currentHost
    }
    return target.toString()
  } catch {
    return ''
  }
}

function isLoopbackHost(host: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(host)
}

function isLoopbackOrPrivateHost(host: string): boolean {
  return isLoopbackHost(host) || isPrivateIpv4Host(host)
}

function isPrivateIpv4Host(host: string): boolean {
  const segments = host.split('.')
  if (segments.length !== 4 || segments.some((segment) => !/^\d+$/.test(segment))) return false
  const octets = segments.map(Number)
  if (octets.some((octet) => octet < 0 || octet > 255)) return false
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
}
</script>

<template>
  <main class="launch-page">
    <header class="launch-header">
      <button type="button" class="back-button" @click="router.push('/apps')">返回应用门户</button>
      <span class="header-label">销售移动作业入口</span>
    </header>

    <section class="launch-content">
      <div class="intro-panel">
        <div class="intro-copy">
          <span class="eyebrow">FEISHU SALES WORKBENCH</span>
          <h1>飞书销售工作台</h1>
          <p>面向一线销售的移动H5，用于本人签到、定位、选择客户门店、执行拜访和采集录音证据。</p>
          <div class="launch-status" :class="{ 'launch-status--ready': launchState.ready }">
            <span class="status-dot" />
            {{ launchState.text }}
          </div>
          <el-button type="primary" size="large" :disabled="!launchState.ready" @click="openWorkbench">
            打开移动工作台
          </el-button>
        </div>

        <div class="mobile-outline" aria-label="移动工作台功能范围">
          <div class="mobile-outline__top">
            <span>今日工作</span>
            <strong>销售本人</strong>
          </div>
          <div class="capability-list">
            <article><span>01</span><div><strong>外勤考勤</strong><p>签到、签退与定位状态</p></div></article>
            <article><span>02</span><div><strong>客户门店</strong><p>读取CRM有效归属</p></div></article>
            <article><span>03</span><div><strong>拜访执行</strong><p>到店、录音、照片与备注</p></div></article>
            <article><span>04</span><div><strong>我的记录</strong><p>轨迹、拜访和证据状态</p></div></article>
          </div>
        </div>
      </div>

      <div class="boundary-grid">
        <article>
          <strong>飞书H5负责</strong>
          <p>销售本人移动现场执行，不提供团队监管和规则发布。</p>
        </article>
        <article>
          <strong>供应链销售管理负责</strong>
          <p>主管查看团队外勤、拜访、异常复核与规则配置。</p>
        </article>
        <article>
          <strong>数据主权</strong>
          <p>Sales Work主写过程事实，CRM主写门店，HR主写正式考勤。</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.launch-page {
  min-height: 100vh;
  color: $color-text-primary;
  background: #f5f7fb;
}

.launch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 40px;
  background: #fff;
  border-bottom: 1px solid $color-border-light;
}

.back-button {
  padding: 0;
  color: $color-text-secondary;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.header-label {
  color: $color-text-placeholder;
  font-size: 13px;
}

.launch-content {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 56px 0;
}

.intro-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 72px;
  align-items: center;
  padding: 56px 64px;
  background: linear-gradient(135deg, #fff 0%, #f1f6ff 100%);
  border: 1px solid $color-border-light;
  border-radius: 24px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
}

.eyebrow {
  color: $color-primary;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

h1 {
  margin: 14px 0 18px;
  font-size: 38px;
  line-height: 1.2;
}

.intro-copy > p {
  max-width: 560px;
  margin: 0 0 28px;
  color: $color-text-secondary;
  font-size: 16px;
  line-height: 1.8;
}

.launch-status {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 24px;
  color: $color-text-placeholder;
  font-size: 13px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #94a3b8;
  border-radius: 50%;
}

.launch-status--ready {
  color: #15803d;

  .status-dot { background: #22c55e; }
}

.mobile-outline {
  padding: 22px;
  background: #0b1424;
  border-radius: 28px;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.24);
}

.mobile-outline__top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
  color: #fff;

  span { font-size: 18px; font-weight: 700; }
  strong { color: #93c5fd; font-size: 12px; }
}

.capability-list {
  display: grid;
  gap: 10px;
}

.capability-list article {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;

  > span { color: #60a5fa; font-size: 12px; font-weight: 700; }
  strong { color: #fff; }
  p { margin: 3px 0 0; color: #94a3b8; font-size: 12px; }
}

.boundary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.boundary-grid article {
  padding: 22px;
  background: #fff;
  border: 1px solid $color-border-light;
  border-radius: 16px;

  strong { font-size: 15px; }
  p { margin: 8px 0 0; color: $color-text-secondary; line-height: 1.7; }
}

@media (max-width: 800px) {
  .launch-header { padding: 0 20px; }
  .launch-content { width: min(100% - 28px, 620px); padding: 24px 0; }
  .intro-panel { grid-template-columns: 1fr; gap: 36px; padding: 32px 24px; }
  h1 { font-size: 30px; }
  .boundary-grid { grid-template-columns: 1fr; }
}
</style>
