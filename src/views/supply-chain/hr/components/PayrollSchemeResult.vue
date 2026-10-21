<template>
  <section v-if="snapshot">
    <div class="result-header">
      <strong>{{ isManager ? '城市总绩效' : '销售绩效：打卡与有效拜访 + 回款达标' }}</strong>
      <el-button
        v-if="editable && manualMetrics && can('hr:payroll:calculate')"
        type="primary"
        @click="open"
        >核定当月指标</el-button
      >
    </div>
    <el-table :data="basisRows" border>
      <el-table-column prop="name" label="计算项目" width="190" />
      <el-table-column prop="value" label="本月数值" width="170" align="right" />
      <el-table-column prop="basis" label="计算说明" min-width="320" />
    </el-table>
    <p v-if="!isManager" class="field-hint">
      每日打卡与拜访独立考核，不能跨日抵扣。缺卡、缺拜访和回款未达标扣减已包含在绩效内，不再重复扣工资。
    </p>
    <el-table v-if="taskRows.length" :data="taskRows" border>
      <el-table-column prop="name" label="每日任务" />
      <el-table-column prop="dailyTarget" label="每日目标" />
      <el-table-column prop="actual" label="本月有效合计" />
      <el-table-column prop="missing" label="逐日缺口合计" />
      <el-table-column label="每次扣减（元）" align="right"
        ><template #default="{ row }">{{ payrollMoney(row.penalty) }}</template></el-table-column
      >
      <el-table-column label="原始扣减（元）" align="right"
        ><template #default="{ row }">{{ payrollMoney(row.deduction) }}</template></el-table-column
      >
    </el-table>
    <p v-if="taskRows.length" class="field-hint">
      原始扣减合计可能超过绩效额度，实扣以打卡与有效拜访绩效额度封顶；逐日数据见下表。
    </p>
    <el-table v-if="snapshot.metrics.length" :data="snapshot.metrics" border
      ><el-table-column prop="name" label="指标" /><el-table-column label="实际"
        ><template #default="{ row: metric }">{{
          metric.actual ?? '待核定'
        }}</template></el-table-column
      ><el-table-column label="目标"
        ><template #default="{ row: metric }">{{
          metric.target ?? '待核定'
        }}</template></el-table-column
      ><el-table-column prop="weight" label="权重（%）" /><el-table-column label="完成率"
        ><template #default="{ row }">{{ percent(row.completion) }}</template></el-table-column
      ><el-table-column label="加权贡献"
        ><template #default="{ row }">{{ percent(row.contribution) }}</template></el-table-column
      ><el-table-column prop="evidence" label="核算依据" min-width="180"
    /></el-table>
    <p v-if="isManager" class="field-hint">
      先汇总各指标完成率 × 权重，再匹配综合绩效系数；保护期内外分别计算后汇总。
    </p>
    <el-dialog
      v-model="visible"
      title="当月绩效核定"
      width="800px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-position="top"
        ><template v-for="metric in facts.metrics" :key="metric.code"
          ><el-form-item :label="metricName(metric.code)"
            ><el-input-number v-model="metric.value" :min="0" :precision="4" /><el-input
              v-model="metric.evidence"
              placeholder="核定来源与说明"
              maxlength="500" /></el-form-item></template
        ><el-form-item label="核定原因"
          ><el-input v-model="facts.reason" type="textarea" maxlength="500" /></el-form-item
      ></el-form>
      <p class="field-hint">
        仅录入绩效规则中选择“人工核定”的指标，自动指标由订单来源计算。保护期外考核时，录入对应考核期间的实际值。保存后重新核算本月工资。
      </p>
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save">保存并重算</el-button></template
      >
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { type PayrollRecord, calculatePayroll } from '@/api/core/payroll'
import { getPayrollSchemeFacts, savePayrollSchemeFacts } from '@/api/core/payroll-scheme'
import type { PayrollSchemeFactsView } from '@/api/core/payroll-scheme/models/PayrollSchemeFactsView'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { payrollMoney } from '@/utils/payroll-workflow'
const props = defineProps<{ row: PayrollRecord }>(),
  emit = defineEmits<{ changed: [] }>()
const { can } = useSupplyPermissions()
const snapshot = computed(() => props.row.calculation.scheme)
const isManager = computed(() =>
  ['CITY_MANAGER', 'TRAINEE_MANAGER'].includes(snapshot.value?.scheme.definition.role || ''),
)
const percent = (v: number | null | undefined) =>
  v == null ? '—' : `${(Number(v) * 100).toFixed(2)}%`
const manualMetrics = computed(() =>
  snapshot.value?.scheme.definition.manager?.metrics?.some((m) => m.source === 'MANUAL_CONFIRMED'),
)
const editable = computed(() => !['CONFIRMED', 'PAID'].includes(props.row.statusCode))
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
      missing: sum('missingCheckins'),
      penalty: policy.checkinPenalty,
      deduction: sum('missingCheckins') * (policy.checkinPenalty ?? 0),
    },
    {
      name: `有效拜访（≥${(policy.minimumSeconds ?? 0) / 60} 分钟）`,
      dailyTarget: policy.dailyVisits,
      actual: sum('effectiveVisits'),
      missing: sum('missingVisits'),
      penalty: policy.visitPenalty,
      deduction: sum('missingVisits') * (policy.visitPenalty ?? 0),
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
      basis: '取本月薪资档位的绩效基数；城市总取固定绩效基数',
    },
  ]
  if (isManager.value)
    rows.push(
      {
        name: '保护期 / 考核期天数',
        value: `${s.protectedDays} / ${s.assessedDays}`,
        basis: '保护期按已配置新人规则计算',
      },
      {
        name: '加权完成率',
        value: percent(s.managerCompletion),
        basis: '各指标完成率 × 权重后相加；指标数据见下表',
      },
      {
        name: '综合绩效系数',
        value: s.managerCoefficient == null ? '待核定' : String(s.managerCoefficient),
        basis: '以加权完成率匹配当前绩效规则中的系数区间',
      },
    )
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
        basis: '按入职自然月阶段匹配目标；首月免考核',
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
  rows.push({
    name: '本月绩效合计',
    value: payrollMoney(c.performance),
    basis:
      c.input.performanceOverride != null
        ? `HR 核定：${c.input.reason}`
        : '保护期及考核期分别计算，执行当月折算规则后合计',
  })
  return rows
})
const visible = ref(false),
  saving = ref(false),
  error = ref('')
const facts = ref<PayrollSchemeFactsView>({
  revision: 0,
  performanceBase: null,
  metrics: [],
  reason: '',
})
const metricName = (code: string) =>
  snapshot.value?.scheme.definition.manager.metrics.find((m) => m.code === code)?.name || code
async function open() {
  error.value = ''
  visible.value = true
  saving.value = true
  try {
    const current = await getPayrollSchemeFacts(props.row.month, props.row.employeeCode)
    facts.value = {
      ...current,
      reason: '',
      metrics: (snapshot.value?.scheme.definition.manager.metrics || [])
        .filter((m) => m.source === 'MANUAL_CONFIRMED')
        .map(
          (m) =>
            current.metrics.find((v) => v.code === m.code) || {
              code: m.code,
              value: null,
              evidence: '',
            },
        ),
    }
  } catch (e) {
    error.value = errorMessage(e, '核定依据加载失败')
  } finally {
    saving.value = false
  }
}
async function save() {
  saving.value = true
  error.value = ''
  try {
    facts.value = await savePayrollSchemeFacts(props.row.month, props.row.employeeCode, facts.value)
    await calculatePayroll(props.row.month, [props.row.employeeCode])
    visible.value = false
    ElMessage.success('指标已保存并重新核算')
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '核定或重算失败，请核对后重试')
  } finally {
    saving.value = false
  }
}
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
