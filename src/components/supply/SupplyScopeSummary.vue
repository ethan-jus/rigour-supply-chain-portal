<script setup lang="ts">
withDefaults(
  defineProps<{ items: string[]; label?: string; emptyText?: string; showDetails?: boolean }>(),
  {
    label: '项目',
    emptyText: '-',
  },
)
</script>

<template>
  <span v-if="!items.length" class="scope-empty">{{ emptyText }}</span>
  <span v-else class="scope-summary">
    <span class="scope-summary__preview" :title="items[0]">{{ items[0] }}</span>
    <el-popover
      v-if="items.length > 1 || showDetails"
      trigger="click"
      placement="bottom-start"
      :width="380"
    >
      <template #reference>
        <button
          type="button"
          class="scope-summary__more"
          :aria-label="`查看全部 ${items.length} 个${label}`"
          @click.stop
        >
          共 {{ items.length }} 个
        </button>
      </template>
      <div class="scope-summary__heading">
        {{ label }}范围 <span>{{ items.length }} 个</span>
      </div>
      <slot
        ><ul class="scope-summary__items" :aria-label="`全部${label}`">
          <li v-for="(item, index) in items" :key="index">{{ item }}</li>
        </ul></slot
      >
    </el-popover>
  </span>
</template>

<style scoped>
.scope-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: left;
}
.scope-summary__preview {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.scope-summary__more {
  flex: none;
  border: 0;
  border-radius: 4px;
  padding: 3px 7px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.scope-summary__more:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.scope-summary__heading {
  display: flex;
  justify-content: space-between;
  padding: 4px 0 10px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.scope-summary__heading span,
.scope-empty {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
.scope-summary__items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  list-style: none;
  margin: 12px 0 4px;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .scope-summary__items {
    grid-template-columns: 1fr;
  }
}
</style>
