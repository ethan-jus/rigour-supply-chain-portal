<template>
  <div class="city-board-shell" :class="{ 'is-embedded': embedded }">
    <BiOverviewBoard
      :snapshot="regionCode ? snapshot : null"
      :year="year || Number(month.slice(0, 4))"
      :selected-month="annual ? null : Number(month.slice(5, 7))"
      :scope-label="demo ? '设计演示 · 非真实经营数据' : scopeLabel"
      :city-context="cityContext"
      :loading="loading || false"
      :error="
        error ||
        (!loading && allSnapshot && !cityContext.options.length ? '当前授权范围暂无可查看城市' : '')
      "
      @period="(value, selected) => emit('period', value, selected)"
      @refresh="emit('refresh')"
      @city="chooseCity"
    >
      <template #comparison>
        <BiCitySalesComparison
          v-model:receipt="receiptRanking"
          :snapshot="snapshot"
          :annual="annual || false"
          :city-name="cityContext.name"
        />
      </template>
    </BiOverviewBoard>
    <button
      v-if="!embedded"
      class="city-board-close"
      aria-label="关闭城市看板"
      @click="emit('close')"
    >
      <Close />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { MeetingSnapshot } from '../meeting-model'
import { cityMeetingRows } from '../city-meeting-model'
import BiOverviewBoard from './BiOverviewBoard.vue'
import BiCitySalesComparison from './BiCitySalesComparison.vue'

const props = defineProps<{
  snapshot: MeetingSnapshot | null
  allSnapshot: MeetingSnapshot | null
  regionCode: string
  month: string
  year?: number
  annual?: boolean
  maxMonth: string
  scopeLabel: string
  loading?: boolean
  error?: string
  demo?: boolean
  embedded?: boolean
}>()
const emit = defineEmits<{
  city: [code: string]
  period: [year: number, month: number | null]
  refresh: []
  close: []
}>()
const receiptRanking = ref(false)
const cityContext = computed(() => {
  const options = cityMeetingRows(props.allSnapshot).filter((row) => row.selectable)
  return {
    code: props.regionCode,
    name: options.find((row) => row.code === props.regionCode)?.name || '',
    options,
  }
})
function chooseCity(code?: string) {
  if (code && cityContext.value.options.some((row) => row.code === code)) emit('city', code)
}
</script>

<style lang="scss">
.city-board-shell {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: #071d2c;
  &.is-embedded {
    position: relative;
    height: 100%;
    min-height: 0;
    z-index: auto;
  }
}
.city-board-close {
  position: absolute;
  right: 8px;
  top: 8px;
  border: 0;
  background: #10263a;
  color: #eaf3ff;
  cursor: pointer;
  svg {
    width: 18px;
    height: 18px;
  }
}
.bi-overview.is-city-overview {
  .city-context {
    padding: 20px 32px 0;
    label {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--ov-muted);
    }
    select {
      background: #10263a;
      border: 1px solid #32516a;
      border-radius: 4px;
      padding: 8px 30px 8px 12px;
      min-width: 140px;
    }
    h2 {
      font-size: 28px;
      margin-top: 24px;
    }
  }
  .overview-kpis {
    padding-top: 22px;
    padding-bottom: 24px;
  }
  .overview-cities table,
  .overview-cities table.with-cohort {
    min-width: 1100px;
    th,
    td {
      width: auto;
      padding-left: 12px;
      padding-right: 12px;
      text-align: right;
    }
    th:first-child,
    td:first-child {
      width: 6%;
      text-align: center;
    }
    th:nth-child(2),
    td:nth-child(2) {
      width: 11%;
      text-align: left;
      padding-left: 16px;
    }
    th:last-child,
    td:last-child {
      width: 17%;
    }
    .city-completion {
      justify-content: flex-end;
    }
  }
  .kpi-value {
    font-size: clamp(28px, 3.2vw, 42px);
  }
  .goal-meta {
    gap: 4px;
    white-space: normal;
    flex-wrap: wrap;
  }
  .goal-meta span {
    white-space: nowrap;
  }
  .overview-cities .amount-increase {
    color: #55efb4;
  }
  .overview-cities .amount-decrease {
    color: #ff7180;
  }
  .sales-scope {
    color: var(--ov-muted);
    font-size: 14px;
    font-weight: 400;
    margin-left: 14px;
  }
  .sales-target-note {
    font-size: 12px;
    color: var(--ov-muted);
    margin-top: 8px;
  }
  @media (max-width: 760px) {
    .city-context {
      padding: 18px;
    }
    .sales-scope {
      display: block;
      margin: 8px 0 0;
    }
  }
}
</style>
