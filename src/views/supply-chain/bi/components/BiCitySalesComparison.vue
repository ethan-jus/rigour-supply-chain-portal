<template>
  <div class="city-sales-comparison">
    <div class="section-title">
      <h2>
        销售业绩对比 <span class="sales-scope">{{ cityName }}</span>
      </h2>
    </div>
    <div class="ranking-toolbar">
      <div class="segmented" aria-label="销售排名指标">
        <button :class="{ active: !receipt }" @click="receipt = false">本期交易额排名</button>
        <button :class="{ active: receipt }" @click="receipt = true">本期到账排名</button>
      </div>
      <button
        v-if="rows.length > previewCount"
        type="button"
        class="outline"
        :aria-controls="tableId"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? `收起至前 ${previewCount} 名` : `展开全部 ${rows.length} 位销售` }}
      </button>
    </div>
    <div class="overview-table-scroll">
      <table :id="tableId" class="supply-report-table" :class="{ 'with-cohort': !receipt }">
        <thead>
          <tr>
            <th>排名</th>
            <th>销售人员</th>
            <th>本期{{ receipt ? '到账' : '交易额' }}<small>（元）</small></th>
            <th v-if="!receipt">本期回款额<small>（元）</small></th>
            <th v-if="!receipt">本期回款率</th>
            <th>{{ annual ? '上年同期' : '上月同期' }}<small>（元）</small></th>
            <th>增减额<small>（元）</small></th>
            <th>{{ annual ? '年度' : '月' }}目标<small>（元）</small></th>
            <th>目标完成率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in visibleRows" :key="row.code">
            <td>
              <span class="rank" :aria-label="`第${index + 1}名`"
                ><span v-if="index < 3" class="rank-medal" aria-hidden="true">{{
                  ['🥇', '🥈', '🥉'][index]
                }}</span
                ><span v-else>{{ index + 1 }}</span></span
              >
            </td>
            <th>{{ row.name }}<small v-if="row.employmentStatus === 'LEFT'">已离职</small></th>
            <td :class="['amount-cell', { cyan: receipt }]">{{ money(row.amount) }}</td>
            <td v-if="!receipt" class="cohort-amount">{{ money(row.paid) }}</td>
            <td v-if="!receipt">{{ percentage(rate(row.paid, row.amount)) }}</td>
            <td>{{ money(row.previous) }}</td>
            <td
              :class="{
                'amount-increase':
                  row.amount != null && row.previous != null && row.amount > row.previous,
                'amount-decrease':
                  row.amount != null && row.previous != null && row.amount < row.previous,
              }"
            >
              {{
                row.amount == null || row.previous == null
                  ? '—'
                  : `${row.amount > row.previous ? '+' : ''}${money(row.amount - row.previous)}`
              }}
            </td>
            <td>{{ row.target === 0 ? '不考核' : money(row.target) }}</td>
            <td>
              <div class="city-completion">
                <b>{{ percentage(rate(row.amount, row.target)) }}</b>
                <div
                  class="completion-track"
                  role="progressbar"
                  :aria-label="`${row.name}目标完成进度`"
                  :aria-valuenow="
                    row.amount == null
                      ? undefined
                      : Math.min(100, Math.max(0, rate(row.amount, row.target) ?? 0))
                  "
                  :aria-valuetext="percentage(rate(row.amount, row.target))"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <i
                    :style="{
                      width: `${Math.min(100, Math.max(0, rate(row.amount, row.target) ?? 0))}%`,
                      background: completionGradient(rate(row.amount, row.target)).css,
                    }"
                  />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty-data">
        {{
          snapshot?.analysisError && receipt ? '本期到账明细暂未就绪' : '当前部门暂无销售业绩数据'
        }}
      </p>
    </div>
    <div class="ranking-footer">
      <span>{{
        receipt
          ? '按到账日期统计；业绩归属优先回款经办人，缺失时按客户当前归属业务员。'
          : '本期回款按本期订单累计统计，包含后续月份回款；回款和到账均包含待财务确认及已确认金额。'
      }}</span>
      <span>共 {{ rows.length }} 位销售</span>
    </div>
    <p v-if="unlistedReceipts != null && unlistedReceipts > 0.01" class="sales-target-note">
      归属异常待核对：{{ money(unlistedReceipts) }} 元（回款经办人和客户当前归属业务员均缺失）。
    </p>
    <p class="sales-target-note">个人指标由人事统一维护；年度逐月累计，0 表示不考核。</p>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  moneyYuan as money,
  percentage,
  rate,
  meetingMetric,
  type MeetingSnapshot,
} from '../meeting-model'
import { completionGradient } from '../overview-model'
import { citySalesRows } from '../city-meeting-model'
const props = defineProps<{ snapshot: MeetingSnapshot | null; annual: boolean; cityName: string }>()
const receipt = defineModel<boolean>('receipt', { default: false })
const tableId = useId()
const previewCount = 8
const expanded = ref(false)
const rows = computed(() => citySalesRows(props.snapshot, receipt.value, props.annual))
const unlistedReceipts = computed(() => {
  if (!receipt.value || !props.snapshot?.analysis?.salesReceipts) return null
  const total = meetingMetric(props.snapshot.current, 'receipt_amount')
  return total == null ? null : total - rows.value.reduce((sum, row) => sum + (row.amount ?? 0), 0)
})
const visibleRows = computed(() => expanded.value ? rows.value : rows.value.slice(0, previewCount))
</script>
