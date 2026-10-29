<template>
  <section v-if="snapshot">
    <div class="result-header">
      <strong>{{ performanceTitle }}</strong>
      <el-button
        v-if="editable && can('hr:payroll:calculate')"
        type="primary"
        @click="emit('determine')"
        >核定薪酬</el-button
      >
    </div>
    <el-table :data="basisRows" border>
      <el-table-column prop="name" label="计算项目" width="190" :formatter="displayCell" />
      <el-table-column
        prop="value"
        label="本月数值"
        width="170"
        align="right"
        :formatter="displayCell"
      />
      <el-table-column prop="basis" label="计算说明" min-width="320" :formatter="displayCell" />
    </el-table>
    <p v-if="!isManager && !isHeadquarters" class="field-hint">
      每日打卡与拜访独立考核，不能跨日抵扣。缺卡、缺拜访和回款未达标扣减已包含在绩效内，不再重复扣工资。
    </p>
    <p v-if="row.calculation.performanceDetail?.assessmentOverride" class="field-hint">
      人工核定：缺卡
      {{
        row.calculation.performanceDetail.assessmentOverride.missingCheckins ?? '沿用系统统计'
      }}；缺拜访
      {{ row.calculation.performanceDetail.assessmentOverride.missingVisits ?? '沿用系统统计' }}。
      核定说明：{{
        row.calculation.performanceDetail.assessmentOverride.reason
      }}。下方逐日数据保留原始统计。
    </p>
    <el-table v-if="taskRows.length" :data="taskRows" border>
      <el-table-column prop="name" label="每日任务" :formatter="displayCell" />
      <el-table-column prop="dailyTarget" label="每日目标" :formatter="displayCell" />
      <el-table-column prop="actual" label="本月有效合计" :formatter="displayCell" />
      <el-table-column prop="missing" label="核算缺失次数" :formatter="displayCell" />
      <el-table-column label="每次扣减（元）" align="right"
        ><template #default="{ row }">{{ payrollMoney(row.penalty) }}</template></el-table-column
      >
      <el-table-column label="按次数扣减（元）" align="right"
        ><template #default="{ row }">{{ payrollMoney(row.deduction) }}</template></el-table-column
      >
    </el-table>
    <p v-if="taskRows.length" class="field-hint">
      按次数扣减合计可能超过绩效额度，实扣以过程绩效额度封顶；人工核定优先，未核定项沿用逐日统计。
    </p>
    <el-table v-if="snapshot.metrics.length" :data="snapshot.metrics" border
      ><el-table-column prop="name" label="指标" :formatter="displayCell" /><el-table-column
        label="实际"
        ><template #default="{ row: metric }">{{
          metric.actual ?? '待核定'
        }}</template></el-table-column
      ><el-table-column label="目标"
        ><template #default="{ row: metric }">{{
          metric.target ?? '待核定'
        }}</template></el-table-column
      ><el-table-column prop="weight" label="权重（%）" :formatter="displayCell" /><el-table-column
        label="完成率"
        ><template #default="{ row }">{{ percent(row.completion) }}</template></el-table-column
      ><el-table-column label="加权贡献"
        ><template #default="{ row }">{{ percent(row.contribution) }}</template></el-table-column
      ><el-table-column v-if="tieredMetrics" label="计分系数"
        ><template #default="{ row }">{{ row.coefficient ?? '-' }}</template></el-table-column
      ><el-table-column prop="evidence" label="核算依据" min-width="180" :formatter="displayCell"
    /></el-table>
    <p v-if="isManager" class="field-hint">
      {{
        actualCompletion
          ? '各指标按保存的计分规则换算系数并乘以权重，汇总后乘以绩效基数；保护期内按100%计发。'
          : '历史版本：综合完成率匹配阶梯系数，保护期内外分别计算后汇总。'
      }}
    </p>
    <!-- Monthly determination is hosted by the parent payroll panel. -->
  </section>
</template>
<script setup lang="ts">
import { displayCell, displayAmount as payrollMoney } from '@/utils/business-display'
import { computed } from 'vue'
import type { PayrollRecord } from '@/api/core/payroll'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

const props = defineProps<{ row: PayrollRecord; readonly?: boolean }>(),
  emit = defineEmits<{ determine: [] }>()
const { can } = useSupplyPermissions()
const snapshot = computed(() => props.row.calculation.scheme)
const performanceMode = computed(() => snapshot.value?.scheme.definition.performanceMode)
const isManager = computed(() => performanceMode.value === 'MANAGER')
const isHeadquarters = computed(
  () =>
    snapshot.value?.scheme.definition.role === 'HEADQUARTERS' && performanceMode.value === 'FIXED',
)
const performanceTitle = computed(() =>
  performanceMode.value === 'NONE'
    ? '不计绩效'
    : isManager.value
      ? '城市总绩效'
      : isHeadquarters.value
        ? '总部人员月度绩效'
        : performanceMode.value === 'FIXED'
          ? '固定绩效'
          : '销售绩效：打卡与有效拜访 + 回款达标',
)
const actualCompletion = computed(
  () => snapshot.value?.scheme.definition.manager?.calculationMode === 'ACTUAL_COMPLETION',
)
const tieredMetrics = computed(() =>
  snapshot.value?.scheme.definition.manager?.metrics.some((m) => m.scoringMode === 'TIERED'),
)
const percent = (v: number | null | undefined) =>
  v == null ? '-' : `${(Number(v) * 100).toFixed(2)}%`
const editable = computed(
  () => !props.readonly && !['CONFIRMED', 'PAID'].includes(props.row.statusCode),
)
const taskRows = computed(() => {
  const p = props.row.calculation.performanceDetail
  const policy = snapshot.value?.scheme.definition.sales
  if (!p || !policy || isManager.value || !p.days.length) return []
  const sum = (key: 'checkins' | 'effectiveVisits' | 'missingCheckins' | 'missingVisits') =>
    p.days.reduce((value, day) => value + day[key], 0)
  return [
    {
      name: '打卡',
      dailyTarget: policy.dailyCheckins,
      actual: sum('checkins'),
      missing: p.assessmentOverride?.missingCheckins ?? sum('missingCheckins'),
      penalty: policy.checkinPenalty,
      deduction:
        (p.assessmentOverride?.missingCheckins ?? sum('missingCheckins')) *
        (policy.checkinPenalty ?? 0),
    },
    {
      name: `有效拜访（≥${(policy.minimumSeconds ?? 0) / 60} 分钟）`,
      dailyTarget: policy.dailyVisits,
      actual: sum('effectiveVisits'),
      missing: p.assessmentOverride?.missingVisits ?? sum('missingVisits'),
      penalty: policy.visitPenalty,
      deduction:
        (p.assessmentOverride?.missingVisits ?? sum('missingVisits')) * (policy.visitPenalty ?? 0),
    },
  ]
})
const basisRows = computed(() => {
  const s = snapshot.value,
    c = props.row.calculation,
    p = c.performanceDetail
  if (!s) return []
  const rows = [
    {
      name: '当月绩效基数',
      value: payrollMoney(s.performanceBase),
      basis: s.scheme.definition.personalPolicy?.salaryChangeDate
        ? '按个人调整日期及折算口径加权后的基数；绩效与保护期叠加时逐日分别计算后合计'
        : isHeadquarters.value || isManager.value
          ? '取本人的员工薪资标准中的绩效基数'
          : '取本人的员工薪资标准；销售按当月薪资档位取绩效基数',
    },
  ]
  const personal = s.scheme.definition.personalPolicy
  if (personal?.salaryChangeDate)
    rows.push({
      name: '个人薪资调整',
      value: `${personal.salaryChangeDate} 起`,
      basis: `底薪调整为 ${payrollMoney(personal.baseAfterChange)} 元/月，绩效基数调整为 ${payrollMoney(personal.performanceAfterChange)} 元/月；此前按原薪资标准计发`,
    })
  if (personal?.probationUntil)
    rows.push({
      name: '试用期／结束后底薪比例',
      value: `${personal.probationBasePercent}% → ${personal.postProbationBasePercent ?? 100}%`,
      basis: `${personal.probationUntil} 之前使用试用期比例，当天起使用结束后比例；月内分别折算，绩效仍按绩效规则核算`,
    })
  if (isManager.value)
    rows.push(
      {
        name: '保护期 / 考核期天数',
        value: `${s.protectedDays} / ${s.assessedDays}`,
        basis: personal?.protectionUntil
          ? `个人保护期至 ${personal.protectionUntil} 前一天，当天起进入考核期`
          : '保护期按已配置新人规则计算',
      },
      {
        name: '实际绩效完成率',
        value: percent(s.managerCompletion),
        basis: '原始完成率 × 权重后相加；计分系数及发放比例单独展示',
      },
      {
        name: actualCompletion.value ? '计分后发放比例' : '历史绩效系数',
        value: actualCompletion.value
          ? percent(s.managerCoefficient)
          : s.managerCoefficient == null
            ? '待核定'
            : String(s.managerCoefficient),
        basis: actualCompletion.value
          ? '各指标计分系数 × 权重后相加；保护期内100%，保护期外按此比例计发'
          : '以综合完成率匹配历史规则中的系数区间',
      },
    )
  if (isHeadquarters.value)
    rows.push({
      name: '本月绩效完成率',
      value:
        s.performanceCompletionPercent == null ? '待核定' : `${s.performanceCompletionPercent}%`,
      basis: 'HR按员工、月份核定，按绩效基数 × 完成率计算后执行折算规则',
    })
  if (performanceMode.value === 'NONE')
    rows.push({
      name: '本月绩效规则',
      value: '不计绩效',
      basis: '本月规则绩效为0；如有人工核定，金额和原因在工资组成中单独展示',
    })
  if (p)
    rows.push(
      {
        name: '打卡与有效拜访绩效额度',
        value: payrollMoney(p.processBudget),
        basis: `绩效基数 × ${s.scheme.definition.sales.processPercent}%`,
      },
      {
        name: '打卡与有效拜访扣减',
        value: payrollMoney(p.processDeduction),
        basis: '逐日按缺少次数及规则单价扣减，以该项绩效额度为限',
      },
      {
        name: '打卡与有效拜访绩效',
        value: payrollMoney(p.processPay),
        basis: '该项绩效额度 − 扣减（折算前）',
      },
      {
        name: '回款达标绩效额度',
        value: payrollMoney(p.collectionBudget),
        basis: `绩效基数 × ${100 - (s.scheme.definition.sales.processPercent ?? 0)}%`,
      },
      {
        name: '当月回款目标',
        value: payrollMoney(p.collectionTarget),
        basis: '按入职自然月阶段匹配；首月回款免考核，新规则按在职自然日折算，手工目标不重复折算',
      },
      {
        name: '当月整单付清业绩',
        value: payrollMoney(p.collections),
        basis: '本月整单付清订单的回款基数，不含未付清订单',
      },
      {
        name: '回款达标绩效',
        value: payrollMoney(p.collectionPay),
        basis: '回款绩效额度 × min(实际业绩 / 目标, 1)；保护期按规则免考核（折算前）',
      },
    )
  if (s.commissionAdjustment != null)
    rows.push({
      name: '人工提成调整',
      value: payrollMoney(s.commissionAdjustment),
      basis: '月度核定补发或扣回，调整原因见工资操作记录；订单原计提结果保留',
    })
  rows.push({
    name: '本月绩效合计',
    value: payrollMoney(c.performance),
    basis:
      c.input.performanceOverride != null
        ? `HR 核定：${c.input.reason}`
        : isHeadquarters.value
          ? '本人的绩效基数 × 本月完成率，再按当月折算规则计发'
          : '保护期及考核期分别计算，执行当月折算规则后合计',
  })
  return rows
})
</script>
<style scoped>
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.el-card {
  margin: 16px 0;
}
.el-table {
  margin-top: 16px;
}
</style>
