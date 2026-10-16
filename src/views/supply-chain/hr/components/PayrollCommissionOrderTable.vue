<template>
  <el-table :data="lines" border max-height="560" empty-text="本月无计提订单">
    <el-table-column prop="orderNo" label="订单号" min-width="185" fixed="left" />
    <el-table-column
      prop="trace.product.categoryPath"
      label="商品分类"
      min-width="175"
      show-overflow-tooltip
    />
    <el-table-column prop="productName" label="商品／规格" min-width="195" show-overflow-tooltip />
    <el-table-column prop="trace.orderDate" label="订单日期" width="115" />
    <el-table-column prop="trace.fullyPaidDate" label="整单付清日期" width="120" />
    <el-table-column label="提成角色" width="110"
      ><template #default="{ row }">{{
        commissionRole(row.recipientRoleCode)
      }}</template></el-table-column
    >
    <el-table-column prop="sourceEmployeeCode" label="销售员工编号" width="165" />
    <el-table-column label="数量" width="100" align="right"
      ><template #default="{ row }"
        >{{ row.quantity }} {{ costLabel('PRODUCT_UNIT', row.unitCode) }}</template
      ></el-table-column
    >
    <el-table-column label="计提基数" width="125" align="right"
      ><template #default="{ row }">{{
        row.trace?.method === 'QUANTITY'
          ? row.trace?.baseAmount
          : payrollMoney(row.trace?.baseAmount)
      }}</template></el-table-column
    >
    <el-table-column label="提成标准" width="120" align="right"
      ><template #default="{ row }">{{
        row.trace?.rate == null
          ? '未匹配'
          : row.trace.method === 'PERCENT'
            ? `${row.trace.rate}%`
            : `${row.trace.rate} 元/${costLabel('PRODUCT_UNIT', row.unitCode)}`
      }}</template></el-table-column
    >
    <el-table-column label="本月提成（元）" width="135" align="right"
      ><template #default="{ row }">{{ payrollMoney(row.released) }}</template></el-table-column
    >
    <el-table-column label="关联规则" min-width="220"
      ><template #default="{ row }"
        >{{ row.ruleName || '未匹配规则' }}
        <div class="field-hint">
          {{ row.trace?.appliedRule?.ruleCode || row.trace?.ruleCode || '—'
          }}<span v-if="row.ruleRevision"> · v{{ row.ruleRevision }}</span>
        </div></template
      ></el-table-column
    >
    <el-table-column prop="message" label="计算说明" min-width="260" />
    <el-table-column label="来源依据" width="110" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click="selected = row as PayrollDetail">回款依据</el-button>
      </template>
    </el-table-column>
  </el-table>
  <el-dialog
    :model-value="!!selected"
    title="整单回款依据"
    width="800px"
    append-to-body
    @close="selected = null"
  >
    <template v-if="selected">
      <el-descriptions border :column="2">
        <el-descriptions-item label="订单号">{{ selected.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="核算截至日">{{
          selected.trace?.settlement?.through || '历史快照未记录'
        }}</el-descriptions-item>
        <el-descriptions-item label="整单应收（元）">{{
          payrollMoney(selected.trace?.settlement?.orderAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="累计有效回款（元）">{{
          payrollMoney(selected.trace?.settlement?.paidAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="累计退款（元）">{{
          payrollMoney(selected.trace?.settlement?.refundedAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="首次整单付清日期">{{
          selected.trace?.fullyPaidDate || '尚未付清'
        }}</el-descriptions-item>
      </el-descriptions>
      <p class="field-hint">
        以上金额为本次工资核算保存的快照。回款单列表展示订单服务当前记录，后续退款或更正不会覆盖此快照。
      </p>
      <el-button v-if="can('order:read')" type="primary" @click="openReceipts"
        >查看此订单回款单</el-button
      >
      <p v-else class="field-hint">回款原单需要订单查看权限；当前可核对工资快照。</p>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { PayrollDetail } from '@/api/core/payroll'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { payrollMoney } from '@/utils/payroll-workflow'
import { commissionRole } from '@/utils/payroll-commission-detail'
import { costLabel } from '../../cost/cost-dictionaries'
defineProps<{ lines: PayrollDetail[] }>()
const selected = ref<PayrollDetail | null>(null)
const router = useRouter()
const { can } = useSupplyPermissions()
function openReceipts() {
  if (!selected.value?.orderNo || !can('order:read')) return
  void router.push({
    path: '/supply-chain/order/sales-payments',
    query: { orderNo: selected.value.orderNo },
  })
  selected.value = null
}
</script>
