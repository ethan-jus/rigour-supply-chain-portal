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
            <th v-if="columns.purchaseGoods" class="numeric">采购货款</th>
            <th v-if="columns.purchaseFreight" class="numeric">采购运费</th>
            <th v-if="columns.purchaseTotal" class="numeric">采购成本合计</th>
            <th v-for="type in transportTypes" :key="type.key" class="numeric">{{ type.label }}</th>
            <th v-if="columns.logistics" class="numeric">物流成本合计</th>
            <th>明细</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in visibleRows" :key="row.departmentId"
            ><tr>
              <td>{{ row.departmentName }}</td>
              <td v-if="columns.purchaseGoods" class="numeric">{{ money(row.purchaseGoods) }}</td>
              <td v-if="columns.purchaseFreight" class="numeric">
                {{ money(row.purchaseFreight) }}
              </td>
              <td v-if="columns.purchaseTotal" class="numeric">
                <button class="text-button" @click="detail(row, 'purchase')">
                  {{ purchaseTotal(row) }}
                </button>
              </td>
              <td v-for="type in transportTypes" :key="type.key" class="numeric">
                <button class="text-button" @click="transportDetail(row, type.key)">
                  {{ money(row.transportTypes?.find((t) => t.key === type.key)?.amount || '0') }}
                </button>
              </td>
              <td v-if="columns.logistics" class="numeric">
                <button class="text-button" @click="detail(row, 'freight')">
                  {{ money(row.logistics) }}
                </button>
              </td>
              <td>
                <button
                  class="text-button"
                  v-if="row.people.length"
                  @click="expanded = expanded === row.departmentId ? '' : row.departmentId"
                >
                  {{ expanded === row.departmentId ? '收起人员' : '按人员展开' }}
                </button>
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="expanded === row.departmentId">
              <td :colspan="columnCount">
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
          <tr v-if="!visibleRows.length">
            <td :colspan="columnCount" class="empty">当前期间暂无非零采购及物流成本</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import {
  getCostDepartments,
  type CostDepartmentSummary,
  type CostQuery,
} from '@/api/core/bi-cost-dashboard'
import { errorMessage } from '@/api/core/error'
import { loadCostDictionaryCodes } from '../../cost/cost-dictionaries'
import { transportTypes as standardTransportTypes } from '../../cost/transport-records'
import { dictionaryCodeForKey, dictionaryValue, money } from './cost-presentation'
const props = defineProps<{ query: CostQuery }>()
const emit = defineEmits<{ detail: [query: CostQuery] }>()
const rows = ref<CostDepartmentSummary[]>([]),
  loading = ref(false),
  error = ref(''),
  expanded = ref('')

const hasAmount = (amount: string) => Number(amount) !== 0
const visibleRows = computed(() =>
  rows.value
    .filter(
      (row) =>
        [row.purchaseGoods, row.purchaseFreight, row.logistics].some(hasAmount) ||
        row.transportTypes?.some((type) => hasAmount(type.amount)),
    )
    .map((row) => ({ ...row, people: row.people.filter((person) => hasAmount(person.amount)) })),
)
const columns = computed(() => ({
  purchaseGoods: visibleRows.value.some((row) => hasAmount(row.purchaseGoods)),
  purchaseFreight: visibleRows.value.some((row) => hasAmount(row.purchaseFreight)),
  purchaseTotal: visibleRows.value.some((row) => purchaseCents(row) !== 0n),
  logistics: visibleRows.value.some((row) => hasAmount(row.logistics)),
}))
const transportTypes = computed(() => {
  const types = new Map<string, string>()
  for (const row of visibleRows.value) {
    for (const type of row.transportTypes || []) {
      if (hasAmount(type.amount)) types.set(type.key, type.label)
    }
  }
  return [...types].map(([key, label]) => ({ key, label: transportLabel(key, label) }))
})
const columnCount = computed(
  () => 2 + Object.values(columns.value).filter(Boolean).length + transportTypes.value.length,
)

const transportDictionary = (key: string) => dictionaryCodeForKey(key) ?? 'COST_TRANSPORT_PURPOSE'
function transportLabel(key: string, label: string) {
  const code = key.slice(key.lastIndexOf(':') + 1)
  const savedName = label && label !== key && label !== code ? label : undefined
  return dictionaryValue(
    `dict:${transportDictionary(key)}:${code}`,
    savedName ??
      standardTransportTypes.find((type) => type.value === code)?.label ??
      '未记录运输类型',
  )
}

function transportDetail(row: CostDepartmentSummary, key: string) {
  emit('detail', {
    scope: 'opex',
    category: 'freight',
    department: row.departmentId,
    dimension: 'leg',
    dimensionKey: key,
  })
}
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
    if (current !== serial) return
    rows.value = value
    const dictionaries = transportTypes.value.map((type) => transportDictionary(type.key))
    if (dictionaries.length) void loadCostDictionaryCodes(dictionaries, false, 'inline')
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
function cents(value: string) {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const amount = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2))
  return negative ? -amount : amount
}
function purchaseCents(row: CostDepartmentSummary) {
  return cents(row.purchaseGoods) + cents(row.purchaseFreight)
}
function purchaseTotal(row: CostDepartmentSummary) {
  const total = purchaseCents(row)
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
