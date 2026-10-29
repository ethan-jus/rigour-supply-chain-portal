<script setup lang="ts">
import { displayCell } from '@/utils/business-display'
import { computed } from 'vue'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { payrollRoles, prorationOptions } from '@/utils/payroll-scheme'
import { displayRecordActor as auditActorLabel } from '@/utils/business-display'
import { displayRecordDateTime as displayDateTime } from '@/utils/business-display'
import type { PayrollDepartment } from '@/api/core/payroll'
import SupplyDepartmentTree from '@/components/supply/SupplyDepartmentTree.vue'

const props = defineProps<{
  row: PayrollComponentVersionView
  departments: PayrollDepartment[]
  state: string
  period: string
}>()
const definition = computed(() => props.row.definition)
const allowanceTotal = computed(() => {
  const items = definition.value.allowance?.items ?? []
  return items.some((item) => item.amount == null)
    ? null
    : items.reduce((sum, item) => sum + (item.amount ?? 0), 0)
})
const money = (value: number | null) =>
  value == null
    ? '-'
    : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <article class="record-detail" aria-label="规则详情">
    <header class="record-detail__hero">
      <div>
        <span class="record-detail__eyebrow">规则档案</span>
        <h2>{{ definition.name }}</h2>
      </div>
      <el-tag :type="state === '使用中' ? 'success' : state === '已停用' ? 'warning' : 'info'">{{
        state
      }}</el-tag>
    </header>
    <section class="record-detail__section">
      <h3>基本信息</h3>
      <dl class="record-detail__fields">
        <div>
          <dt>规则编码</dt>
          <dd>{{ row.ruleCode }}</dd>
        </div>
        <div>
          <dt>人员身份</dt>
          <dd>
            {{ payrollRoles.find((role) => role.value === definition.role)?.label || '全部身份' }}
          </dd>
        </div>
        <div>
          <dt>实际适用期间</dt>
          <dd>{{ period }}</dd>
        </div>
        <div>
          <dt>配置生效日期</dt>
          <dd>{{ definition.effectiveFrom }}</dd>
        </div>
        <div>
          <dt>配置截止日期</dt>
          <dd>
            {{
              definition.effectiveTo === '9999-12-31' ? '长期有效' : definition.effectiveTo || '-'
            }}
          </dd>
        </div>
      </dl>
    </section>
    <section v-if="definition.kind !== 'SALARY'" class="record-detail__section">
      <el-collapse
        ><el-collapse-item
          :title="`适用部门（共 ${definition.departmentIds.length} 个）`"
          name="departments"
        >
          <SupplyDepartmentTree
            :departments="departments"
            :selected-ids="definition.departmentIds"
          /> </el-collapse-item
      ></el-collapse>
    </section>
    <section class="record-detail__section">
      <h3>{{ definition.kind === 'ALLOWANCE' ? '补贴标准' : '计算规则与明细' }}</h3>
      <template v-if="definition.allowance">
        <dl class="record-detail__fields record-detail__fields--highlight">
          <div>
            <dt>每月补贴合计（元）</dt>
            <dd class="record-detail__amount">{{ money(allowanceTotal) }}</dd>
          </div>
          <div>
            <dt>折算方式</dt>
            <dd>
              {{
                prorationOptions.find((option) => option.value === definition.allowance?.proration)
                  ?.label || '-'
              }}
            </dd>
          </div>
        </dl>
        <el-table :data="definition.allowance.items" class="business-table" empty-text="不发放补贴">
          <el-table-column prop="name" label="补贴项目" min-width="200" :formatter="displayCell" />
          <el-table-column label="标准金额（元 / 月）" min-width="180" align="right"
            ><template #default="{ row: item }">{{ money(item.amount) }}</template></el-table-column
          >
        </el-table>
      </template>
      <div v-else class="record-detail__parameters"><slot /></div>
    </section>
    <section class="record-detail__section">
      <h3>变更记录</h3>
      <dl class="record-detail__fields">
        <div>
          <dt>创建人</dt>
          <dd>{{ row.createdByName || auditActorLabel(row.createdBy) }}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ displayDateTime(row.createdTime) }}</dd>
        </div>
        <div class="record-detail__wide">
          <dt>变更说明</dt>
          <dd>{{ row.reason || '-' }}</dd>
        </div>
      </dl>
    </section>
  </article>
</template>

<style scoped>
.record-detail {
  display: grid;
  gap: 18px;
  color: var(--el-text-color-primary);
}
.record-detail__hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 4px 0 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.record-detail__eyebrow {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.record-detail h2 {
  margin: 6px 0 0;
  font-size: 20px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.record-detail__section {
  padding: 18px 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: white;
}
.record-detail h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  margin: 0 0 16px;
}
.record-detail h3 span {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.record-detail__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 28px;
  margin: 0;
}
.record-detail__fields dt {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 7px;
}
.record-detail__fields dd {
  margin: 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.record-detail__wide {
  grid-column: 1 / -1;
}
.record-detail__section :deep(.el-collapse) {
  border: 0;
}
.record-detail__section :deep(.el-collapse-item__header) {
  height: 28px;
  line-height: 28px;
  border: 0;
  font-size: 15px;
  font-weight: 600;
}
.record-detail__section :deep(.el-collapse-item__wrap) {
  border: 0;
}
.record-detail__section :deep(.el-collapse-item__content) {
  padding: 16px 0 0;
}
.record-detail__fields--highlight {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: var(--el-fill-color-light);
  padding: 16px 18px;
  border-radius: 6px;
  margin-bottom: 16px;
}
.record-detail__amount {
  color: var(--el-color-primary);
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.record-detail__parameters :deep(.el-input.is-disabled .el-input__wrapper),
.record-detail__parameters :deep(.el-select__wrapper.is-disabled) {
  background: var(--el-fill-color-light);
  box-shadow: none;
}
.record-detail__parameters :deep(.el-input.is-disabled .el-input__inner) {
  -webkit-text-fill-color: var(--el-text-color-primary);
}
.record-detail__parameters :deep(.el-form-item__label) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
@media (max-width: 760px) {
  .record-detail__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .record-detail__section {
    padding: 16px;
  }
}
@media (max-width: 480px) {
  .record-detail__fields {
    grid-template-columns: 1fr;
  }
}
</style>
