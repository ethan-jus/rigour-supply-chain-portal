<template>
  <div class="table-scroll">
    <table class="cost-table">
      <thead>
        <tr>
          <th>单据号 / 事项</th>
          <th>费用类别</th>
          <th>费用归属</th>
          <th>费用日期</th>
          <th class="numeric">金额（元）</th>
          <th>确认状态</th>
          <th>付款状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.source}:${row.sourceId}`">
          <td>
            <b>{{ row.documentNo }}</b
            ><small>{{ row.title }}</small>
          </td>
          <td>{{ categories[row.category] }}</td>
          <td>{{ row.cityName }}</td>
          <td>{{ row.periodBasis === 'MONTH' ? row.costMonth + '（所属月）' : row.date }}</td>
          <td class="numeric">
            {{ row.amount === null ? '未填' : money(row.amount)
            }}<small v-if="row.costTreatment === 'LINKED'">由原费用计入，不重复汇总</small
            ><small v-else-if="row.costTreatment === 'REVIEW'">待核对，暂不计入汇总</small>
          </td>
          <td>{{ statusName(row.status) }}</td>
          <td>{{ statusName(row.payment) }}</td>
          <td><button class="text-button" @click="emit('detail', row)">查看详情</button></td>
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
