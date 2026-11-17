<template>
  <section class="platform-bill">
    <h4>平台账单 <el-tag type="info" size="small">只读</el-tag></h4>
    <el-alert
      v-if="changed"
      type="warning"
      :closable="false"
      :title="`平台账单与本系统成本不同，本系统成本为 ¥${money(confirmedAmount)}，请核对后处理。`"
    />
    <div class="bill-totals">
      <div v-for="metric in metrics" :key="metric.label">
        <span>{{ metric.label }}</span
        ><strong>{{ money(metric.value) }}</strong>
      </div>
    </div>
    <dl class="bill-meta">
      <div>
        <dt>优惠金额（元）</dt>
        <dd>{{ money(facts?.couponAmount) }}</dd>
      </div>
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
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <CostFilePreview v-model="preview" :name="fileName" :type="fileType" :url="url" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
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
}>()
const source = computed(() => currentSource(props.platform.source))
const facts = computed(() => source.value.facts)
const changed = computed(() => {
  const cost = props.confirmedAmount
  const bill = source.value.facts?.billAmount
  return cost != null && bill != null && Math.round(cost * 100) !== Math.round(Number(bill) * 100)
})
const metrics = computed(() => [
  { label: '账单总计（元）', value: facts.value?.billAmount },
  { label: '已支付（元）', value: source.value.paidAmount },
  { label: '未支付（元）', value: facts.value?.unpaidAmount },
  { label: '退款（元）', value: facts.value?.refundAmount },
])
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
</script>
<style scoped>
.platform-bill h4 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  min-width: 0;
  gap: 12px;
}
.bill-totals span,
dt {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.bill-totals strong {
  font-size: 23px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.bill-meta {
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
@container transport-record (max-width: 1000px) {
  .bill-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bill-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container transport-record (max-width: 560px) {
  .bill-totals,
  .bill-meta {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
