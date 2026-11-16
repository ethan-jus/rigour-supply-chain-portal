<template>
  <el-dialog v-model="visible" :title="name" width="min(900px, 95vw)" append-to-body>
    <img
      v-if="type.startsWith('image/')"
      :src="url"
      :alt="name"
      class="cost-file-image"
      referrerpolicy="no-referrer"
    />
    <CostPdfPreview
      v-else-if="visible && type === 'application/pdf' && url.startsWith('blob:')"
      :url="url"
      :name="name"
    />
    <iframe
      v-else-if="visible && type === 'application/pdf'"
      :src="url"
      :title="name"
      class="cost-file-pdf"
      referrerpolicy="no-referrer"
    />
    <p v-else>该文件暂不支持在线预览，请点击“打开文件”下载后查看。</p>
    <template #footer>
      <el-button @click="visible = false">关闭预览</el-button>
      <el-link :href="url" target="_blank" rel="noopener noreferrer" type="primary"
        >打开文件</el-link
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { defineAsyncComponent, onDeactivated } from 'vue'
const CostPdfPreview = defineAsyncComponent(() => import('./CostPdfPreview.vue'))
defineProps<{ name: string; type: string; url: string }>()
const visible = defineModel<boolean>({ required: true })
onDeactivated(() => {
  visible.value = false
})
</script>
<style scoped>
.cost-file-image {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: auto;
}
.cost-file-pdf {
  width: 100%;
  height: 65vh;
  border: 0;
}
.el-link {
  margin-left: 16px;
}
</style>
