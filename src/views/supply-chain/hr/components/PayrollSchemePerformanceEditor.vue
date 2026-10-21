<template>
  <el-form label-position="top" :disabled="disabled">
    <el-form-item label="绩效模板"
      ><el-select v-model="form.performanceMode"
        ><el-option label="销售：打卡拜访与回款达标" value="SALES" /><el-option
          label="城市总：综合完成率考核"
          value="MANAGER" /><el-option label="固定绩效" value="FIXED" /><el-option
          label="不计绩效"
          value="NONE" /></el-select
    ></el-form-item>
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
        >入职首个自然月打卡拜访、回款均免考核，按首月档位发放绩效</el-checkbox
      >
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
        比例仅拆分当月档位的绩效基数。打卡与有效拜访按考核日分别扣减，最多扣完该项额度；有效拜访按同一客户同日去重，可包含在打卡目标中。回款按当月整单付清订单基数统计，达标最高按100%发放；升档使用该档位的底薪与绩效基数。
      </p>
    </template>
    <template v-if="form.performanceMode === 'MANAGER'">
      <el-alert
        title="先汇总各指标完成率×权重，再统一匹配以下绩效系数；提成另外计算。"
        type="info"
        :closable="false"
      />
      <el-divider content-position="left">综合完成率与绩效系数</el-divider>
      <PayrollCoefficientEditor v-model="form.manager.steps" />
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
        <el-form-item label="综合绩效最高倍数"
          ><el-input-number v-model="form.manager.cap" :min="0" :precision="2"
        /></el-form-item>
      </div>
      <el-checkbox v-model="form.manager.protection.assessUnprotectedOnly"
        >仅考核保护期外业绩，目标同步按天折算</el-checkbox
      >
      <p class="field-hint">
        保护期内按满额系数计算，保护期外按指标结果计算；多城汇总后只生成一份绩效。
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
          <el-form-item label="指标名称"
            ><el-input v-model="metric.name" placeholder="如建联门店数、有效门店数"
          /></el-form-item>
          <el-form-item label="实际值来源"
            ><el-select v-model="metric.source"
              ><el-option label="业务核定并填写依据" value="MANUAL_CONFIRMED" /><el-option
                label="管辖城市整单付清业绩"
                value="FULLY_PAID_RECEIPTS" /><el-option
                label="管辖城市订单销售额"
                value="ORDER_SALES" /></el-select
          ></el-form-item>

          <p class="field-hint">
            月度目标在“指标设置 → 薪酬绩效目标”按人员维护，城市总填写管辖范围的合计目标。
          </p>
          <el-form-item label="权重（%）"
            ><el-input-number v-model="metric.weight" :min="0" :max="100"
          /></el-form-item>
        </div>
      </el-card>
      <el-button @click="form.manager.metrics.push(newPayrollMetric())">增加绩效指标</el-button>
    </template>
  </el-form>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import { newPayrollMetric, managerCompletionSteps } from '@/utils/payroll-scheme'
import PayrollCoefficientEditor from './PayrollCoefficientEditor.vue'
defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
if (form.value.manager && !form.value.manager.steps)
  form.value.manager.steps = managerCompletionSteps()
if (form.value.sales && !form.value.sales.checkinCountMode)
  form.value.sales.checkinCountMode = 'UNIQUE_CUSTOMER'
const minimumMinutes = computed({
  get: () => form.value.sales.minimumSeconds / 60,
  set: (value) => {
    form.value.sales.minimumSeconds = Math.round((value || 0) * 60)
  },
})
</script>
