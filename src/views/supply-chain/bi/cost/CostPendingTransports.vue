<template>
  <div class="cost-modal-backdrop" @click.self="$emit('close')">
    <section
      v-cost-dialog
      class="cost-modal pending-transports"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-transports-title"
      @keydown.esc="$emit('close')"
    >
      <header>
        <div>
          <h2 id="pending-transports-title">待完善运输记录</h2>
          <p class="muted">{{ range }}</p>
        </div>
        <button aria-label="关闭待完善运输记录" @click="$emit('close')">关闭</button>
      </header>
      <div class="controls pending-actions">
        <span v-if="scopeTotal !== null" class="pending-count">
          本期待完善 <strong>{{ scopeTotal }} 笔</strong>
          <span v-if="reason && !loading && !error" class="muted"> · 当前筛选 {{ total }} 笔</span>
        </span>
        <label>
          待补资料
          <select v-model="reason" aria-label="待补资料" @change="load(1)">
            <option value="">全部缺项</option>
            <option v-for="(item, code) in items" :key="code" :value="code">
              {{ code === 'AMOUNT' ? '缺运费或平台账单金额' : item.label }}
            </option>
          </select>
        </label>
        <RouterLink
          v-if="canEdit"
          class="text-button"
          :to="{ path: '/supply-chain/cost/logistics', query: { action: 'import-freight' } }"
        >
          批量补录运费
        </RouterLink>
      </div>
      <div v-if="error" class="cost-message error" role="alert">
        {{ error }}
        <button class="text-button" @click="load(page)">重试</button>
      </div>
      <p v-else-if="loading" class="empty" role="status">正在读取待完善记录…</p>
      <template v-else>
        <p v-if="!total" class="empty">
          {{ reason ? '当前范围没有该缺项的运输记录。' : '当前范围没有待完善运输记录。' }}
        </p>
        <template v-else>
          <p v-if="!canEdit" class="muted">请联系有运输记录编辑权限的同事补齐。</p>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>费用单号</th>
                  <th>费用日期／所属月</th>
                  <th>费用归属</th>
                  <th>缺少什么／去哪里补</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id">
                  <td>
                    <RouterLink v-if="canRead" :to="transportLink(row.id)" class="text-button">{{
                      row.documentNo
                    }}</RouterLink>
                    <span v-else>{{ row.documentNo }}</span>
                  </td>
                  <td>{{ row.costMonth || row.date }}</td>
                  <td>{{ row.cityName }}</td>
                  <td>
                    <ul class="pending-items">
                      <li v-for="item in missingItems(row)" :key="item.label">
                        <span>{{ item.label }}</span>
                        <RouterLink
                          v-if="canRead && item.section && (canEdit || item.readonly)"
                          :to="transportLink(row.id, item.section, !item.readonly)"
                          class="text-button"
                          >{{ item.action }}</RouterLink
                        >
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <span>共 {{ total }} 笔 · 第 {{ page }} / {{ pageCount }} 页</span>
            <button :disabled="page === 1" @click="load(page - 1)">上一页</button>
            <button :disabled="page >= pageCount" @click="load(page + 1)">下一页</button>
          </div>
        </template>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getPendingTransports,
  type CostQuery,
  type PendingTransport,
} from '@/api/core/bi-cost-dashboard'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { costDialog as vCostDialog } from './cost-dialog'

const props = defineProps<{ query: CostQuery; range: string }>()
const emit = defineEmits<{ close: []; count: [count: number] }>()
const { can } = useSupplyPermissions()
const canRead = computed(() => can('order:logistics-cost:read'))
const canEdit = computed(() => canRead.value && can('order:logistics-cost:write'))
const rows = ref<PendingTransport[]>([])
const reason = ref('')
const scopeTotal = ref<number | null>(null)
const total = ref(0),
  page = ref(1),
  size = ref(20),
  loading = ref(false),
  error = ref('')
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
let controller: AbortController | undefined

async function load(target: number) {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  loading.value = true
  error.value = ''
  try {
    const result = await getPendingTransports(
      { ...props.query, page: target, ...(reason.value ? { reason: reason.value } : {}) },
      signal,
    )
    if (signal.aborted) return
    total.value = result.total
    size.value = result.size
    scopeTotal.value = result.scopeTotal
    emit('count', result.scopeTotal)
    if (result.total && target > pageCount.value) {
      await load(pageCount.value)
      return
    }
    page.value = result.page
    rows.value = result.items
  } catch (e) {
    if (!signal.aborted) error.value = errorMessage(e, '待完善记录读取失败，请重试')
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

interface MissingItem {
  label: string
  action?: string
  section?: 'fees' | 'orders' | 'evidence'
  readonly?: boolean
}
const items: Record<string, MissingItem> = {
  AMOUNT: { label: '缺运费', action: '去补运费', section: 'fees' },
  ORDER: { label: '尚未关联业务订单', action: '关联业务订单', section: 'orders' },
  EMPLOYEE: { label: '关联业务单缺业务员', action: '去核对业务订单', section: 'orders' },
  DEPARTMENT: { label: '关联业务单缺部门', action: '去核对业务订单', section: 'orders' },
  EVIDENCE: { label: '缺凭证', action: '去上传凭证', section: 'evidence' },
}
function missingItems(row: PendingTransport): MissingItem[] {
  const known = row.missing
    .filter((code) => Object.hasOwn(items, code))
    .map((code) =>
      code === 'AMOUNT' && row.sourceSystem === 'HUOLALA'
        ? {
            label: '缺平台账单金额',
            action: '去核对平台账单',
            section: 'fees' as const,
            readonly: true,
          }
        : items[code]!,
    )
  return known.length ? known : [{ label: '请打开运输记录核对待补资料' }]
}
function transportLink(sourceId: string, section?: string, edit = false) {
  return {
    path: '/supply-chain/cost/logistics',
    query: { sourceId, ...(section ? { section } : {}), ...(edit ? { edit: '1' } : {}) },
  }
}
onMounted(() => void load(1))
onBeforeUnmount(() => controller?.abort())
</script>

<style scoped>
.pending-transports .muted {
  margin-block: 6px 0;
}
.pending-actions {
  margin-bottom: 12px;
}
.pending-items {
  display: grid;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.pending-items li {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 12px;
}
.pending-transports a {
  text-decoration: none;
}
</style>
