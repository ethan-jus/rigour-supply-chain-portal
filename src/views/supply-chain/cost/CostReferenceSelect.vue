<template>
  <div class="reference-select">
    <el-select
      v-model="selected"
      filterable
      remote
      remote-show-suffix
      clearable
      :remote-method="search"
      :loading="loading"
      :placeholder="placeholder"
      @visible-change="open"
      @change="change"
    >
      <el-option v-for="row in options" :key="row.id" :value="row.id" :label="row.label" />
      <template #empty>
        <div class="reference-empty" :role="error ? 'alert' : 'status'">
          <span>{{ loading ? '正在加载…' : error || '暂无匹配资料，可更换关键字搜索' }}</span>
          <el-button v-if="error" link type="primary" @click.stop="load(false)">重新加载</el-button>
        </div>
      </template>
      <template #footer
        ><el-button v-if="more" link :loading="loading" @click="next">加载更多</el-button></template
      >
    </el-select>
    <span v-if="error" role="alert" class="reference-error">{{ error }}</span>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { errorMessage } from '@/api/core/error'
export interface ReferenceOption {
  id: string
  label: string
  name: string
  [key: string]: unknown
}
const props = defineProps<{
  loader: (keyword: string, begin: number) => Promise<ReferenceOption[]>
  placeholder?: string
  snapshot?: string
  resetKey?: string
}>()
const selected = defineModel<string | null>({ default: null })
const emit = defineEmits<{ change: [ReferenceOption | null] }>()
const options = ref<ReferenceOption[]>([]),
  loading = ref(false),
  error = ref(''),
  more = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let version = 0,
  keyword = '',
  offset = 0
function retain() {
  if (selected.value && !options.value.some((r) => r.id === selected.value))
    options.value.unshift({
      id: selected.value,
      label: props.snapshot || selected.value,
      name: props.snapshot || selected.value,
    })
}
watch(() => [selected.value, props.snapshot], retain, { immediate: true })
watch(
  () => props.resetKey,
  () => {
    version++
    clearTimeout(timer)
    options.value = []
    more.value = false
    loading.value = false
    error.value = ''
    keyword = ''
    offset = 0
    retain()
  },
)
async function load(append: boolean) {
  const v = ++version
  loading.value = true
  error.value = ''
  try {
    const rows = await props.loader(keyword, append ? offset : 0)
    if (v !== version) return
    const chosen = options.value.filter((r) => r.id === selected.value)
    options.value = Array.from(
      new Map([...(append ? options.value : chosen), ...rows].map((r) => [r.id, r])).values(),
    )
    offset = (append ? offset : 0) + rows.length
    more.value = rows.length === 50
  } catch (e) {
    if (v === version) error.value = errorMessage(e, '选项加载失败，请重新搜索')
  } finally {
    if (v === version) loading.value = false
  }
}
function search(value: string) {
  keyword = value
  version++
  clearTimeout(timer)
  timer = setTimeout(() => void load(false), 250)
}
function open(value: boolean) {
  if (value) {
    clearTimeout(timer)
    keyword = ''
    void load(false)
  }
}
function next() {
  void load(true)
}
function change(value: string | null) {
  emit('change', options.value.find((r) => r.id === value) ?? null)
}
onBeforeUnmount(() => {
  version++
  clearTimeout(timer)
})
</script>
<style scoped>
.reference-select,
.el-select {
  width: 100%;
}
.reference-empty {
  padding: 14px 20px;
  max-width: 450px;
  white-space: normal;
  color: var(--el-text-color-secondary);
}
.reference-error {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
