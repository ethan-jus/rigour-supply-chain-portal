<template>
  <el-card class="filter-card order-register-filter" shadow="never">
    <form class="order-register-filter__form" aria-label="查询条件" @submit.prevent="emit('search')">
      <div
        class="order-register-filter__line order-register-filter__line--primary"
        :style="{ '--order-filter-row-height': `${rowHeight}px` }"
      >
        <div
          ref="fieldsRef"
          class="order-register-filter__fields"
          :class="{ 'is-collapsed': collapsed }"
        >
          <slot name="primary" />
          <slot name="extra" />
        </div>
        <div class="order-register-filter__actions">
          <template v-if="queryFirst">
            <el-button @click="emit('reset')">重置</el-button>
            <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
            <span v-if="$slots.actions" class="order-register-filter__divider" aria-hidden="true" />
            <slot name="actions" />
          </template>
          <template v-else>
            <slot name="actions" />
            <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
            <el-button @click="emit('reset')">重置</el-button>
          </template>
          <el-button
            v-if="hasOverflow"
            text
            type="primary"
            :aria-expanded="expanded"
            @click="toggle"
          >
            {{ expanded ? '收起' : '展开' }}
            <el-icon class="el-icon--right">
              <ArrowUp v-if="expanded" />
              <ArrowDown v-else />
            </el-icon>
          </el-button>
        </div>
      </div>
    </form>
  </el-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    loading?: boolean
    /** true 时先渲染“重置 / 查询”，再渲染页面操作按钮；列表页高频操作靠左。 */
    queryFirst?: boolean
  }>(),
  { loading: false, queryFirst: false },
)
const emit = defineEmits<{ search: []; reset: [] }>()

const fieldsRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const hasOverflow = ref(false)
const rowHeight = ref(34)
const collapsed = computed(() => hasOverflow.value && !expanded.value)
let observer: ResizeObserver | null = null

/** 条件按宽度自然换行；超过一行时默认收起，展开后完整展示，按钮始终与第一行对齐。 */
function measure() {
  const el = fieldsRef.value
  if (!el) return
  const children = Array.from(el.children) as HTMLElement[]
  if (!children.length) {
    hasOverflow.value = false
    return
  }
  const firstTop = children[0]!.offsetTop
  const firstRow = children.filter((child) => child.offsetTop === firstTop)
  rowHeight.value = Math.max(...firstRow.map((child) => child.offsetHeight), 34)
  const overflow = el.scrollHeight > rowHeight.value + 2
  hasOverflow.value = overflow
  if (!overflow && expanded.value) expanded.value = false
}

function toggle() {
  expanded.value = !expanded.value
  void nextTick(measure)
}

onMounted(async () => {
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined' && fieldsRef.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(fieldsRef.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.order-register-filter__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.order-register-filter__line {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.order-register-filter__line--primary {
  justify-content: space-between;
}
.order-register-filter__fields {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.order-register-filter__fields.is-collapsed {
  max-height: var(--order-filter-row-height, 34px);
  overflow: hidden;
}

/* Element Plus 的日期范围根节点自带 flex-grow，会撑满整行；按自身宽度渲染。 */
.order-register-filter__fields :deep(.el-date-editor) {
  flex: 0 0 auto;
}

.order-register-filter__actions {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  flex-shrink: 0;
  min-height: var(--order-filter-row-height, 34px);
  margin-left: auto;
}

.order-register-filter__divider {
  width: 1px;
  height: 18px;
  background: var(--el-border-color);
}
</style>
