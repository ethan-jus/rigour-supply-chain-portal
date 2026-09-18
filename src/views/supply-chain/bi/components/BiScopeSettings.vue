<template>
  <el-drawer :model-value="modelValue" title="看板数据权限" size="min(480px, 100vw)" @update:model-value="emit('update:modelValue', $event)">
    <p>看板使用供应链统一的数据权限。请在系统设置中维护角色的数据范围，以及用户的部门、地区和仓库授权。</p>
    <p>权限变更后重新打开看板即可读取生效范围。</p>
    <div class="scope-actions">
      <el-button v-if="can('supply:role:read')" type="primary" @click="open('/supply-chain/settings/roles')">角色与数据范围</el-button>
      <el-button v-if="can('supply:user:read')" @click="open('/supply-chain/settings/users')">用户授权</el-button>
    </div>
  </el-drawer>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const router = useRouter()
const { can } = useSupplyPermissions()
function open(path: string) {
  emit('update:modelValue', false)
  void router.push(path)
}
</script>
<style scoped>
p { line-height: 1.8; color: var(--el-text-color-regular); }
.scope-actions { display: flex; gap: 12px; margin-top: 24px; }
</style>
