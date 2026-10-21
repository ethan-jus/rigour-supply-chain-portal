<template>
  <el-select
    v-bind="$attrs"
    v-model="value"
    :clearable="clearable"
    filterable
    :loading="loading"
    :placeholder="placeholder || '选择归属城市'"
    @visible-change="
      (open) => {
        if (open) void load()
      }
    "
    @change="emit('change')"
  >
    <el-option
      v-for="city in options"
      :key="city.code"
      :value="city.code"
      :label="city.name + ' · ' + city.code"
    />
    <template #empty
      ><div class="city-empty" role="status">
        {{ loading ? '正在加载城市…' : failure || '暂无授权城市，请联系管理员配置范围' }}
        <el-button v-if="failure" link type="primary" @click.stop="load">重新加载</el-button>
      </div></template
    >
  </el-select>
  <div v-if="failure" role="alert">
    {{ failure }} <el-button link type="primary" @click="load">重新加载</el-button>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getCostCities } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  action: string
  snapshot?: string
  clearable?: boolean
  placeholder?: string
}>()
const value = defineModel<string>({ required: true })
const emit = defineEmits<{ change: []; loaded: [{ code: string; name: string }[]] }>()
const cities = ref<{ code: string; name: string }[]>([]),
  loading = ref(false),
  failure = ref('')
const options = computed(() =>
  value.value && !cities.value.some((c) => c.code === value.value)
    ? [...cities.value, { code: value.value, name: props.snapshot || value.value }]
    : cities.value,
)
let version = 0
async function load() {
  const current = ++version
  loading.value = true
  failure.value = ''
  try {
    const rows = await getCostCities(props.action)
    if (current === version) {
      cities.value = rows
      emit('loaded', rows)
    }
  } catch (e) {
    if (current === version) failure.value = errorMessage(e, '城市加载失败，请重试')
  } finally {
    if (current === version) loading.value = false
  }
}
watch(
  () => props.action,
  () => {
    version++
    cities.value = []
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  version++
})
</script>
<style scoped>
.city-empty {
  padding: 12px;
}
</style>
