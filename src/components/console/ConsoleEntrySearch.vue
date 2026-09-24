<template>
  <div
    ref="root"
    class="entry-search"
    :class="{ 'is-expanded': expanded }"
    @keydown.esc.stop.prevent="collapse(true)"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      class="entry-search__toggle"
      type="button"
      :aria-label="expanded ? '收起入口搜索' : '打开入口搜索'"
      :aria-expanded="expanded"
      title="搜索业务入口"
      @click="toggle"
    >
      <Search aria-hidden="true" />
    </button>
    <input
      v-if="expanded"
      ref="input"
      v-model="keyword"
      aria-label="搜索业务入口"
      placeholder="搜索业务入口"
      autocomplete="off"
      :aria-expanded="!!keyword.trim()"
      aria-controls="entry-search-results"
      @keydown.enter.prevent="openFirst"
    />
    <button v-if="expanded && keyword" type="button" aria-label="清空搜索" @click="keyword = ''">
      <Close />
    </button>
    <div v-if="expanded && keyword.trim()" id="entry-search-results" class="entry-search__results">
      <router-link v-for="entry in results" :key="entry.path" :to="entry.path" @click="collapse()">
        <ConsoleNavIcon :icon-key="entry.iconKey" /><span
          >{{ entry.name }}<small>{{ entry.context }}</small></span
        ><ArrowRight />
      </router-link>
      <p v-if="!results.length">没有匹配的业务入口</p>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Close, ArrowRight } from '@element-plus/icons-vue'
import type { ConsoleEntry } from '@/utils/console-navigation'
import ConsoleNavIcon from './ConsoleNavIcon.vue'
const props = defineProps<{ entries: ConsoleEntry[] }>()
const keyword = ref('')
const expanded = ref(false)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const input = ref<HTMLInputElement>()
function collapse(restoreFocus = false) {
  expanded.value = false
  keyword.value = ''
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}
async function toggle() {
  if (expanded.value) collapse()
  else {
    expanded.value = true
    await nextTick()
    input.value?.focus()
  }
}
function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) collapse()
}
const route = useRoute()
const router = useRouter()
const results = computed(() =>
  props.entries
    .filter((entry) =>
      `${entry.name} ${entry.context}`.toLowerCase().includes(keyword.value.trim().toLowerCase()),
    )
    .slice(0, 12),
)
function openFirst() {
  if (results.value[0]) {
    void router.push(results.value[0].path)
    collapse()
  }
}
watch(
  () => route.path,
  () => collapse(),
)
</script>
<style scoped>
.entry-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  flex: 0 0 auto;
  width: 38px;
  padding: 0;
  height: 38px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #7184a0;
}
.entry-search.is-expanded {
  width: clamp(180px, 22vw, 320px);
  padding-right: 10px;
  border-color: #e6edf6;
  background: #f5f8fc;
}
.entry-search__toggle {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
.entry-search__toggle:hover {
  background: #edf4ff;
  color: #2563eb;
}
.entry-search svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.entry-search input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: #243b59;
}
.entry-search:focus-within {
  outline: 2px solid #93baff;
  outline-offset: 1px;
}
.entry-search button {
  padding: 0;
  display: flex;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}
.entry-search__results {
  position: absolute;
  top: 44px;
  right: 0;
  width: max(100%, 300px);
  max-width: calc(100vw - 96px);
  z-index: 30;
  max-height: 440px;
  overflow: auto;
  padding: 6px;
  border: 1px solid #dce5f2;
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px #17304a18;
}
.entry-search__results a {
  display: flex;
  gap: 10px;
  padding: 12px 8px;
  align-items: center;
  color: #253d5d;
  text-decoration: none;
  font-size: 14px;
}
.entry-search__results a:hover,
.entry-search__results a:focus-visible {
  background: #edf4ff;
}
.entry-search__results a > span {
  flex: 1;
}
.entry-search__results small {
  display: block;
  margin-top: 4px;
  color: #7184a0;
  font-size: 12px;
}
.entry-search__results p {
  padding: 12px;
  font-size: 13px;
}
@media (max-width: 600px) {
  .entry-search.is-expanded {
    position: absolute;
    right: 10px;
    z-index: 40;
    width: calc(100% - 20px);
    background: #f5f8fc;
  }
}
</style>
