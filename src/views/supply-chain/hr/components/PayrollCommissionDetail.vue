<template>
  <div class="commission-toolbar">
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
    整单付清后计提。展开分类查看商品，再展开商品查看订单；金额取自本次核算快照。
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
            <el-table-column prop="name" label="商品／规格" min-width="200" show-overflow-tooltip />
            <el-table-column
              prop="variantCode"
              label="规格编码"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column prop="role" label="提成角色" width="110" />
            <el-table-column label="计提数量" width="105" align="right"
              ><template #default="{ row }"
                >{{ row.quantity }} {{ costLabel('PRODUCT_UNIT', row.unit) }}</template
              ></el-table-column
            >
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
    <el-table-column prop="name" label="ERP 商品分类" min-width="220" />
    <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
    <el-table-column prop="lineCount" label="计提明细数" width="110" align="right" />
    <el-table-column v-if="pendingCount" label="已计算（元）" width="140" align="right"
      ><template #default="{ row }">{{ payrollMoney(row.knownAmount) }}</template></el-table-column
    >
    <el-table-column
      v-if="pendingCount"
      prop="pendingCount"
      label="待核定明细数"
      width="120"
      align="right"
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
import { computed, ref } from 'vue'
import type { PayrollDetail } from '@/api/core/payroll'
import { commissionCategories } from '@/utils/payroll-commission-detail'
import { payrollMoney } from '@/utils/payroll-workflow'
import { costLabel } from '../../cost/cost-dictionaries'
import PayrollCommissionOrderTable from './PayrollCommissionOrderTable.vue'
const props = defineProps<{ lines: PayrollDetail[]; total: number | null }>()
const mode = ref('category')
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
      : `${rate} 元/${costLabel('PRODUCT_UNIT', unit)}`
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
