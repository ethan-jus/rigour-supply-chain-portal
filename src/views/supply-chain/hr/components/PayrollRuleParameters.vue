<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PayrollComponentDefinition } from '@/api/core/payroll-scheme/models/PayrollComponentDefinition'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'
import { getPayrollProducts, type PayrollCategory, type PayrollProduct } from '@/api/core/payroll'
import { payrollUnitName } from '@/utils/payroll-dictionaries'
import { targetMetrics } from '../target-settings-model'
import { getPayrollComponents } from '@/api/core/payroll-scheme/components'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { prorationOptions } from '@/utils/payroll-scheme'
import { commissionProductRows } from '@/utils/payroll-commission-rows'
import { displayAmount, displayCell, displayValue } from '@/utils/business-display'
import {
  commissionMethodLabel,
  commissionDateOptions,
  checkinCountOptions,
  managerProtectionUnitOptions,
  managerSourceOptions,
  metricScoringOptions,
  coefficientModeOptions,
  performanceModeOptions,
  payrollOptionLabel,
  payrollMinimumMinutes,
  payrollRatePercent,
} from '@/utils/payroll-rule-options'

const props = defineProps<{
  definition: PayrollComponentDefinition
  categories: PayrollCategory[]
}>()
const performance = computed(() => props.definition.performance)
const commission = computed(() => props.definition.commission)
const salary = computed(() => props.definition.salary)
const firstSalaryTier = computed(() => {
  const current = salary.value
  return (
    current?.baseSalary.tiers.find((tier) => tier.code === current.baseSalary.firstMonthTier)
      ?.name || '-'
  )
})
const allowancePlan = ref<PayrollComponentVersionView | null>(null)
const allowanceLoading = ref(false)
let allowanceRequest = 0
watch(
  () => salary.value?.personalPolicy?.allowanceVersionId,
  async (id) => {
    const current = ++allowanceRequest
    allowancePlan.value = null
    allowanceLoading.value = !!id
    if (!id) return
    try {
      const plans = await getPayrollComponents('ALLOWANCE')
      if (current === allowanceRequest)
        allowancePlan.value = plans.find((plan) => plan.id === id) ?? null
    } catch {
      /* 历史关联仍保留，读取失败不能将它显示为未关联。 */
    } finally {
      if (current === allowanceRequest) allowanceLoading.value = false
    }
  },
  { immediate: true },
)
const prorationName = (code: string | undefined) =>
  prorationOptions.find((option) => option.value === code)?.label || '-'
const products = ref<PayrollProduct[]>([])
const loadingProducts = ref(false)
const scopeKey = (rule: PayrollSchemeCommissionRule) =>
  JSON.stringify(
    [rule.categoryIds, rule.variantIds, rule.excludedCategoryIds, rule.excludedVariantIds].map(
      (ids) => [...new Set(ids.map(String))].sort(),
    ),
  )
const commissionDetailRows = computed(() => {
  const groups = new Map<
    string,
    {
      groupKey: string
      rows: Array<
        PayrollSchemeCommissionRule & { product: ReturnType<typeof commissionProductRows>[number] }
      >
    }
  >()
  for (const rule of commission.value?.rules ?? []) {
    for (const product of commissionProductRows(rule, products.value)) {
      const key = product.variantId ? `sku:${product.variantId}` : `category:${scopeKey(rule)}`
      if (!groups.has(key)) groups.set(key, { groupKey: key, rows: [] })
      groups.get(key)!.rows.push({
        ...rule,
        product: { ...product, productName: product.variantId ? product.productName : '' },
      })
    }
  }
  return [...groups.values()].flatMap((group, groupIndex) => {
    const unitKey = (row: PayrollSchemeCommissionRule) =>
      row.method === 'QUANTITY' ? `unit:${row.unitCode}` : row.method
    const units = [...new Set(group.rows.map(unitKey))]
    const ordered = [...group.rows].sort(
      (a, b) =>
        units.indexOf(unitKey(a)) - units.indexOf(unitKey(b)) ||
        (a.recipientRole === 'SALES' ? 0 : 1) - (b.recipientRole === 'SALES' ? 0 : 1),
    )
    const unitLabel = (row: PayrollSchemeCommissionRule) =>
      !row.excluded && row.method === 'QUANTITY' ? row.unitCode : '-'
    return ordered.map((row, index) => {
      const sameUnit = (other: PayrollSchemeCommissionRule) =>
        unitKey(other) === unitKey(row) && unitLabel(other) === unitLabel(row)
      const nextUnit = ordered.slice(index).findIndex((other) => !sameUnit(other))
      return {
        ...row,
        groupKey: group.groupKey,
        groupIndex,
        groupFirst: index === 0,
        groupSize: ordered.length,
        unitSpan:
          index && sameUnit(ordered[index - 1]!)
            ? 0
            : nextUnit === -1
              ? ordered.length - index
              : nextUnit,
      }
    })
  })
})
type CommissionDetailRow = (typeof commissionDetailRows.value)[number]
const expandedCommissionGroups = ref(new Set<string>())
function commissionExpanded(row: CommissionDetailRow, expanded: CommissionDetailRow[] | boolean) {
  if (Array.isArray(expanded)) {
    expandedCommissionGroups.value = new Set(expanded.map((item) => item.groupKey))
    return
  }
  const groups = new Set(expandedCommissionGroups.value)
  if (expanded) groups.add(row.groupKey)
  else groups.delete(row.groupKey)
  expandedCommissionGroups.value = groups
}
function commissionSpan({ row, columnIndex }: { row: CommissionDetailRow; columnIndex: number }) {
  // An expanded HTML row must not fall inside a rowspan; keep that product's cells separate while open.
  if (expandedCommissionGroups.value.has(row.groupKey)) return [1, 1]
  if (columnIndex <= 3) return row.groupFirst ? [row.groupSize, 1] : [0, 0]
  if (columnIndex === 4) return row.unitSpan ? [row.unitSpan, 1] : [0, 0]
  return [1, 1]
}
const commissionRowClass = ({ row }: { row: CommissionDetailRow }) =>
  `commission-product-group-${row.groupIndex % 2}${row.groupFirst ? ' commission-product-group-start' : ''}`
const value = (input: unknown) =>
  input == null ? '-' : typeof input === 'boolean' ? (input ? '是' : '否') : String(input)
const percent = (input: number | null | undefined) => (input == null ? '-' : `${input}%`)
const salesFields = computed(() => {
  const sales = performance.value?.sales
  return sales
    ? [
        ['打卡与有效拜访权重', percent(sales.processPercent)],
        ['回款考核权重', sales.processPercent == null ? '-' : percent(100 - sales.processPercent)],
        ['每日打卡目标（次）', sales.dailyCheckins],
        ['每次缺卡扣减（元）', sales.checkinPenalty],
        ['每日有效拜访目标（次）', sales.dailyVisits],
        ['每次缺拜访扣减（元）', sales.visitPenalty],
        ['有效沟通最少时长（分钟）', payrollMinimumMinutes(sales.minimumSeconds)],
        ['打卡计数口径', payrollOptionLabel(sales.checkinCountMode, checkinCountOptions)],
        ['打卡拜访保护期（自然日）', sales.processProtectionDays],
        ['首月免考核', sales.firstMonthExempt],
        ['回款考核最高倍数', sales.resultCap],
      ]
    : []
})
const gradeColumns = [
  { key: 'lower', label: '回款下界（元）' },
  { key: 'lowerInclusive', label: '包含下界' },
  { key: 'upper', label: '回款上界（元）' },
  { key: 'upperInclusive', label: '包含上界' },
]
const stepColumns = [
  { key: 'lower', label: '完成率下界（%）' },
  { key: 'lowerInclusive', label: '包含下界' },
  { key: 'upper', label: '完成率上界（%）' },
  { key: 'upperInclusive', label: '包含上界' },
  { key: 'mode', label: '区间内计分方式' },
  { key: 'coefficient', label: '倍数 / 固定系数' },
]
const stepRows = (steps: PayrollMetricStep[]) =>
  steps.map((step) => ({
    ...step,
    lower: payrollRatePercent(step.lower),
    upper: payrollRatePercent(step.upper),
    mode: payrollOptionLabel(step.mode, coefficientModeOptions),
  }))
const categoryName = (id: number) =>
  props.categories.find((item) => item.id === id)?.name || `历史分类暂不可用（${id}）`
let request = 0
async function loadCommissionProducts() {
  const current = ++request
  products.value = []
  const ids = [
    ...new Set((commission.value?.rules ?? []).flatMap((rule) => rule.variantIds).map(String)),
  ]
  loadingProducts.value = ids.length > 0
  const results = await Promise.allSettled(ids.map((id) => getPayrollProducts('', null, id)))
  if (current !== request) return
  products.value = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  loadingProducts.value = false
}
const unavailableProducts = computed(() => {
  const requested = new Set(
    (commission.value?.rules ?? []).flatMap((rule) => rule.variantIds).map(String),
  )
  products.value.forEach((product) => requested.delete(String(product.productVariantId)))
  return requested.size
})
watch(() => commission.value?.rules, loadCommissionProducts, { immediate: true })
</script>

<template>
  <div class="rule-parameters">
    <template v-if="salary">
      <dl class="parameter-fields">
        <div>
          <dt>薪资标准方式</dt>
          <dd>
            {{
              salary.baseSalary.mode === 'TIERS'
                ? '按金银铜牌档位'
                : salary.baseSalary.mode === 'FIXED'
                  ? '固定底薪'
                  : '-'
            }}
          </dd>
        </div>
        <div v-if="salary.baseSalary.mode === 'FIXED'">
          <dt>底薪（元 / 月）</dt>
          <dd>{{ displayAmount(salary.baseSalary.fixedAmount) }}</dd>
        </div>
        <div v-if="salary.baseSalary.mode === 'FIXED'">
          <dt>绩效基数（元 / 月）</dt>
          <dd>{{ displayAmount(salary.performanceBase) }}</dd>
        </div>
        <div v-if="salary.baseSalary.mode === 'TIERS'">
          <dt>入职首个自然月薪资档位</dt>
          <dd>
            {{ firstSalaryTier }}
          </dd>
        </div>
        <div>
          <dt>底薪折算</dt>
          <dd>{{ prorationName(salary.proration.base) }}</dd>
        </div>
        <div>
          <dt>绩效折算</dt>
          <dd>{{ prorationName(salary.proration.performance) }}</dd>
        </div>
      </dl>
      <el-table v-if="salary.baseSalary.mode === 'TIERS'" :data="salary.baseSalary.tiers">
        <el-table-column prop="name" label="薪资档位" min-width="140" :formatter="displayCell" />
        <el-table-column label="底薪（元 / 月）" min-width="170" align="right"
          ><template #default="{ row }">{{ displayAmount(row.amount) }}</template></el-table-column
        >
        <el-table-column label="绩效基数（元 / 月）" min-width="190" align="right"
          ><template #default="{ row }">{{
            displayAmount(row.performanceBase)
          }}</template></el-table-column
        >
      </el-table>
      <template v-if="salary.personalPolicy">
        <h4>个人薪资与考核安排</h4>
        <dl class="parameter-fields">
          <div>
            <dt>试用期底薪发放比例</dt>
            <dd>{{ percent(salary.personalPolicy.probationBasePercent) }}</dd>
          </div>
          <div>
            <dt>试用期结束后底薪发放比例</dt>
            <dd>{{ percent(salary.personalPolicy.postProbationBasePercent) }}</dd>
          </div>
          <div>
            <dt>试用期结束后首日</dt>
            <dd>{{ salary.personalPolicy.probationUntil || '-' }}</dd>
          </div>
          <div>
            <dt>个人保护期结束后首日</dt>
            <dd>{{ salary.personalPolicy.protectionUntil || '-' }}</dd>
          </div>
          <div>
            <dt>调整生效日期</dt>
            <dd>{{ salary.personalPolicy.salaryChangeDate || '-' }}</dd>
          </div>
          <div>
            <dt>调整后底薪（元 / 月）</dt>
            <dd>{{ displayAmount(salary.personalPolicy.baseAfterChange) }}</dd>
          </div>
          <div>
            <dt>调整后绩效基数（元 / 月）</dt>
            <dd>{{ displayAmount(salary.personalPolicy.performanceAfterChange) }}</dd>
          </div>
          <div>
            <dt>关联补贴方案</dt>
            <dd>
              {{
                salary.personalPolicy.allowanceVersionId
                  ? allowanceLoading
                    ? '加载中'
                    : allowancePlan?.definition.name || '已关联历史补贴规则，资料暂不可用'
                  : '沿用适用的部门补贴规则'
              }}
            </dd>
          </div>
          <div v-if="allowancePlan">
            <dt>关联补贴生效日期</dt>
            <dd>{{ allowancePlan.definition.effectiveFrom }}</dd>
          </div>
          <div>
            <dt>个人免考核日期</dt>
            <dd>
              {{
                salary.personalPolicy.exemptDays.length
                  ? salary.personalPolicy.exemptDays.join('、')
                  : '-'
              }}
            </dd>
          </div>
        </dl>
      </template>
    </template>
    <template v-if="performance">
      <dl class="parameter-fields">
        <div>
          <dt>绩效计算方式</dt>
          <dd>
            {{
              payrollOptionLabel(
                performance.mode,
                performanceModeOptions(
                  definition.role,
                  performance.manager?.calculationMode !== 'ACTUAL_COMPLETION',
                ),
              )
            }}
          </dd>
        </div>
      </dl>
      <section
        v-if="performance.mode === 'FIXED' && definition.role === 'HEADQUARTERS'"
        class="parameter-note"
        aria-label="总部人员绩效计算说明"
      >
        <h4>总部人员 · 个人月度绩效</h4>
        <p>个人绩效基数 × 本人当月绩效完成率</p>
        <dl class="parameter-fields">
          <div>
            <dt>个人绩效基数</dt>
            <dd>在员工档案的薪资标准中维护，可因人而异。</dd>
          </div>
          <div>
            <dt>本月绩效完成率</dt>
            <dd>由 HR 在月度薪酬核定中逐人、逐月填写。</dd>
          </div>
        </dl>
        <p class="parameter-hint">
          适用部门仅限定规则范围，同部门员工不共用完成率。未填写时待核定，不默认按100%发放；计算后执行个人薪资标准中的绩效折算规则。
        </p>
      </section>
      <template v-if="performance.mode === 'SALES'">
        <dl class="parameter-fields">
          <div v-for="[name, content] in salesFields" :key="String(name)">
            <dt>{{ name }}</dt>
            <dd>{{ value(content) }}</dd>
          </div>
        </dl>
        <h4>阶段回款目标</h4>
        <el-table :data="performance.sales.targets" empty-text="未设置阶段目标">
          <el-table-column
            prop="fromMonth"
            label="起始自然月序号"
            min-width="140"
            :formatter="displayCell"
          />
          <el-table-column label="结束自然月序号" min-width="140"
            ><template #default="{ row }">{{ row.toMonth ?? '长期' }}</template></el-table-column
          >
          <el-table-column label="月回款目标（元）" min-width="160" align="right"
            ><template #default="{ row }">{{ value(row.target) }}</template></el-table-column
          >
        </el-table>
        <h4>绩效档位区间</h4>
        <el-table :data="performance.grades" empty-text="未设置绩效档位">
          <el-table-column prop="name" label="档位" min-width="130" :formatter="displayCell" />
          <el-table-column
            v-for="field in gradeColumns"
            :key="field.key"
            :label="field.label"
            min-width="120"
            ><template #default="{ row }">{{
              field.key === 'upper' && row[field.key] == null ? '无上限' : value(row[field.key])
            }}</template></el-table-column
          >
        </el-table>
      </template>
      <template v-if="performance.mode === 'MANAGER'">
        <p class="parameter-hint">
          {{
            performance.manager.calculationMode === 'ACTUAL_COMPLETION'
              ? '目标读取所辖城市同月指标，按任期和保护期归集；实际值按该规则所选来源计算。各指标计分后乘以各自权重，不自动归一。'
              : '历史规则：目标和实际值按该规则保存的配置核算，来源以本行选项为准；不自动改用城市月度指标或全部有效到账。'
          }}
        </p>
        <dl class="parameter-fields">
          <div>
            <dt>指标汇总方式</dt>
            <dd>
              {{
                performance.manager.calculationMode === 'ACTUAL_COMPLETION'
                  ? '单项指标计分后加权汇总'
                  : '历史综合完成率匹配阶梯'
              }}
            </dd>
          </div>
          <div>
            <dt>保护期长度</dt>
            <dd>{{ performance.manager.protection.count }}</dd>
          </div>
          <div>
            <dt>保护期单位</dt>
            <dd>
              {{
                payrollOptionLabel(
                  performance.manager.protection.unit,
                  managerProtectionUnitOptions,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>仅考核非保护期</dt>
            <dd>{{ value(performance.manager.protection.assessUnprotectedOnly) }}</dd>
          </div>
          <div>
            <dt>历史最高倍数</dt>
            <dd>{{ value(performance.manager.cap) }}</dd>
          </div>
        </dl>
        <section
          v-for="metric in performance.manager.metrics"
          :key="metric.code"
          class="parameter-metric"
        >
          <h4>{{ metric.name }}</h4>
          <dl class="parameter-fields">
            <div>
              <dt>实际值来源</dt>
              <dd>{{ payrollOptionLabel(metric.source, managerSourceOptions) }}</dd>
            </div>
            <div>
              <dt>关联城市指标</dt>
              <dd>
                {{ targetMetrics.find((item) => item.code === metric.cityMetric)?.label || '-' }}
              </dd>
            </div>
            <div>
              <dt>目标值</dt>
              <dd>{{ value(metric.target) }}</dd>
            </div>
            <div>
              <dt>权重</dt>
              <dd>{{ percent(metric.weight) }}</dd>
            </div>
            <div>
              <dt>计分方式</dt>
              <dd>
                {{ payrollOptionLabel(metric.scoringMode, metricScoringOptions) }}
              </dd>
            </div>
            <div>
              <dt>最高倍数</dt>
              <dd>{{ value(metric.cap) }}</dd>
            </div>
          </dl>
          <el-table v-if="metric.steps.length" :data="stepRows(metric.steps)"
            ><el-table-column
              v-for="field in stepColumns"
              :key="field.key"
              :label="field.label"
              min-width="110"
              ><template #default="{ row }">{{ value(row[field.key]) }}</template></el-table-column
            ></el-table
          >
        </section>
        <template v-if="performance.manager.steps.length"
          ><h4>历史综合完成率阶梯</h4>
          <el-table :data="stepRows(performance.manager.steps)"
            ><el-table-column
              v-for="field in stepColumns"
              :key="field.key"
              :label="field.label"
              min-width="110"
              ><template #default="{ row }">{{ value(row[field.key]) }}</template></el-table-column
            ></el-table
          ></template
        >
      </template>
    </template>
    <template v-if="commission">
      <dl class="parameter-fields">
        <div>
          <dt>城市总归属时点</dt>
          <dd>
            {{ payrollOptionLabel(commission.managerAttribution, commissionDateOptions) }}
          </dd>
        </div>
        <div>
          <dt>提成标准取值时点</dt>
          <dd>
            {{ payrollOptionLabel(commission.standardDate, commissionDateOptions) }}
          </dd>
        </div>
      </dl>
      <el-alert
        v-if="!loadingProducts && unavailableProducts"
        type="warning"
        :closable="false"
        title="部分商品资料暂不可用，已保留原配置范围。"
      >
        <el-button link type="primary" @click="loadCommissionProducts">重试加载</el-button>
      </el-alert>
      <el-table
        class="commission-detail-table"
        :data="commissionDetailRows"
        max-height="520"
        :span-method="commissionSpan"
        :row-class-name="commissionRowClass"
        @expand-change="commissionExpanded"
        empty-text="全部商品不计提"
        v-loading="loadingProducts"
      >
        <el-table-column type="expand" width="42"
          ><template #default="{ row }"
            ><div class="commission-product-detail">
              <dl class="parameter-fields" aria-label="当前商品信息">
                <div>
                  <dt>商品名称</dt>
                  <dd>{{ displayValue(row.product.productName) }}</dd>
                </div>
                <div>
                  <dt>规格</dt>
                  <dd>{{ displayValue(row.product.specification) }}</dd>
                </div>
                <div>
                  <dt>商品分类</dt>
                  <dd>
                    {{
                      displayValue(
                        (!row.product.variantId
                          ? row.categoryIds.map(categoryName).join('、')
                          : row.product.categoryName) ||
                          (row.product.categoryId == null
                            ? null
                            : categoryName(row.product.categoryId)),
                      )
                    }}
                  </dd>
                </div>
              </dl>
            </div></template
          ></el-table-column
        >
        <el-table-column
          prop="product.productName"
          class-name="commission-product-name"
          label="商品名称"
          min-width="200"
          show-overflow-tooltip
          :formatter="displayCell"
        />
        <el-table-column
          prop="product.specification"
          class-name="commission-product-specification"
          label="规格"
          min-width="90"
          show-overflow-tooltip
          :formatter="displayCell"
        />
        <el-table-column label="适用方式" min-width="100">
          <template #default="{ row }">{{
            row.variantIds.length ? '指定商品' : '按商品分类'
          }}</template>
        </el-table-column>
        <el-table-column label="计提单位" class-name="commission-unit" min-width="85"
          ><template #default="{ row }">{{
            !row.excluded && row.method === 'QUANTITY' ? payrollUnitName(row.unitCode) : '-'
          }}</template></el-table-column
        >
        <el-table-column label="提成人员" class-name="commission-recipient" min-width="90"
          ><template #default="{ row }">{{
            payrollOptionLabel(row.recipientRole, [
              { value: 'SALES', label: '销售' },
              { value: 'CITY_MANAGER', label: '城市总' },
            ])
          }}</template></el-table-column
        >
        <el-table-column label="计提方式" min-width="110"
          ><template #default="{ row }">{{
            commissionMethodLabel(row as PayrollSchemeCommissionRule)
          }}</template></el-table-column
        >
        <el-table-column label="提成比例（%）" min-width="115" align="right"
          ><template #default="{ row }">{{
            !row.excluded && row.method === 'PERCENT' ? value(row.value) : '-'
          }}</template></el-table-column
        >
        <el-table-column
          label="单位提成（元）"
          class-name="commission-unit-amount"
          min-width="125"
          align="right"
          ><template #default="{ row }">{{
            !row.excluded && row.method === 'QUANTITY' ? value(row.value) : '-'
          }}</template></el-table-column
        >
      </el-table>
    </template>
  </div>
</template>

<style scoped>
.rule-parameters {
  display: grid;
  gap: 20px;
}
.parameter-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 28px;
  margin: 0;
}
.parameter-fields dt {
  margin-bottom: 7px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.parameter-fields dd {
  margin: 0;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.parameter-fields ul {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
}
.parameter-fields li + li {
  margin-top: 6px;
}
.parameter-metric {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 18px;
}
.parameter-metric .el-table {
  margin-top: 18px;
}
.commission-product-detail {
  display: grid;
  gap: 12px;
  padding: 16px 20px;
  background: var(--el-fill-color-lighter);
}
.commission-detail-table :deep(.commission-product-group-1 > td) {
  background: #f6f9ff;
}
.commission-detail-table :deep(.commission-product-group-start > td) {
  border-top: 2px solid var(--el-border-color-light);
}
.commission-detail-table :deep(.commission-product-name .cell),
.commission-detail-table :deep(.commission-product-specification .cell) {
  font-weight: 600;
}
.rule-parameters h4 {
  margin: 0;
  font-size: 14px;
}
.parameter-metric h4 {
  margin-bottom: 16px;
}
.parameter-hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
@media (max-width: 760px) {
  .parameter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .parameter-fields {
    grid-template-columns: 1fr;
  }
}
</style>
