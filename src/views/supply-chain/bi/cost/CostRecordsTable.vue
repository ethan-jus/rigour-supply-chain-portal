<template>
  <div
    class="table-scroll cost-records-scroll"
    role="region"
    aria-label="费用支出明细"
    tabindex="0"
  >
    <table class="supply-report-table cost-table cost-records-table" aria-label="费用支出明细表">
      <colgroup>
        <col class="record-document-col" />
        <col class="record-category-col" />
        <col class="record-city-col" />
        <col class="record-date-col" />
        <col class="record-amount-col" />
        <col class="record-status-col" />
        <col class="record-payment-col" />
        <col class="record-actions-col" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">单据号 / 事项</th>
          <th scope="col">费用类别</th>
          <th scope="col">费用归属</th>
          <th scope="col">费用日期</th>
          <th scope="col" class="numeric">金额（元）</th>
          <th scope="col" class="record-status">确认状态</th>
          <th scope="col" class="record-status">付款状态</th>
          <th scope="col" class="record-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.source}:${row.sourceId}`">
          <td class="record-document">
            <b>{{ row.documentNo }}</b
            ><small>{{ row.title }}</small>
          </td>
          <td>{{ categories[row.category] }}</td>
          <td>{{ row.cityName }}</td>
          <td class="record-date">
            {{ row.periodBasis === 'MONTH' ? row.costMonth + '（所属月）' : row.date }}
          </td>
          <td class="numeric">
            {{ row.amount === null ? '未填' : money(row.amount) }}
          </td>
          <td class="record-status">{{ statusName(row.status) }}</td>
          <td class="record-status">{{ statusName(row.payment) }}</td>
          <td class="record-actions">
            <button class="text-button" @click="emit('detail', row)">查看详情</button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="8" class="empty">当前筛选范围没有匹配记录</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import type { CostRecord } from '@/api/core/bi-cost-dashboard'
import { categories, money, statusName } from './cost-presentation'
defineProps<{ rows: CostRecord[] }>()
const emit = defineEmits<{ detail: [record: CostRecord] }>()
</script>
