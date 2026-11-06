<template>
  <div class="warehouse-location">
    <el-select-v2
      v-model="code"
      :options="options"
      :loading="loading"
      :disabled="loading || !!error"
      filterable
      clearable
      aria-label="仓库所在地区"
      placeholder="搜索省、市或区县"
      @change="changed"
    />
    <div v-if="error" class="location-error" role="alert">
      {{ error }} <el-button link type="primary" @click="load">重试</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getErpWarehouseLocationCatalog,
  type WarehouseLocationCatalog,
} from '@/api/core/erp-internal'
import { warehouseLocationOptions } from '@/utils/warehouse-location'
const code = defineModel<string>('code', { required: true })
const version = defineModel<string | null>('version', { required: true })
const props = defineProps<{ display?: string | null }>()
const catalog = ref<WarehouseLocationCatalog | null>(null)
const loading = ref(false)
const error = ref('')
const options = computed(() => {
  const rows = catalog.value ? warehouseLocationOptions(catalog.value) : []
  if (code.value && !rows.some((row) => row.value === code.value)) {
    rows.unshift({ value: code.value, label: props.display || `地区编码 ${code.value}` })
  }
  return rows
})
function changed(value: string | undefined | null) {
  code.value = value || ''
  version.value = value ? catalog.value!.version : null
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    catalog.value = await getErpWarehouseLocationCatalog()
  } catch {
    error.value = '所在地区目录加载失败，请重试'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.warehouse-location {
  width: 100%;
}
.location-error {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
}
.location-error {
  color: var(--el-color-danger);
}
</style>
