<template>{{ configured || fallback }}</template>
<script setup lang="ts">
import { computed } from 'vue'
import { getActivePinia } from 'pinia'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
const props = defineProps<{ code: string; fallback: string }>()
const pinia = getActivePinia()
const access = pinia ? useSupplyAuthorizationStore(pinia) : null
const configured = computed(() => access?.context?.actionLabels?.[props.code])
</script>
