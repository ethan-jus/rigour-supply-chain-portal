<template>
  <div class="commission-toolbar">
    <strong>回款合计：{{ payrollMoney(collectionTotal) }} 元</strong>
    <strong>提成合计：{{ payrollMoney(total) }} 元</strong>
    <span v-if="pendingCount"
      >已计算 {{ payrollMoney(knownAmount) }} 元 · {{ pendingCount }} 条待核定</span
    >
    <el-radio-group v-model="mode" size="small"
      ><el-radio-button value="category">商品分类汇总</el-radio-button
      ><el-radio-button value="orders">订单明细</el-radio-button></el-radio-group
    >
  </div>
  <p class="field-hint">
    整单付清后计提。展开分类查看商品，再展开商品查看订单；金额取自本次核算快照。回款按整单应收金额和商品金额占比分摊，同一订单商品只累计一次；历史快照缺少依据时显示“待核定”。
    <span v-if="mode === 'category'">{{ commissionCountExplanation }}</span>
  </p>
  <el-table
    v-if="mode === 'category'"
    :data="categories"
    border
    row-key="key"
    empty-text="本月无商品提成明细"
  >
    <el-table-column type="expand">
      <template #default="{ row: category }">
        <div class="nested-table">
          <el-table :data="category.products" border row-key="key">
            <el-table-column type="expand"
              ><template #default="{ row: product }"
                ><div class="nested-table">
                  <PayrollCommissionOrderTable :lines="product.lines" /></div></template
            ></el-table-column>
            <el-table-column
              prop="name"
              label="商品／规格"
              min-width="200"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column
              prop="variantCode"
              label="规格编码"
              min-width="150"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column prop="role" label="提成角色" width="110" :formatter="displayCell" />
            <el-table-column label="计提数量" width="105" align="right"
              ><template #default="{ row }"
                >{{ row.quantity }} {{ payrollUnitName(row.unit) }}</template
              ></el-table-column
            >
            <el-table-column label="商品回款额（元）" width="155" align="right">
              <template #default="{ row }">{{ payrollMoney(row.collectionAmount) }}</template>
            </el-table-column>
            <el-table-column label="计提基数" width="120" align="right"
              ><template #default="{ row }">{{
                row.method === 'QUANTITY' ? row.base : payrollMoney(row.base)
              }}</template></el-table-column
            >
            <el-table-column label="提成标准" width="110" align="right"
              ><template #default="{ row }">{{
                rateText(row.method, row.rate, row.unit)
              }}</template></el-table-column
            >
            <el-table-column label="提成（元）" width="120" align="right"
              ><template #default="{ row }">{{
                payrollMoney(row.amount)
              }}</template></el-table-column
            >
            <el-table-column label="关联规则" min-width="235"
              ><template #default="{ row }"
                >{{ row.rule }}
                <div class="field-hint">
                  {{ row.ruleCode }}<span v-if="row.version"> · v{{ row.version }}</span>
                </div></template
              ></el-table-column
            >
          </el-table>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="ERP 商品分类" min-width="220" :formatter="displayCell" />
    <el-table-column label="回款合计（元）" width="155" align="right">
      <template #default="{ row }">{{ payrollMoney(row.collectionAmount) }}</template>
    </el-table-column>
    <el-table-column
      prop="orderCount"
      label="订单数（笔）"
      width="110"
      align="right"
      :formatter="displayCell"
    />
    <el-table-column
      prop="lineCount"
      label="商品提成记录（条）"
      width="160"
      align="right"
      :formatter="displayCell"
    />
    <el-table-column v-if="pendingCount" label="已计算（元）" width="140" align="right"
      ><template #default="{ row }">{{ payrollMoney(row.knownAmount) }}</template></el-table-column
    >
    <el-table-column
      v-if="pendingCount"
      prop="pendingCount"
      label="待核定记录（条）"
      width="150"
      align="right"
      :formatter="displayCell"
    />
    <el-table-column label="分类提成合计（元）" width="170" align="right"
      ><template #default="{ row }"
        ><strong>{{ payrollMoney(row.amount) }}</strong></template
      ></el-table-column
    >
  </el-table>
  <PayrollCommissionOrderTable v-else :lines="lines" />
</template>
<script setup lang="ts">
import { displayCell, displayAmount as payrollMoney } from '@/utils/business-display'
import { onMounted, computed, ref } from 'vue'
import type { PayrollDetail } from '@/api/core/payroll'
import {
  commissionCategories,
  commissionCollections,
  commissionCountExplanation,
} from '@/utils/payroll-commission-detail'

import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
import PayrollCommissionOrderTable from './PayrollCommissionOrderTable.vue'
const props = defineProps<{ lines: PayrollDetail[]; total: number | null }>()
const mode = ref('category')
const collectionTotal = computed(() => commissionCollections(props.lines))
const categories = computed(() => commissionCategories(props.lines))
const knownAmount = computed(
  () => categories.value.reduce((s, c) => s + Math.round(c.knownAmount * 100), 0) / 100,
)
const pendingCount = computed(() => categories.value.reduce((s, c) => s + c.pendingCount, 0))
const rateText = (method: string | null, rate: number | null, unit: string) =>
  rate == null
    ? '未匹配'
    : method === 'PERCENT'
      ? `${rate}%`
      : `${rate} 元/${payrollUnitName(unit)}`
onMounted(() => {
  void loadPayrollProductUnits()
})
</script>
<style scoped>
.commission-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 8px 0 16px;
}
.commission-toolbar .el-radio-group {
  margin-left: auto;
}
.nested-table {
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
}
</style>
