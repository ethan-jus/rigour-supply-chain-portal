<template>
  <section class="cost-related-source" aria-label="关联原费用">
    <h3>关联原费用</h3>
    <p v-if="!allowed">当前账号无原费用查看权限，请联系该费用负责人核对。</p>
    <p v-else-if="loading" role="status">正在读取原费用…</p>
    <div v-else-if="failure" role="alert">
      {{ failure }} <el-button link type="primary" @click="load">重新加载</el-button>
    </div>
    <template v-else-if="original">
      <dl class="business-detail-fields">
        <div>
          <dt>费用单号</dt>
          <dd>{{ original.documentNo }}</dd>
        </div>
        <div>
          <dt>费用事项</dt>
          <dd>{{ original.data.title || '-' }}</dd>
        </div>
        <div>
          <dt>费用归属</dt>
          <dd>{{ original.data.cityName || '-' }}</dd>
        </div>
        <div>
          <dt>费用月份</dt>
          <dd>{{ original.data.costMonth || original.data.costDate.slice(0, 7) }}</dd>
        </div>
        <div>
          <dt>登记金额（元）</dt>
          <dd>{{ costMoney(original.data.amount) }}</dd>
        </div>
        <div>
          <dt>确认状态</dt>
          <dd>
            {{
              original.statusCode === 'CONFIRMED'
                ? '已确认'
                : original.statusCode === 'VOID'
                  ? '已作废'
                  : '待确认'
            }}
          </dd>
        </div>
      </dl>
      <p v-if="original.revision !== data.expense?.relatedCost?.revision" class="source-warning">
        原费用已变更，请重新核对关联信息。
      </p>
      <a :href="`#/supply-chain/cost/${category}?sourceId=${encodeURIComponent(original.id)}`"
        >查看原费用</a
      >
    </template>
  </section>
</template>
<script setup lang="ts">
import { displayAmount as costMoney } from '@/utils/business-display'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getCost, type CostCommand, type CostRecord } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

import { relatedCostCategory } from './cost-source'

const props = defineProps<{ data: CostCommand }>()
const { can } = useSupplyPermissions()
const category = computed(() => relatedCostCategory(props.data))
const allowed = computed(() => {
  const value = category.value
  if (!value) return false
  return can(
    value === 'logistics'
      ? 'order:logistics-cost:read'
      : `erp:cost:${value === 'purchases' ? 'purchase' : value.endsWith('rentals') ? 'rental' : 'marketing'}:read`,
  )
})
const original = ref<CostRecord | null>(null)
const loading = ref(false)
const failure = ref('')
let generation = 0
async function load() {
  const version = ++generation
  original.value = null
  failure.value = ''
  loading.value = false
  const link = props.data.expense?.relatedCost
  if (!allowed.value || !category.value || !link) return
  loading.value = true
  try {
    const row = await getCost(category.value, link.id)
    if (version === generation) original.value = row
  } catch (e) {
    if (version === generation) failure.value = errorMessage(e, '原费用读取失败，请重试')
  } finally {
    if (version === generation) loading.value = false
  }
}
watch(() => [category.value, props.data.expense?.relatedCost?.id, allowed.value], load, {
  immediate: true,
})
onBeforeUnmount(() => {
  generation++
})
</script>
<style scoped>
.cost-related-source {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
h3 {
  margin: 0 0 12px;
}
p {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
a {
  color: var(--el-color-primary);
}
.source-warning {
  color: var(--el-color-warning-dark-2);
}
</style>
