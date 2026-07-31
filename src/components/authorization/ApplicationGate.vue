<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>
<script setup lang="ts">
import{computed,onMounted}from'vue';import{useApplicationStore}from'@/stores';const props=defineProps<{code:string}>();const store=useApplicationStore();const allowed=computed(()=>store.applications.some(app=>app.code===props.code));onMounted(()=>{if(!store.loaded)void store.fetchApplications()})
</script>
