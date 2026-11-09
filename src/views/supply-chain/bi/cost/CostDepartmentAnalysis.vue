<template>
  <section class="chart-card department-costs">
    <header>
      <h2>部门采购与物流成本</h2>
      <span>单位：元</span>
    </header>
    <p v-if="error" role="alert">
      {{ error }}<button class="text-button" @click="load">重新读取</button>
    </p>
    <p v-else-if="loading" role="status">正在读取部门成本…</p>
    <div v-else class="department-table">
      <table aria-label="部门采购及物流成本">
        <thead>
          <tr>
            <th>部门</th>
            <th class="numeric">采购货款</th>
            <th class="numeric">采购运费</th>
            <th class="numeric">采购成本合计</th>
            <th class="numeric">物流成本合计</th>
            <th>明细</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.departmentId"
            ><tr>
              <td>{{ row.departmentName }}</td>
              <td class="numeric">{{ money(row.purchaseGoods) }}</td>
              <td class="numeric">{{ money(row.purchaseFreight) }}</td>
              <td class="numeric">
                <button class="text-button" @click="detail(row, 'purchase')">
                  {{ sum(row.purchaseGoods, row.purchaseFreight) }}
                </button>
              </td>
              <td class="numeric">
                <button class="text-button" @click="detail(row, 'freight')">
                  {{ money(row.logistics) }}
                </button>
              </td>
              <td>
                <button
                  class="text-button"
                  :disabled="!row.people.length"
                  @click="expanded = expanded === row.departmentId ? '' : row.departmentId"
                >
                  {{ expanded === row.departmentId ? '收起人员' : '按人员展开' }}
                </button>
              </td>
            </tr>
            <tr v-if="expanded === row.departmentId">
              <td colspan="6">
                <table :aria-label="row.departmentName + '人员物流成本'">
                  <thead>
                    <tr>
                      <th>人员</th>
                      <th>归属角色</th>
                      <th class="numeric">物流成本（元）</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="person in row.people" :key="person.role + person.employeeCode">
                      <td>{{ person.employeeName }}</td>
                      <td>{{ person.role }}</td>
                      <td class="numeric">{{ money(person.amount) }}</td>
                      <td>
                        <button
                          class="text-button"
                          @click="detail(row, 'freight', person.employeeCode)"
                        >
                          查看单据
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
          <tr v-if="!rows.length">
            <td colspan="6" class="empty">当前期间暂无已确认采购及物流成本</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import {
  getCostDepartments,
  type CostDepartmentSummary,
  type CostQuery,
} from '@/api/core/bi-cost-dashboard'
import { errorMessage } from '@/api/core/error'
import { money } from './cost-presentation'
const props = defineProps<{ query: CostQuery }>()
const emit = defineEmits<{ detail: [query: CostQuery] }>()
const rows = ref<CostDepartmentSummary[]>([]),
  loading = ref(false),
  error = ref(''),
  expanded = ref('')
let serial = 0,
  controller: AbortController | undefined
async function load() {
  const current = ++serial
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  rows.value = []
  expanded.value = ''
  try {
    const value = await getCostDepartments(
      {
        ...props.query,
        scope: 'opex',
        category: undefined,
        dimension: undefined,
        dimensionKey: undefined,
        search: undefined,
        page: 1,
      },
      controller.signal,
    )
    if (current === serial) rows.value = value
  } catch (e) {
    if (current === serial) error.value = errorMessage(e, '部门成本读取失败')
  } finally {
    if (current === serial) loading.value = false
  }
}
watch(() => JSON.stringify(props.query), load, { immediate: true })
onBeforeUnmount(() => {
  serial++
  controller?.abort()
})
function sum(a: string, b: string) {
  const cents = (value: string) => {
    const negative = value.startsWith('-')
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
    const amount = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2))
    return negative ? -amount : amount
  }
  const total = cents(a) + cents(b)
  const absolute = total < 0 ? -total : total
  return money(
    `${total < 0 ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`,
  )
}
function detail(row: CostDepartmentSummary, category: 'purchase' | 'freight', employee?: string) {
  emit('detail', {
    scope: category === 'purchase' ? 'purchase' : 'opex',
    category,
    department: row.departmentId,
    ...(employee ? { dimension: 'employee', dimensionKey: employee } : {}),
  })
}
</script>
<style scoped>
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
header > span {
  color: var(--cost-muted, #9aadc3);
}
.department-table {
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}
th,
td {
  padding: 14px 16px;
  border-bottom: 1px solid #ffffff14;
  text-align: left;
}
.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
td[colspan] {
  padding: 12px 24px;
  background: #ffffff04;
}
</style>
