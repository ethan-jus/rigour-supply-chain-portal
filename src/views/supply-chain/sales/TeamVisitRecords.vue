<template>
  <section class="finance-report">
    <header><SupplyPageTitle>拜访记录</SupplyPageTitle></header>
    <OrderRegisterFilterCard :loading="busy" @search="search" @reset="reset"
      ><template #primary>
        <div class="list-filter-field list-filter-field--date-range">
          <el-date-picker
            v-model="range"
            type="daterange"
            :clearable="false"
            value-format="YYYY-MM-DD"
            start-placeholder="起始日期"
            end-placeholder="结束日期"
            aria-label="拜访日期"
          />
        </div>
        <div class="list-filter-field">
          <el-input
            v-model="keyword"
            clearable
            placeholder="员工、工号、客户或门店"
            aria-label="拜访对象"
            @keyup.enter="search"
          />
        </div> </template
    ></OrderRegisterFilterCard>
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <section v-else class="finance-panel">
      <el-table v-loading="busy" :data="rows" empty-text="该范围没有实际到店记录">
        <el-table-column prop="date" label="工作日" width="114" /><el-table-column
          label="员工"
          min-width="112"
          ><template #default="{ row }">{{
            row.name || row.employee || '身份待核'
          }}</template></el-table-column
        >
        <el-table-column prop="store" label="门店" min-width="150" /><el-table-column
          prop="customer"
          label="客户"
          min-width="140"
        />
        <el-table-column label="到店 / 离店" min-width="130"
          ><template #default="{ row }"
            >{{ fieldClock(row.arrived) }} / {{ fieldClock(row.departed) }}</template
          ></el-table-column
        >
        <el-table-column label="状态" min-width="94"
          ><template #default="{ row }">{{
            statuses[row.status] || '待核实'
          }}</template></el-table-column
        >
        <el-table-column
          prop="result"
          label="现场结果"
          min-width="160"
          show-overflow-tooltip
        /> </el-table
      ><CompactPagination
        :total="total"
        :current-page="page"
        :page-size="size"
        :page-sizes="[25, 50, 100]"
        @current-change="turn"
        @size-change="resize"
      />
    </section>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { apiClient } from '@/api/core/client'
import { businessPeriodRange } from '@/utils/business-date'
import { fieldClock } from '@/api/core/sales-fieldwork'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
interface Visit {
  id: string
  date: string
  employee: string | null
  name: string | null
  store: string | null
  customer: string | null
  status: string
  arrived: string
  departed: string | null
  result: string | null
}
const statuses: Record<string, string> = {
  IN_PROGRESS: '拜访中',
  CHECKED_IN: '已到店',
  CHECKED_OUT: '已离店',
  SUBMITTED: '已提交',
  PENDING_REVIEW: '待复核',
  APPROVED: '已通过',
  ACCEPTED: '已通过',
  REJECTED: '已驳回',
  COMPLETED: '已完成',
  DRAFT: '草稿',
  FLAGGED: '待复核',
  CANCELLED: '已取消',
}
const range = ref(businessPeriodRange('month')),
  keyword = ref(''),
  page = ref(1),
  size = ref(25),
  total = ref(0),
  rows = ref<Visit[]>([]),
  busy = ref(false),
  error = ref('')
let params = { from: range.value[0], to: range.value[1], keyword: '' },
  active: AbortController | undefined
async function load() {
  active?.abort()
  const token = new AbortController()
  active = token
  busy.value = true
  error.value = ''
  rows.value = []
  try {
    const data = await apiClient.get<{ items: Visit[]; total: number }>(
      '/sales/management/visits/records',
      {
        params: { ...params, page: page.value, size: size.value },
        signal: token.signal,
        errorFeedback: 'inline',
      },
    )
    if (!token.signal.aborted) {
      rows.value = data.items
      total.value = data.total
    }
  } catch (e) {
    if (!token.signal.aborted) error.value = e instanceof Error ? e.message : '拜访记录读取失败'
  } finally {
    if (!token.signal.aborted) busy.value = false
  }
}
function search() {
  params = { from: range.value[0], to: range.value[1], keyword: keyword.value.trim() }
  turn(1)
}
function reset() {
  range.value = businessPeriodRange('month')
  keyword.value = ''
  search()
}
function turn(v: number) {
  page.value = v
  void load()
}
function resize(v: number) {
  size.value = v
  turn(1)
}
onMounted(load)
onBeforeUnmount(() => active?.abort())
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
