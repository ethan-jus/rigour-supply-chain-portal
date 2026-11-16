<template>
  <section class="transport-section platform-details" aria-label="货拉拉运输资料">
    <h3>货拉拉运输资料 <el-tag type="info" size="small">只读</el-tag></h3>
    <div class="details-grid">
      <Field label="平台订单状态" :value="order.status" />
      <Field label="用车时间" :value="platformDateTime(order.useTime)" />
      <Field label="完成时间" :value="platformDateTime(order.facts?.completeTime)" />
      <Field label="下单联系人" :value="raw['下单联系人']" />
      <Field label="下单联系电话" :value="raw['下单联系电话']" />
      <Field label="服务产品" :value="raw['服务产品']" />
      <Field label="用车原因" :value="raw['用车原由']" />
      <Field class="wide" label="平台订单备注" :value="raw['订单备注']" />
    </div>
    <h4>司机与车辆</h4>
    <div class="details-grid">
      <Field label="司机" :value="raw['司机']" /><Field
        label="司机联系电话"
        :value="raw['司机联系电话']"
      /><Field label="车牌号" :value="raw['车牌号']" />
      <Field label="车型" :value="raw['车型']" />
      <Field label="规划里程（公里）" :value="raw['规划里程（公里）']" />
      <Field label="实际行驶里程（公里）" :value="raw['实际行驶里程（公里）']" />
    </div>
    <div class="section-heading">
      <h4>下单员工关联</h4>
      <el-button
        v-if="can('integration:huolala:read')"
        link
        type="primary"
        @click="$emit('associate-employee')"
        >{{ order.facts?.mappedEmployeeCode ? '查看员工关联' : '关联员工' }}</el-button
      >
    </div>
    <div class="details-grid">
      <Field label="货拉拉下单员工" :value="order.facts?.sourceEmployeeName" />
      <Field label="下单员工手机号" :value="raw['下单员工手机号']" />
      <Field label="本系统关联员工" :value="employee?.employeeName" />
      <Field label="本系统所属部门" :value="employee?.departmentName" />
      <Field label="员工关联状态" :value="order.facts?.mappedEmployeeCode ? '已关联' : '未关联'" />
    </div>
    <h4>支付、开票与保价</h4>
    <div class="details-grid">
      <Field label="支付方式" :value="raw['支付方式']" />
      <Field label="发票状态" :value="raw['发票状态']" />
      <Field label="可开票金额（元）" :value="money(raw['可开票金额（元）'])" />
      <Field label="保价状态" :value="raw['保价状态']" />
    </div>
    <h4>运输进度</h4>
    <el-timeline v-if="progress.length">
      <el-timeline-item
        v-for="(step, index) in progress"
        :key="index"
        :timestamp="step.time || undefined"
      >
        {{ step.name }}
      </el-timeline-item>
    </el-timeline>
    <p v-else class="empty-text">暂无运输进度</p>
  </section>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, type PropType } from 'vue'
import type { PlatformTransport } from '@/api/core/transport-records'
import type { CostEmployee } from '@/api/core/cost'
import { currentSource } from './huolala-source'
import { money } from './transport-records'
import { platformDateTime, platformProgress } from './huolala-display'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const props = defineProps<{ platform: PlatformTransport; employees: CostEmployee[] }>()
defineEmits<{ 'associate-employee': [] }>()
const { can } = useSupplyPermissions()
const order = computed(() => currentSource(props.platform.source))
const raw = computed(() => order.value.raw)
const employee = computed(() =>
  props.employees.find((e) => e.employeeCode === order.value.facts?.mappedEmployeeCode),
)
const progress = computed(() => platformProgress(raw.value['运输进度']))
const Field = defineComponent({
  props: { label: String, value: { type: String as PropType<string | null>, default: null } },
  setup: (p) => () =>
    h('div', { class: 'detail-field' }, [h('span', p.label), h('div', p.value?.trim() || '-')]),
})
</script>
<style scoped>
.platform-details h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  margin: 0 0 22px;
}
.details-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px 24px;
}
.wide {
  grid-column: 1/-1;
}
.detail-field {
  min-width: 0;
}
.detail-field > span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
.detail-field > div {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.empty-text {
  color: var(--el-text-color-secondary);
}
h4 {
  margin: 24px 0 18px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
@media (max-width: 1000px) {
  .details-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
