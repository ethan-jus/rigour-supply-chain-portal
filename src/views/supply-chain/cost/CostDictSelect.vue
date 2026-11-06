<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :clearable="clearable"
    filterable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option
      v-for="option in code === 'COST_TRANSPORT_PURPOSE' ? transportTypes : costOptions(code)"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </el-select>
</template>
<script setup lang="ts">
import { costOptions } from './cost-dictionaries'
import { transportTypes } from './cost-transport-types'
defineProps<{
  modelValue: string | null | undefined
  code: string
  placeholder?: string
  clearable?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
