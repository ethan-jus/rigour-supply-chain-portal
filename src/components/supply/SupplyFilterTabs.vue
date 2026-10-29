<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  label: string
  items: { value: string; label: string; count?: number }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
function navigate(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % props.items.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + props.items.length) % props.items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.items.length - 1
  else return
  event.preventDefault()
  emit('update:modelValue', props.items[next]!.value)
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')
  buttons?.[next]?.focus()
}
</script>

<template>
  <div class="supply-filter-tabs" role="tablist" :aria-label="label">
    <button
      v-for="(item, index) in items"
      :key="item.value"
      type="button"
      role="tab"
      :data-value="item.value"
      :aria-selected="modelValue === item.value"
      :tabindex="modelValue === item.value ? 0 : -1"
      :class="{ active: modelValue === item.value }"
      @click="emit('update:modelValue', item.value)"
      @keydown="navigate($event, index)"
    >
      <span>{{ item.label }}</span
      ><span v-if="item.count != null" class="supply-filter-tabs__count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.supply-filter-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.supply-filter-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.supply-filter-tabs button:hover {
  background: #f1f5f9;
}
.supply-filter-tabs button.active {
  color: #2563eb;
  background: #eff4ff;
  font-weight: 600;
}
.supply-filter-tabs button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.supply-filter-tabs__count {
  min-width: 18px;
  padding: 0 4px;
  border-radius: 10px;
  background: #f1f5f9;
  font-size: 11px;
  font-weight: 400;
}
.active .supply-filter-tabs__count {
  background: #e2ebff;
}
</style>
