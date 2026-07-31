<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>
<script setup lang="ts">
import{computed}from'vue';import{useAuthStore}from'@/stores';const props=defineProps<{permissions:string|string[];requireAll?:boolean}>();const auth=useAuthStore();const allowed=computed(()=>{const values=Array.isArray(props.permissions)?props.permissions:[props.permissions];return props.requireAll?values.every(auth.hasPermission):values.some(auth.hasPermission)})
</script>
