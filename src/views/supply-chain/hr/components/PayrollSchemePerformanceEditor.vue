<template>
  <el-form label-position="top" :disabled="disabled">
    <el-form-item label="绩效计算方式"
      ><el-select v-model="form.performanceMode" aria-label="绩效计算方式"
        ><el-option label="销售：打卡拜访与回款达标" value="SALES" /><el-option
          :label="legacyManager ? '城市总：历史综合完成率考核' : '城市总：单项指标计分后加权汇总'"
          value="MANAGER" /><el-option
          :label="form.role === 'HEADQUARTERS' ? '按个人月度完成率' : '固定绩效'"
          value="FIXED" /><el-option label="不计绩效" value="NONE" /></el-select
    ></el-form-item>
    <section
      v-if="form.role === 'HEADQUARTERS' && form.performanceMode === 'FIXED'"
      class="personal-performance"
      aria-label="总部人员绩效计算说明"
    >
      <div class="personal-performance-heading">
        <h4>总部人员 · 个人月度绩效</h4>
        <el-tag effect="plain">按人、按月核定</el-tag>
      </div>
      <p class="personal-performance-formula">个人绩效基数 × 本人当月绩效完成率</p>
      <p class="personal-performance-example">
        计算示例：绩效基数 2,000 元，完成率 80%，则折算前绩效为 1,600 元。
      </p>
      <dl class="personal-performance-details">
        <div>
          <dt>个人绩效基数</dt>
          <dd>在员工档案的薪资标准中维护，可因人而异。</dd>
        </div>
        <div>
          <dt>本月绩效完成率</dt>
          <dd>由HR在「月度薪酬 → 核定薪酬」中逐人填写，与工资金额调整集中处理。</dd>
        </div>
      </dl>
      <p class="personal-performance-note">
        适用部门仅限定规则范围，同部门员工不共用完成率。未填写时待核定，不默认按100%发放；计算后执行个人薪资标准中的绩效折算规则。
      </p>
    </section>
    <template v-if="form.performanceMode === 'SALES'">
      <div class="scheme-grid">
        <el-form-item label="打卡与有效拜访绩效占比（%）"
          ><el-input-number v-model="form.sales.processPercent" :min="0" :max="100"
        /></el-form-item>
        <el-form-item label="回款达标绩效占比（%）"
          ><el-input :model-value="100 - (form.sales.processPercent || 0)" readonly
        /></el-form-item>
        <el-form-item label="打卡计数口径"
          ><el-select v-model="form.sales.checkinCountMode"
            ><el-option value="UNIQUE_CUSTOMER" label="同一客户同日最多计1个" /><el-option
              value="RECORD"
              label="按审核通过的打卡记录计数" /></el-select
        ></el-form-item>
        <el-form-item label="每日打卡目标"
          ><el-input-number v-model="form.sales.dailyCheckins" :min="0"
        /></el-form-item>
        <el-form-item label="每少一次打卡扣减（元）"
          ><el-input-number v-model="form.sales.checkinPenalty" :min="0"
        /></el-form-item>
        <el-form-item label="每日有效拜访目标"
          ><el-input-number v-model="form.sales.dailyVisits" :min="0"
        /></el-form-item>
        <el-form-item label="每少一次有效拜访扣减（元）"
          ><el-input-number v-model="form.sales.visitPenalty" :min="0"
        /></el-form-item>
        <el-form-item label="有效沟通最少时长（分钟）"
          ><el-input-number v-model="minimumMinutes" :min="0" :max="1440" :precision="2"
        /></el-form-item>
      </div>
      <el-checkbox v-model="form.sales.firstMonthExempt"
        >入职首个自然月回款免考核，按首月档位核算绩效</el-checkbox
      >
      <el-form-item label="打卡拜访保护期（自入职日起，自然日）">
        <el-input-number
          v-model="form.sales.processProtectionDays"
          :min="0"
          :max="366"
          :precision="0"
        />
      </el-form-item>
      <el-alert
        v-if="disabled && form.sales.processProtectionDays == null"
        title="历史版本：首月免考核同时适用于打卡拜访和回款。"
        type="info"
        :closable="false"
      />
      <el-divider content-position="left">入职阶段回款目标</el-divider>
      <el-table :data="form.sales.targets" border>
        <el-table-column label="起始自然月序号"
          ><template #default="{ row }"
            ><el-input-number v-model="row.fromMonth" :min="1" /></template
        ></el-table-column>
        <el-table-column label="结束序号（空为长期）"
          ><template #default="{ row }"><el-input-number v-model="row.toMonth" :min="1" /></template
        ></el-table-column>
        <el-table-column label="月回款目标（元）"
          ><template #default="{ row }"><el-input-number v-model="row.target" :min="0" /></template
        ></el-table-column>
        <el-table-column width="75"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.sales.targets.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button @click="form.sales.targets.push({ fromMonth: 1, toMonth: null, target: null })"
        >增加阶段</el-button
      >
      <p class="field-hint">
        比例仅拆分当月档位的绩效基数。打卡与有效拜访按考核日分别扣减，最多扣完该项额度；有效拜访按同一客户同日去重，可包含在打卡目标中。阶段回款目标按当月在职自然日折算；已有人工核定目标按核定值采用。回款按当月整单付清订单基数统计，达标最高按100%发放；升档使用该档位的底薪与绩效基数。
      </p>
    </template>
    <template v-if="form.performanceMode === 'MANAGER'">
      <el-alert
        :title="
          legacyManager
            ? '历史版本按综合完成率匹配阶梯系数，原核算依据保留。'
            : '绩效工资＝绩效基数 × 各指标加权得分之和。每项指标可按实际完成率或HR配置的阶梯计分，再乘以权重。'
        "
        type="info"
        :closable="false"
      />
      <template v-if="legacyManager">
        <el-divider content-position="left">历史系数规则</el-divider>
        <PayrollCoefficientEditor v-model="form.manager.steps" />
      </template>
      <div class="scheme-grid">
        <el-form-item label="保护期长度"
          ><el-input-number v-model="form.manager.protection.count" :min="0"
        /></el-form-item>
        <el-form-item label="保护期单位"
          ><el-select v-model="form.manager.protection.unit"
            ><el-option label="从入职日起顺延日历月" value="MONTHS" /><el-option
              label="固定天数"
              value="DAYS" /></el-select
        ></el-form-item>
        <el-form-item v-if="legacyManager" label="历史最高倍数">
          <el-input-number v-model="form.manager.cap" :min="0" :precision="2"
        /></el-form-item>
      </div>
      <el-checkbox v-model="form.manager.protection.assessUnprotectedOnly"
        >仅考核保护期外业绩，目标同步按天折算</el-checkbox
      >
      <p class="field-hint">
        {{
          legacyManager
            ? '历史规则：保护期内按100%发放，保护期外按综合完成率匹配阶梯系数；多城汇总后只生成一份绩效。'
            : '保护期内按100%发放，保护期外按单项指标计分规则计算；多城汇总后只生成一份绩效。'
        }}
      </p>
      <el-card
        v-for="(metric, index) in form.manager.metrics"
        :key="metric.code"
        shadow="never"
        class="metric-card"
      >
        <template #header
          ><div class="metric-heading">
            <strong>指标 {{ index + 1 }}</strong
            ><el-button link type="danger" @click="form.manager.metrics.splice(index, 1)"
              >移除指标</el-button
            >
          </div></template
        >
        <div class="scheme-grid">
          <el-form-item v-if="!legacyManager" label="关联城市指标" required>
            <el-select
              :model-value="metric.cityMetric || inferredCityMetric(metric)"
              @update:model-value="metric.cityMetric = $event"
              placeholder="请选择城市指标"
              @change="(value: string) => linkCityMetric(metric, value)"
            >
              <el-option
                v-for="option in targetMetrics"
                :key="option.code"
                :value="option.code"
                :label="option.label"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="指标名称"
            ><el-input v-model="metric.name" placeholder="如建联门店数、有效门店数"
          /></el-form-item>
          <el-form-item label="实际值来源"
            ><el-select v-model="metric.source"
              ><el-option
                label="业务核定并填写依据"
                value="MANUAL_CONFIRMED"
                :disabled="!citySourceAllowed(metric, 'MANUAL_CONFIRMED')" /><el-option
                label="管辖城市全部有效回款（实际到账）"
                :disabled="!citySourceAllowed(metric, 'CITY_RECEIPTS')"
                value="CITY_RECEIPTS" /><el-option
                label="管辖城市整单付清业绩"
                :disabled="!citySourceAllowed(metric, 'FULLY_PAID_RECEIPTS')"
                value="FULLY_PAID_RECEIPTS" /><el-option
                label="管辖城市订单销售额"
                :disabled="!citySourceAllowed(metric, 'ORDER_SALES')"
                value="ORDER_SALES" /></el-select
          ></el-form-item>

          <p class="field-hint">
            {{
              legacyManager
                ? '历史规则：目标和实际值按本版本保存的配置核算，来源以本行选项为准；不自动改用城市月度指标或全部有效到账。'
                : '目标读取所辖城市同月指标，按任期和保护期归集；明细保留各城市目标与修订依据。实际值按所选来源计算，门店数及品牌销售额可由HR核定并填写依据；回款额使用实际到账口径。'
            }}
          </p>
          <el-form-item label="权重（%）"
            ><el-input-number v-model="metric.weight" :min="0" :max="100"
          /></el-form-item>
          <el-form-item v-if="!legacyManager" label="指标计分方式">
            <el-select
              :model-value="metric.scoringMode || 'ACTUAL'"
              @update:model-value="metric.scoringMode = $event"
              @change="scoringChanged(metric)"
            >
              <el-option label="按实际完成率" value="ACTUAL" />
              <el-option label="按阶梯计分" value="TIERED" />
            </el-select>
          </el-form-item>
        </div>
        <template v-if="!legacyManager && metric.scoringMode === 'TIERED'">
          <el-divider content-position="left">单项指标计分区间</el-divider>
          <PayrollCoefficientEditor v-model="metric.steps" />
          <p class="field-hint">
            由HR维护完成率区间、取值方式及系数；该指标加权贡献＝计分系数 ×
            权重。区间和系数随本次规则保存。
          </p>
        </template>
      </el-card>
      <el-button @click="form.manager.metrics.push(newPayrollMetric())">增加绩效指标</el-button>
    </template>
  </el-form>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import {
  newPayrollMetric,
  managerCompletionSteps,
  managerMetricScoringSteps,
} from '@/utils/payroll-scheme'
import type { PayrollMetricDefinition } from '@/api/core/payroll-scheme/models/PayrollMetricDefinition'
import { targetMetrics } from '../target-settings-model'
import PayrollCoefficientEditor from './PayrollCoefficientEditor.vue'
const props = defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
if (form.value.manager && !form.value.manager.steps)
  form.value.manager.steps = managerCompletionSteps()
if (form.value.sales && !form.value.sales.checkinCountMode)
  form.value.sales.checkinCountMode = 'UNIQUE_CUSTOMER'
const legacyManager = computed(
  () => props.disabled && form.value.manager.calculationMode !== 'ACTUAL_COMPLETION',
)
if (!props.disabled) {
  for (const metric of form.value.manager.metrics) {
    metric.cityMetric ??= inferredCityMetric(metric)
    if (metric.cityMetric === 'RECEIPT_AMOUNT') metric.source = 'CITY_RECEIPTS'
  }
}
function inferredCityMetric(metric: PayrollMetricDefinition) {
  return (
    targetMetrics.find((option) => option.code === metric.code || option.label === metric.name)
      ?.code ?? null
  )
}
function scoringChanged(metric: PayrollMetricDefinition) {
  if (metric.scoringMode === 'TIERED' && !metric.steps?.length)
    metric.steps = managerMetricScoringSteps()
}
function citySourceAllowed(metric: PayrollMetricDefinition, source: string) {
  if (legacyManager.value) return true
  const code = metric.cityMetric || inferredCityMetric(metric)
  if (!code) return true
  if (code === 'RECEIPT_AMOUNT') return source === 'CITY_RECEIPTS'
  if (code === 'SALES_AMOUNT') return source === 'MANUAL_CONFIRMED' || source === 'ORDER_SALES'
  return source === 'MANUAL_CONFIRMED'
}
function linkCityMetric(metric: PayrollMetricDefinition, code: string) {
  const option = targetMetrics.find((option) => option.code === code)
  if (!option) return
  metric.name = option.label
  metric.source =
    code === 'SALES_AMOUNT'
      ? 'ORDER_SALES'
      : code === 'RECEIPT_AMOUNT'
        ? 'CITY_RECEIPTS'
        : 'MANUAL_CONFIRMED'
}
const minimumMinutes = computed({
  get: () => form.value.sales.minimumSeconds / 60,
  set: (value) => {
    form.value.sales.minimumSeconds = Math.round((value || 0) * 60)
  },
})
</script>
<style scoped>
.personal-performance {
  margin-bottom: 24px;
  padding: 20px 24px;
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}
.personal-performance-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.personal-performance-heading h4 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}
.personal-performance-formula {
  margin: 18px 0 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-color-primary);
}
.personal-performance-example,
.personal-performance-details,
.personal-performance-note {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
.personal-performance-example {
  margin: 0;
}
.personal-performance-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
  margin: 20px 0 16px;
}
.personal-performance-details dt {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.personal-performance-details dd {
  margin: 4px 0 0;
}
.personal-performance-note {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-color-primary-light-8);
  color: var(--el-text-color-secondary);
}
@media (max-width: 640px) {
  .personal-performance {
    padding: 16px;
  }
  .personal-performance-details {
    grid-template-columns: 1fr;
  }
  .personal-performance-formula {
    font-size: 17px;
  }
}
</style>
