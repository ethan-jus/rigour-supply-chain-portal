<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :clearable="clearable"
    filterable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option
      v-for="option in costOptions(code)"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </el-select>
</template>
<script setup lang="ts">
import { costOptions } from './cost-dictionaries'
defineProps<{
  modelValue: string | null | undefined
  code: string
  placeholder?: string
  clearable?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
