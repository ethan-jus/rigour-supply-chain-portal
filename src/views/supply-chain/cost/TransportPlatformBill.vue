<template>
  <section class="platform-bill">
    <h4>平台账单 <el-tag type="info" size="small">只读</el-tag></h4>
    <el-alert
      v-if="changed"
      type="warning"
      :closable="false"
      :title="`平台账单已更新，已确认成本仍为 ¥${money(confirmedAmount)}，请核对后处理。`"
    />
    <div class="bill-totals">
      <div v-for="metric in metrics" :key="metric.label">
        <span>{{ metric.label }}</span
        ><strong>{{ money(metric.value) }}</strong>
      </div>
    </div>
    <dl class="bill-meta">
      <div>
        <dt>付款状态</dt>
        <dd>{{ platformPaymentStatus(source) }}</dd>
      </div>
      <div>
        <dt>赠金抵扣（元）</dt>
        <dd>{{ money(facts?.bonusAmount) }}</dd>
      </div>
      <div>
        <dt>账单更新时间</dt>
        <dd>{{ dateTime(facts?.billUpdatedTime) }}</dd>
      </div>
      <div>
        <dt>最近同步时间</dt>
        <dd>{{ dateTime(platform.source.lastSyncedAt) }}</dd>
      </div>
    </dl>
    <h4>费用明细</h4>
    <el-table :data="facts?.fees || []" border empty-text="暂无平台费用明细">
      <el-table-column prop="name" label="费用项目" min-width="200" />
      <el-table-column label="金额（元）" width="160" align="right"
        ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
      >
      <el-table-column label="凭证" min-width="180"
        ><template #default="{ row }"
          ><template v-if="row.vouchers?.length"
            ><el-button
              v-for="v in row.vouchers"
              :key="v.id"
              link
              type="primary"
              :disabled="v.state !== 'READY'"
              @click="open(v)"
              >{{
                v.state === 'READY' ? v.name : v.state === 'FAILED' ? '获取失败' : '待获取'
              }}</el-button
            ></template
          ><span v-else>-</span></template
        ></el-table-column
      >
    </el-table>
    <h4>账单凭证</h4>
    <VoucherTable :vouchers="billFiles" @open="open" @download="download" />
    <el-collapse v-if="platform.billHistory.length" class="history"
      ><el-collapse-item title="账单变更记录" name="history"
        ><el-table :data="platform.billHistory" border
          ><el-table-column label="账单更新时间" min-width="190"
            ><template #default="{ row }">{{
              dateTime(row.facts?.billUpdatedTime)
            }}</template></el-table-column
          ><el-table-column label="账单总计（元）" align="right"
            ><template #default="{ row }">{{
              money(row.facts?.billAmount)
            }}</template></el-table-column
          ><el-table-column label="费用明细" min-width="300"
            ><template #default="{ row }">{{ historyFees(row) }}</template></el-table-column
          ></el-table
        ></el-collapse-item
      ></el-collapse
    >
    <h4>运输回单</h4>
    <dl v-if="facts?.receiptInfo" class="receipt-meta">
      <div>
        <dt>回单类型</dt>
        <dd>{{ receiptLabel('type') }}</dd>
      </div>
      <div>
        <dt>回单状态</dt>
        <dd>{{ receiptLabel('status') }}</dd>
      </div>
      <div>
        <dt>送回方式</dt>
        <dd>{{ receiptLabel('backType') }}</dd>
      </div>
      <div>
        <dt>回单寄回快递单号</dt>
        <dd>{{ facts.receiptInfo.expressNo || '-' }}</dd>
      </div>
      <div>
        <dt>回单备注</dt>
        <dd>{{ facts.receiptInfo.remark || '-' }}</dd>
      </div>
      <div v-if="facts.receiptInfo.unableToReturn === 1">
        <dt>无法送回原因</dt>
        <dd>{{ facts.receiptInfo.unableReason || '-' }}</dd>
      </div>
    </dl>
    <VoucherTable
      :vouchers="receiptFiles"
      group-label="资料类型"
      empty-text="暂无拍照回单"
      @open="open"
      @download="download"
    />
    <h4>装卸货照片</h4>
    <VoucherTable
      :vouchers="goodsFiles"
      group-label="发收货点"
      empty-text="暂无装卸货照片"
      @open="open"
      @download="download"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <CostFilePreview v-model="preview" :name="fileName" :type="fileType" :url="url" />
  </section>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import { ElButton, ElTable, ElTableColumn } from 'element-plus'
import type { PlatformTransport } from '@/api/core/transport-records'
import { getTransportVoucher } from '@/api/core/transport-records'
import { currentSource, platformPaymentStatus, type PlatformVoucher } from './huolala-source'
import { money } from './transport-records'
import CostFilePreview from './CostFilePreview.vue'
import { errorMessage } from '@/api/core/error'
import { displayRecordDateTime } from '@/utils/business-display'
const props = defineProps<{
  recordId: string
  platform: PlatformTransport
  confirmedAmount?: number | null
  confirmed: boolean
}>()
const source = computed(() => currentSource(props.platform.source))
const facts = computed(() => source.value.facts)
const changed = computed(() => props.confirmed && props.platform.source.sourceDifference)
const metrics = computed(() => [
  { label: '账单总计（元）', value: facts.value?.billAmount },
  { label: '已支付（元）', value: source.value.paidAmount },
  { label: '未支付（元）', value: facts.value?.unpaidAmount },
  { label: '退款（元）', value: facts.value?.refundAmount },
])
const billFiles = computed(() => {
  const files = [
    ...(facts.value?.fees.flatMap((f) => (f.vouchers || []).map((v) => ({ ...v, fee: f.name }))) ||
      []),
    ...(facts.value?.billVouchers || []).map((v) => ({ ...v, fee: '账单' })),
  ]
  return [...new Map(files.map((v) => [v.id, v])).values()]
})
const receiptFiles = computed(() =>
  (facts.value?.receipts || []).map((v) => ({ ...v, fee: '运输回单' })),
)
const goodsFiles = computed(() =>
  (facts.value?.stopPhotos || []).flatMap((point) =>
    point.vouchers.map((v) => ({
      ...v,
      fee: `第${point.stopIndex + 1}站 ${point.name} · ${point.phase}`,
    })),
  ),
)
function receiptLabel(field: 'type' | 'status' | 'backType') {
  const value = facts.value?.receiptInfo?.[field]
  if (value == null) return '-'
  const labels: Record<string, Record<number, string>> = {
    type: { 6: '拍照回单', 3: '纸质回单' },
    status: { 1: '待上报', 2: '司机完成', 3: '已确认', 4: '已取消' },
    backType: { 1: '开车送回', 2: '快递寄回' },
  }
  return labels[field]?.[value] || `未知（${value}）`
}
const dateTime = (v: string | null | undefined) => {
  if (!v) return '-'
  // 企业接口返回北京时间的无时区文本；自有文件时间则是带时区的Instant。
  const value = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(v)
    ? `${v.replace(' ', 'T')}+08:00`
    : v
  return displayRecordDateTime(value)
}
function historyFees(row: { facts?: { fees: { name: string; amount: unknown }[] } }) {
  return row.facts?.fees?.map((f) => `${f.name} ${money(f.amount)}`).join('；') || '-'
}
const preview = ref(false),
  fileName = ref(''),
  fileType = ref(''),
  url = ref(''),
  error = ref('')
async function open(v: PlatformVoucher) {
  error.value = ''
  try {
    const result = await getTransportVoucher(props.recordId, v.id)
    fileName.value = v.name
    fileType.value = v.contentType || ''
    url.value = result.url
    preview.value = true
  } catch (e) {
    error.value = errorMessage(e, '凭证暂未取得')
  }
}
async function download(v: PlatformVoucher) {
  error.value = ''
  try {
    const result = await getTransportVoucher(props.recordId, v.id, true)
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = v.name
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } catch (e) {
    error.value = errorMessage(e, '凭证暂未取得')
  }
}
const VoucherTable = defineComponent({
  props: {
    groupLabel: { type: String, default: '所属费用' },
    emptyText: { type: String, default: '暂无平台凭证' },
    vouchers: { type: Array as () => (PlatformVoucher & { fee: string })[], required: true },
  },
  emits: ['open', 'download'],
  setup(p, { emit }) {
    return () =>
      h(ElTable, { data: p.vouchers, border: true, emptyText: p.emptyText }, () => [
        h(ElTableColumn, { prop: 'fee', label: p.groupLabel, minWidth: 140 }),
        h(ElTableColumn, { prop: 'name', label: '文件', minWidth: 180 }),
        h(
          ElTableColumn,
          { label: '凭证状态', minWidth: 170 },
          {
            default: ({ row }: { row: PlatformVoucher }) =>
              row.state === 'READY'
                ? '已获取'
                : row.state === 'FAILED'
                  ? '获取失败，将自动重试'
                  : '待获取',
          },
        ),
        h(
          ElTableColumn,
          { label: '取得时间', minWidth: 190 },
          { default: ({ row }: { row: PlatformVoucher }) => dateTime(row.savedAt) },
        ),
        h(
          ElTableColumn,
          { label: '操作', width: 170 },
          {
            default: ({ row }: { row: PlatformVoucher }) =>
              row.state === 'READY'
                ? [
                    h(
                      ElButton,
                      { link: true, type: 'primary', onClick: () => emit('open', row) },
                      () => '查看',
                    ),
                    h(
                      ElButton,
                      { link: true, type: 'primary', onClick: () => emit('download', row) },
                      () => '下载',
                    ),
                  ]
                : '-',
          },
        ),
      ])
  },
})
</script>
<style scoped>
.platform-bill h4 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 12px;
  font-size: 15px;
}
.bill-totals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.bill-totals > div {
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  padding: 16px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bill-totals span,
dt {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.bill-totals strong {
  font-size: 23px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.bill-meta,
.receipt-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
dd {
  overflow-wrap: anywhere;
  margin: 8px 0 0;
}
.history {
  margin-top: 16px;
}
@media (max-width: 850px) {
  .bill-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bill-meta,
  .receipt-meta {
    grid-template-columns: 1fr;
  }
}
</style>
