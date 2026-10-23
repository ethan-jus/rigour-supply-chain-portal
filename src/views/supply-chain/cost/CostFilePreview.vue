<template>
  <el-dialog v-model="visible" :title="name" width="min(900px, 95vw)" append-to-body>
    <img
      v-if="type.startsWith('image/')"
      :src="url"
      :alt="name"
      class="cost-file-image"
      referrerpolicy="no-referrer"
    />
    <iframe v-else :src="url" :title="name" class="cost-file-pdf" referrerpolicy="no-referrer" />
    <template #footer>
      <el-button @click="visible = false">关闭预览</el-button>
      <el-link :href="url" target="_blank" rel="noopener noreferrer" type="primary"
        >打开文件</el-link
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { onDeactivated } from 'vue'
defineProps<{ name: string; type: string; url: string }>()
const visible = defineModel<boolean>({ required: true })
onDeactivated(() => { visible.value = false })
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
