<template>
  <section class="metric-guide" aria-label="看板业务口径">
    <p class="metric-guide__scope">{{ scope }}</p>
    <p class="metric-guide__note">
      金额按原始值计算，展示四舍五入；“万”仅为显示单位，明细与 Excel
      按元保留两位。仅标记“样例”的内容为演示数据。查询刷新不等于源业务已完成同步。
    </p>
    <el-input
      v-model="search"
      clearable
      :prefix-icon="Search"
      placeholder="查找指标或图表"
      aria-label="查找指标口径"
    />
    <el-button v-if="selected" link type="primary" class="metric-guide__all" @click="showAll"
      >查看当前看板全部口径</el-button
    >
    <article v-for="entry in visibleEntries" :key="entry.id" class="metric-guide__entry">
      <h3>{{ entry.name }} <small v-if="entry.sample">样例</small></h3>
      <p v-if="entry.value" class="metric-guide__value">当前值 {{ entry.value }}</p>
      <p class="metric-guide__formula">{{ entry.formula }}</p>
      <dl>
        <dt>数据来源</dt>
        <dd>{{ entry.source }}</dd>
        <dt>计算与判断边界</dt>
        <dd>
          <ul>
            <li v-for="(rule, index) in entry.rules" :key="index">{{ rule }}</li>
          </ul>
        </dd>
      </dl>
    </article>
    <el-empty v-if="!visibleEntries.length" description="未找到匹配的指标口径" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { MetricExplanation } from '../cockpit-methodology'
const props = defineProps<{ entries: MetricExplanation[]; scope: string; focus?: string }>()
const search = ref('')
const selected = ref('')
function showAll() {
  selected.value = ''
  search.value = ''
}
watch(
  () => [props.focus, props.entries] as const,
  () => {
    selected.value = props.focus || ''
    search.value = ''
  },
  { immediate: true },
)
const visibleEntries = computed(() =>
  props.entries.filter(
    (entry) =>
      (!selected.value || entry.id === selected.value) &&
      (!search.value.trim() ||
        [entry.name, entry.formula, ...entry.rules].join(' ').includes(search.value.trim())),
  ),
)
</script>

<style scoped>
.metric-guide {
  color: #344054;
}
.metric-guide__scope {
  margin-top: 0;
  font-weight: 600;
}
.metric-guide__note {
  color: #667085;
  font-size: 13px;
  line-height: 1.7;
}
.metric-guide__all {
  margin-top: 12px;
}
.metric-guide__entry {
  border-bottom: 1px solid #e4e7ec;
  padding: 20px 0;
  overflow-wrap: anywhere;
}
h3 {
  margin: 0;
  font-size: 16px;
  color: #17212f;
}
h3 small {
  color: #9a6700;
  font-size: 12px;
  margin-left: 6px;
  font-weight: 500;
}
.metric-guide__value {
  color: #2458d3;
  font-weight: 600;
}
.metric-guide__formula {
  line-height: 1.8;
  color: #17212f;
}
dl {
  margin-bottom: 0;
  font-size: 13px;
  line-height: 1.8;
}
dt {
  font-weight: 600;
  margin-top: 12px;
}
dd {
  margin: 4px 0 0;
}
ul {
  padding-left: 18px;
  margin: 0;
}
li + li {
  margin-top: 6px;
}
</style>
