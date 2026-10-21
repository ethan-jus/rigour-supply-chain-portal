<template>
  <section v-if="isCityManager" class="commission-summary" aria-label="城市总提成构成">
    <h3>城市总本期提成构成</h3>
    <div class="commission-summary__amounts">
      <div v-for="part in parts" :key="part.role" class="commission-summary__part">
        <span>{{ part.label }}</span>
        <strong>{{ costMoney(part.amount) }} <small>元</small></strong>
      </div>
      <div class="commission-summary__part commission-summary__total">
        <span>本期计入工资的提成</span>
        <strong>{{ costMoney(calculation.commission) }} <small>元</small></strong>
      </div>
    </div>
    <p v-if="calculation.scheme">
      城市总提成覆盖任期内所辖城市的适用订单，包含本人订单；本人销售提成按销售标准另计。
    </p>
    <p v-else>团队提成按所辖城市配置的比例计入；销售人员自身的提成照常发放。</p>
    <p class="commission-summary__hint">
      <template v-if="calculation.scheme">未整单付清的订单尚未计提。</template>
      <template v-else
        >待回款提成 {{ costMoney(calculation.heldCommission) }} 元，不计入本期。</template
      >
      此处为核算金额，实际付款以发放登记为准。
    </p>
    <p v-if="reviewHint && !calculation.scheme" class="commission-summary__hint">
      建议先完成所辖销售的薪酬确认，再重新核算并确认城市总薪酬。
    </p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollCalculation } from '@/api/core/payroll'
import { costMoney } from '../../cost/cost-dictionaries'
const props = defineProps<{ calculation: PayrollCalculation; reviewHint?: boolean }>()
const isCityManager = computed(
  () =>
    props.calculation.details.some((d) =>
      ['CITY_TEAM', 'CITY_MANAGER'].includes(d.recipientRoleCode),
    ) || props.calculation.rules.some((r) => r.data.kindCode === 'CITY_MANAGER'),
)
const parts = computed(() =>
  [
    { role: 'CITY_TEAM', label: '团队销售提成（不含本人）' },
    { role: 'CITY_MANAGER', label: '城市总独立提成' },
    { role: 'SALES', label: '本人销售提成' },
  ]
    .filter((part) => !props.calculation.scheme || part.role !== 'CITY_TEAM')
    .map((part) => ({
      ...part,
      amount:
        props.calculation.details
          .filter((d) => d.recipientRoleCode === part.role)
          .reduce((cents, d) => cents + Math.round(Number(d.released || 0) * 100), 0) / 100,
    })),
)
</script>
<style scoped>
.commission-summary {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
h3 {
  margin: 0 0 14px;
  font-size: 15px;
}
.commission-summary__amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.commission-summary__part {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.commission-summary__part span {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.commission-summary__part strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
small {
  font-size: 12px;
  font-weight: normal;
}
.commission-summary__total strong {
  color: var(--el-color-primary);
}
p {
  margin: 14px 0 0;
  line-height: 1.6;
  font-size: 13px;
}
.commission-summary__hint {
  margin-top: 6px;
  color: var(--el-text-color-regular);
}
@media (max-width: 420px) {
  .commission-summary__amounts {
    grid-template-columns: 1fr;
  }
}
</style>
