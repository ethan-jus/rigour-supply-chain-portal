<template>
  <section
    class="operating-workspace"
    :class="{ 'operating-workspace--wide': !aside.length && !actions.length }"
  >
    <div class="operating-workspace__analysis">
      <CockpitFigure
        v-for="figure in main"
        :key="figure.id"
        :figure="figure"
        @inspect="(...args) => $emit('inspect', ...args)"
        @explain="$emit('explain', $event)"
        @resolve-empty="$emit('resolve-empty', $event)"
      >
        <template #tools><slot name="figure-tools" :figure="figure" /></template>
        <template #summary><slot name="figure-summary" :figure="figure" /></template>
      </CockpitFigure>
    </div>
    <aside
      v-if="aside.length || actions.length"
      class="operating-workspace__monitor"
      aria-label="经营监控与跟进"
    >
      <CockpitFigure
        v-for="figure in aside.slice(0, 1)"
        :key="figure.id"
        :figure="figure"
        @inspect="(...args) => $emit('inspect', ...args)"
        @explain="$emit('explain', $event)"
        @resolve-empty="$emit('resolve-empty', $event)"
      >
        <template #tools><slot name="figure-tools" :figure="figure" /></template>
      </CockpitFigure>
      <section v-if="actions.length" class="operating-followups" aria-label="优先跟进">
        <header>
          <h2>优先跟进</h2>
          <span>{{ actions.length }} 项</span>
        </header>
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          :title="[action.label, action.context, action.value].filter(Boolean).join(' · ')"
          @click="$emit('action', action)"
        >
          <span class="followup-subject"
            >{{ action.label }}<small v-if="action.context">{{ action.context }}</small></span
          >
          <strong>{{ action.value }}</strong>
          <el-icon><ArrowRight /></el-icon>
        </button>
      </section>
      <CockpitFigure
        v-for="figure in aside.slice(1)"
        :key="figure.id"
        :figure="figure"
        @inspect="(...args) => $emit('inspect', ...args)"
        @explain="$emit('explain', $event)"
        @resolve-empty="$emit('resolve-empty', $event)"
      >
        <template #tools><slot name="figure-tools" :figure="figure" /></template>
      </CockpitFigure>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import type { CockpitAction, Figure } from '../cockpit-model'
import CockpitFigure from './CockpitFigure.vue'

defineProps<{ main: Figure[]; aside: Figure[]; actions: CockpitAction[] }>()
defineEmits<{
  inspect: [figure: Figure, rowKey?: string, collectionPart?: 'paid' | 'unpaid']
  explain: [figure: Figure]
  'resolve-empty': [action: NonNullable<Figure['emptyAction']>]
  action: [action: CockpitAction]
}>()
</script>

<style scoped lang="scss">
.operating-workspace {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) minmax(290px, 1fr);
  align-items: start;
  border-top: 1px solid #dce3ea;
}
.operating-workspace--wide {
  grid-template-columns: minmax(0, 1fr);
}
.operating-workspace__analysis,
.operating-workspace__monitor {
  min-width: 0;
}
.operating-workspace__analysis :deep(.cockpit-figure) {
  padding: 18px 24px 14px 0;
}
.operating-workspace__monitor {
  border-left: 1px solid #dce3ea;
}
.operating-workspace__monitor :deep(.cockpit-figure) {
  padding: 18px 0 14px 22px;
}
.operating-followups {
  padding: 18px 0 12px 22px;
  border-top: 1px solid #e4eaf2;
}
.operating-followups header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.operating-followups h2 {
  font-size: 14px;
  margin: 0;
  color: #263442;
}
.operating-followups header > span {
  color: #7b5b2d;
  font-size: 12px;
}
.operating-followups button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 14px;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 15px 0;
  border: 0;
  border-bottom: 1px solid #edf0f3;
  color: #354658;
  text-align: left;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.operating-followups button:hover {
  color: #2864e8;
}
.followup-subject {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.followup-subject small {
  display: block;
  font-size: 11px;
  color: #647487;
}
.operating-followups strong {
  font-size: 13px;
  color: #9b601d;
  font-variant-numeric: tabular-nums;
}
button:focus-visible {
  outline: 2px solid #2864e8;
  outline-offset: 2px;
}
@media (max-width: 1000px) {
  .operating-workspace:not(.operating-workspace--wide) {
    grid-template-columns: minmax(0, 1.7fr) minmax(250px, 1fr);
  }
}
@media (max-width: 760px) {
  .operating-workspace {
    display: flex;
    flex-direction: column;
  }
  .operating-workspace__analysis,
  .operating-workspace__monitor {
    width: 100%;
  }
  .operating-workspace__monitor {
    border-left: 0;
  }
  .operating-workspace :deep(.cockpit-figure),
  .operating-followups {
    padding: 16px 0;
  }
}
</style>
