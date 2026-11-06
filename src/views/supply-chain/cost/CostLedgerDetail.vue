<template>
  <div class="ledger-detail">
    <el-alert
      v-if="plan?.sourceSync?.differencePending"
      title="采购约定已变化，请核对实际费用并填写变更原因。"
      type="warning"
      :closable="false"
    />
    <div class="detail-banner">
      <div>
        <span class="muted">费用单号</span>
        <h2>{{ row.documentNo }}</h2>
      </div>
      <el-tag
        :type="
          row.statusCode === 'CONFIRMED'
            ? 'success'
            : row.statusCode === 'VOID'
              ? 'info'
              : 'warning'
        "
        >{{ costLabel('COST_STATUS', row.statusCode) }}</el-tag
      >
    </div>
    <div class="detail-grid">
      <section>
        <h3>{{ logistics ? '运输信息' : '仓储信息' }}</h3>
        <dl>
          <template v-if="plan"
            ><dt>运输类型</dt>
            <dd>{{ transportTypeLabel(plan.transportPurposeCode) }}</dd>
            <dt>承运方式</dt>
            <dd>{{ costLabel('COST_DELIVERY_MODE', plan.deliveryModeCode) }}</dd>
            <dt>物流公司</dt>
            <dd>
              {{
                plan.deliveryModeCode === 'SELF'
                  ? '自营'
                  : plan.carrierCode
                    ? costLabel('COST_CARRIER', plan.carrierCode)
                    : '待补承运方'
              }}
            </dd>
            <dt>运单号</dt>
            <dd>{{ plan.trackingNo || plan.noTrackingReason || '—' }}</dd>
            <template v-if="plan.deliveryModeCode === 'SELF'"
              ><dt>司机</dt>
              <dd>{{ plan.driverName || '—' }}</dd>
              <dt>车牌号</dt>
              <dd>{{ plan.vehicleNo || '—' }}</dd></template
            >
            <dt>费用归属月份</dt>
            <dd>{{ plan.costMonth }}</dd></template
          >
          <template v-else-if="warehouse"
            ><dt>仓库</dt>
            <dd>{{ row.warehouseName || warehouse.warehouseCode }}</dd>
            <dt>收费方</dt>
            <dd>{{ providerName || row.data.payeeName || '—' }}</dd>
            <dt>合同号</dt>
            <dd>{{ warehouse.contractNo || '—' }}</dd>
            <dt>付款日期</dt>
            <dd>{{ warehouse.paymentDate || '—' }}</dd>
            <dt>押金（不计入费用）</dt>
            <dd>{{ costMoney(warehouse.depositAmount ?? 0) }}</dd></template
          >
          <template v-else
            ><dt>事项</dt>
            <dd>{{ row.data.title }}</dd>
            <dt>业务对象</dt>
            <dd>
              {{
                row.warehouseName ||
                row.data.rental?.premisesName ||
                row.data.logistics?.senderName ||
                '—'
              }}
            </dd>
            <dt>物流公司</dt>
            <dd>{{ row.data.logistics?.carrierName || '—' }}</dd>
            <dt>运单号 / 合同号</dt>
            <dd>
              {{ row.data.logistics?.trackingNo || row.data.rental?.contractNo || '—' }}
            </dd></template
          >
          <dt>{{ logistics ? '运输日期' : '登记日期' }}</dt>
          <dd>{{ row.data.costDate }}</dd>
          <dt>费用归属</dt>
          <dd>{{ row.data.cityName }}</dd>
        </dl>
      </section>
      <section>
        <h3>费用与登记信息</h3>
        <dl>
          <dt>{{ logistics ? '本单我方费用（元）' : '本单费用总额（元）' }}</dt>
          <dd class="total">{{ costMoney(row.data.amount) }}</dd>
          <dt>付款状态</dt>
          <dd>{{ costLabel('COST_PAYMENT_STATUS', row.data.paymentStatusCode) }}</dd>
          <dt>费用负责人</dt>
          <dd>{{ row.ownerEmployeeName || '—' }}</dd>
          <dt>创建人</dt>
          <dd>{{ displayRecordActor(row.createdBy) }}</dd>
          <dt>创建时间</dt>
          <dd>{{ displayRecordDateTime(row.createdTime) }}</dd>
          <dt>更新时间</dt>
          <dd>{{ displayRecordDateTime(row.updatedTime) }}</dd>
        </dl>
      </section>
    </div>
    <template v-if="plan">
      <section>
        <h3>发货信息</h3>
        <dl>
          <dt>发货方</dt>
          <dd>{{ partyName(plan.sender) }}</dd>
          <dt>发货联系人 / 联系方式</dt>
          <dd>{{ plan.sender.contactName || '—' }}　{{ plan.sender.phone || '—' }}</dd>
          <dt>发货地址</dt>
          <dd>{{ plan.sender.address }}</dd>
        </dl>
      </section>
      <section>
        <h3>收货信息</h3>
        <el-table :data="plan.receivingPoints" border
          ><el-table-column label="收货方" min-width="230"
            ><template #default="{ row: point }">{{
              partyName(point as LedgerParty)
            }}</template></el-table-column
          ><el-table-column prop="contactName" label="收货人" width="130" /><el-table-column
            prop="phone"
            label="联系方式"
            width="170" /><el-table-column prop="address" label="收货地址" min-width="300"
        /></el-table>
      </section>
      <section>
        <h3>费用项目</h3>
        <el-table :data="plan.feeItems" border
          ><el-table-column label="费用项目"
            ><template #default="{ row: fee }">{{
              costLabel('COST_LOGISTICS_FEE_TYPE', fee.feeTypeCode)
            }}</template></el-table-column
          ><el-table-column label="承担方"
            ><template #default="{ row: fee }">{{
              bearers[fee.bearerCode] || fee.bearerCode
            }}</template></el-table-column
          ><el-table-column label="费用总额（元）" align="right"
            ><template #default="{ row: fee }">{{
              fee.feeAmount == null ? '未知' : costMoney(fee.feeAmount)
            }}</template></el-table-column
          ><el-table-column label="我方费用（元）" align="right"
            ><template #default="{ row: fee }">{{
              costMoney(fee.ourAmount)
            }}</template></el-table-column
          ><el-table-column label="原因 / 说明" min-width="210"
            ><template #default="{ row: fee }">{{
              fee.zeroCostReason || fee.remark || '—'
            }}</template></el-table-column
          ></el-table
        >
      </section>
      <section>
        <h3>单据关联与分摊</h3>
        <el-table :data="sourceRows" border
          ><el-table-column prop="type" label="单据类型" width="130" /><el-table-column
            prop="code"
            label="单据编号"
            min-width="230" /><el-table-column
            prop="role"
            label="关联用途"
            width="140" /><el-table-column
            prop="fee"
            label="费用项目"
            min-width="150" /><el-table-column
            prop="point"
            label="收货方"
            min-width="210" /><el-table-column label="分摊金额（元）" align="right" width="165"
            ><template #default="{ row: link }">{{
              costMoney(link.amount)
            }}</template></el-table-column
          ><el-table-column prop="reason" label="说明" min-width="200"
        /></el-table>
      </section>
    </template>
    <template v-else-if="warehouse"
      ><section>
        <h3>费用项目</h3>
        <el-table :data="warehouse.feeItems" border
          ><el-table-column label="费用项目"
            ><template #default="{ row: fee }">{{
              costLabel('COST_WAREHOUSE_FEE_TYPE', fee.feeTypeCode)
            }}</template></el-table-column
          ><el-table-column label="费用金额（元）" align="right"
            ><template #default="{ row: fee }">{{
              costMoney(fee.feeAmount)
            }}</template></el-table-column
          ><el-table-column label="归属方式"
            ><template #default="{ row: fee }">{{
              costLabel('COST_WAREHOUSE_ALLOCATION_METHOD', fee.allocationMethodCode)
            }}</template></el-table-column
          ><el-table-column label="归属日期 / 服务期间" min-width="230"
            ><template #default="{ row: fee }">{{
              fee.attributionDate || `${fee.serviceFrom || '—'} 至 ${fee.serviceTo || '—'}`
            }}</template></el-table-column
          ><el-table-column prop="remark" label="说明"
        /></el-table>
      </section>
      <section>
        <h3>月度归属</h3>
        <el-table :data="warehouseMonths(warehouse)" border
          ><el-table-column prop="month" label="费用归属月份" /><el-table-column
            label="归属费用（元）"
            align="right"
            ><template #default="{ row: month }">{{
              costMoney(month.amount)
            }}</template></el-table-column
          ></el-table
        >
      </section></template
    >
    <template v-else
      ><section v-if="logistics">
        <h3>收货方</h3>
        <div v-for="(name, i) in receiverNames(row)" :key="i">{{ name }}</div>
        <p>{{ row.data.logistics?.destinationAddress || '—' }}</p>
      </section>
      <section v-if="row.sources.length">
        <h3>原始关联单据</h3>
        <el-table :data="row.sources" border
          ><el-table-column prop="documentNo" label="单据编号" /><el-table-column
            prop="senderName"
            label="发货方" /><el-table-column prop="receiverName" label="收货方"
        /></el-table></section
    ></template>
    <section>
      <h3>备注</h3>
      <p class="remark">{{ row.data.remark || '—' }}</p>
    </section>
    <section><CostAttachments :category="category" :row="row" :editable="false" /></section>
  </div>
</template>
<script setup lang="ts">
import { transportTypeLabel, logisticsOrderTypeLabel } from './cost-transport-types'
import { computed, ref, watch } from 'vue'
import { getLedgerParties } from '@/api/core/cost-ledger'
import type { CostCategory, CostRecord } from '@/api/core/cost'
import { costMoney, costLabel } from './cost-dictionaries'
import { partyName, receiverNames, warehouseMonths, type LedgerParty } from './cost-ledger'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import CostAttachments from './CostAttachments.vue'
const props = defineProps<{ row: CostRecord; category: CostCategory }>()
const plan = computed(() => props.row.data.ledger)
const warehouse = computed(() => props.row.data.warehouseLedger)
const providerName = ref('')
let lookup = 0
watch(
  () => warehouse.value?.serviceProviderCode,
  async (code) => {
    const current = ++lookup
    providerName.value = code || ''
    if (!code) return
    try {
      const rows = await getLedgerParties(false, 'SUPPLIER', { code })
      if (current === lookup) providerName.value = rows.find((r) => r.code === code)?.name || code
    } catch {
      /* A historical code remains visible if the archive is unavailable. */
    }
  },
  { immediate: true },
)
const logistics = computed(() => props.category === 'logistics')
const bearers: Record<string, string> = {
  COMPANY: '我方承担',
  SUPPLIER: '供应商承担',
  CUSTOMER: '客户承担',
  SHARED: '共同承担',
}
const sourceRows = computed(
  () =>
    plan.value?.sources.flatMap((s) => {
      const base = {
        type: logisticsOrderTypeLabel(s.orderTypeCode),
        code: s.orderCode || '—',
        role: s.linkRoleCode === 'TRACE' ? '仅业务追溯' : '成本归属',
        reason: s.noSourceReason || '',
      }
      if (!s.allocations?.length) return [{ ...base, fee: '—', point: '—', amount: 0 }]
      return s.allocations.map((a) => ({
        ...base,
        fee: costLabel(
          'COST_LOGISTICS_FEE_TYPE',
          plan.value!.feeItems.find((f) => f.feeKey === a.feeKey)?.feeTypeCode,
        ),
        point: partyName(
          plan.value!.receivingPoints.find((p) => p.pointCode === a.receivingPointCode)!,
        ),
        amount: a.amount,
      }))
    }) || [],
)
</script>
<style scoped>
.ledger-detail {
  padding: 2px;
}
.detail-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 20px;
}
.detail-banner h2 {
  margin: 5px 0;
  font-size: 23px;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ledger-detail section {
  background: white;
  padding: 22px;
  border: 1px solid #dce4ee;
  border-radius: 8px;
  margin-bottom: 18px;
}
.ledger-detail h3 {
  margin: 0 0 18px;
  font-size: 16px;
}
.ledger-detail dl {
  margin: 0;
  display: grid;
  grid-template-columns: 145px minmax(0, 1fr);
  gap: 12px 15px;
}
.ledger-detail dt,
.muted {
  color: var(--el-text-color-secondary);
}
.ledger-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.total {
  color: var(--el-color-primary);
  font-size: 22px;
  font-weight: 650;
}
.remark {
  white-space: pre-wrap;
  margin: 0;
}
@media (max-width: 850px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
