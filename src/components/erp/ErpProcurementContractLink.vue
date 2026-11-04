<template>
  <el-link
    v-if="url"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    type="primary"
    :underline="false"
    >{{ label }}</el-link
  >
  <el-button v-else link type="primary" :loading="loading" @click="load">{{ label }}</el-button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getProcurementContractUrl } from '@/api/core/erp-documents'
import { errorMessage } from '@/api/core/error'

const props = withDefaults(defineProps<{ orderId: string; label?: string }>(), {
  label: '查看合同附件',
})
const url = ref(''),
  loading = ref(false)
let request = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined

async function load() {
  const token = ++request
  clearTimeout(refreshTimer)
  url.value = ''
  loading.value = true
  try {
    const address = await getProcurementContractUrl(props.orderId)
    if (token !== request) return
    if (!/^https?:\/\//i.test(address)) throw new Error('附件链接无效，请重试')
    url.value = address
    // 签名链接有效期10分钟，提前刷新；直接链接保留浏览器原生的新页打开行为。
    refreshTimer = setTimeout(
      () => {
        void load()
      },
      8 * 60 * 1000,
    )
  } catch (reason) {
    if (token === request) ElMessage.error(errorMessage(reason, '附件链接获取失败，请重试'))
  } finally {
    if (token === request) loading.value = false
  }
}
watch(
  () => props.orderId,
  () => {
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  request++
  clearTimeout(refreshTimer)
})
</script>
