<template>
  <section class="dashboard" aria-label="业务首页">
    <header class="dashboard__heading">
      <div>
        <SupplyPageTitle>{{ title }}</SupplyPageTitle>
        <p>{{ authStore.user?.displayName || '当前用户' }} · {{ todayText }}</p>
      </div>
      <el-input
        v-model="keyword"
        class="dashboard__search"
        :prefix-icon="Search"
        placeholder="搜索业务入口"
        aria-label="搜索业务入口"
        clearable
        :disabled="!ready"
      />
    </header>

    <div v-if="loading" class="dashboard__state" role="status" aria-live="polite">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在加载业务入口</span>
    </div>
    <div v-else-if="!ready" class="dashboard__state" :role="error ? 'alert' : 'status'">
      <span>{{ error || '业务入口尚未加载' }}</span>
      <el-button :icon="Refresh" :disabled="!applicationCode" @click="retryNavigation"
        >重新加载</el-button
      >
    </div>
    <div v-else-if="!groups.length" class="dashboard__state" role="status">
      <span>暂无已授权的业务入口</span>
      <el-button :icon="Refresh" @click="retryNavigation">重新加载</el-button>
    </div>
    <div v-else-if="!filteredGroups.length" class="dashboard__state" role="status">
      <span>没有匹配的业务入口</span>
      <el-button link @click="keyword = ''">清空搜索</el-button>
    </div>
    <nav v-else aria-label="已授权业务入口">
      <section
        v-for="group in filteredGroups"
        :key="group.id"
        class="entry-group"
        :aria-label="group.name"
      >
        <h2><ConsoleNavIcon :icon-key="group.iconKey" />{{ group.name }}</h2>
        <ul>
          <li v-for="entry in group.entries" :key="entry.path">
            <router-link :to="entry.path" class="entry-link">
              <ConsoleNavIcon :icon-key="entry.iconKey" />
              <span class="entry-link__text">
                <span>{{ entry.name }}</span>
                <small v-if="entry.context">{{ entry.context }}</small>
              </span>
              <el-icon class="entry-link__arrow"><ArrowRight /></el-icon>
            </router-link>
          </li>
        </ul>
      </section>
    </nav>
  </section>
</template>

<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Loading, Refresh, Search } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import type { NavigationNode } from '@/types/management'
import ConsoleNavIcon from './ConsoleNavIcon.vue'

interface Entry {
  name: string
  path: string
  iconKey: string | null
  context: string
}
interface EntryGroup {
  id: string
  name: string
  iconKey: string | null
  entries: Entry[]
}

const route = useRoute()
const authStore = useAuthStore()
const navigationStore = useNavigationStore()
const applicationCode = computed(() => String(route.meta.applicationCode || ''))
const title = '工作首页'
const todayText = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const keyword = ref('')
const pending = reactive<Record<string, number>>({})
const errors = reactive<Record<string, string>>({})
const requestNumbers: Record<string, number> = {}
const loading = computed(() => (pending[applicationCode.value] || 0) > 0)
const error = computed(() => errors[applicationCode.value] || '')
const ready = computed(
  () => !loading.value && !error.value && navigationStore.isLoaded(applicationCode.value),
)

// Shell owns the initial fetch; observe the same action so retry never overlaps it.
const stopObserving = navigationStore.$onAction(({ name, args, after, onError }) => {
  if (name !== 'fetchNavigation') return
  const code = String(args[0])
  const request = (requestNumbers[code] || 0) + 1
  requestNumbers[code] = request
  pending[code] = (pending[code] || 0) + 1
  errors[code] = ''
  after(() => {
    pending[code]--
    if (requestNumbers[code] === request) errors[code] = ''
  })
  onError((reason: unknown) => {
    pending[code]--
    if (requestNumbers[code] !== request) return
    const failure = reason as { code?: string; response?: { status?: number } } | null
    errors[code] =
      failure?.code === 'FORBIDDEN' || failure?.response?.status === 403
        ? '暂无业务入口访问权限'
        : '业务入口加载失败，请重试'
  })
})
onBeforeUnmount(stopObserving)
watch(applicationCode, () => {
  keyword.value = ''
})

async function retryNavigation() {
  if (!applicationCode.value || loading.value) return
  try {
    await navigationStore.fetchNavigation(applicationCode.value)
  } catch {
    // The action subscription supplies the same failure state for Shell and manual retries.
  }
}

const groups = computed<EntryGroup[]>(() => {
  if (!ready.value) return []
  const seen = new Set<string>()
  const currentPath = (route.path || '').replace(/\/+$/, '') || '/'
  const collect = (node: NavigationNode, parents: string[] = []): Entry[] => {
    if (!node.visible) return []
    const entries: Entry[] = []
    const path = node.routePath
    if (path && (path.replace(/\/+$/, '') || '/') !== currentPath && !seen.has(path)) {
      seen.add(path)
      entries.push({
        name: node.displayName,
        path,
        iconKey: node.iconKey,
        context: parents.join(' / '),
      })
    }
    for (const child of node.children)
      entries.push(...collect(child, [...parents, node.displayName]))
    return entries
  }
  const result: EntryGroup[] = []
  const direct: Entry[] = []
  for (const node of navigationStore.getNavigation(applicationCode.value)) {
    if (!node.visible) continue
    const entries = collect(node)
    if (!entries.length) continue
    if (node.children.some((child) => child.visible)) {
      result.push({
        id: node.id,
        name: node.displayName,
        iconKey: node.iconKey,
        entries: entries.map((entry) => ({
          ...entry,
          context:
            entry.context === node.displayName
              ? ''
              : entry.context.startsWith(node.displayName + ' / ')
                ? entry.context.slice(node.displayName.length + 3)
                : entry.context,
        })),
      })
    } else direct.push(...entries)
  }
  if (direct.length)
    result.unshift({ id: 'direct-entries', name: '业务入口', iconKey: null, entries: direct })
  return result
})
const filteredGroups = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  return groups.value
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        [group.name, entry.name, entry.context].some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
      ),
    }))
    .filter((group) => group.entries.length)
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.dashboard {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  color: $color-text-primary;
}
.dashboard__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
.dashboard__heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}
.dashboard__heading > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.dashboard__heading p {
  margin: 6px 0 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}
.dashboard__search {
  width: 300px;
  max-width: 100%;
}
.dashboard__state {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 32px 0;
  color: $color-text-secondary;
  font-size: $font-size-base;
}
.entry-group {
  padding: 16px 0;
  border-top: 1px solid $color-border-base;
}
.entry-group h2 {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 10px;
  font-size: $font-size-base;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.entry-group ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.entry-group li {
  min-width: 0;
}
.entry-link {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 8px 10px;
  color: $color-text-regular;
  text-decoration: none;
  border-radius: 4px;
}
.entry-link:hover {
  color: $color-primary;
  background: $color-bg-white;
}
.entry-link:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
}
.entry-link__text {
  display: grid;
  min-width: 0;
  gap: 3px;
  font-size: $font-size-base;
  overflow-wrap: anywhere;
}
.entry-link__text small {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.entry-link__arrow {
  margin-left: auto;
  flex: 0 0 auto;
  color: $color-text-placeholder;
}
@media (max-width: 960px) {
  .entry-group ul {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .dashboard__heading {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }
  .dashboard__search {
    width: 100%;
  }
  .entry-group ul {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
