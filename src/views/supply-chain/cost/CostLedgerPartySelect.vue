<template>
  <div class="ledger-party-select">
    <CostReferenceSelect
      v-model="code"
      :loader="load"
      :snapshot="resolvedName || name || undefined"
      :reset-key="`${kind}:${cityCode || ''}`"
      :disabled="disabled || (kind === 'CUSTOMER' && !cityCode)"
      :placeholder="placeholder || '搜索并选择档案'"
      @change="choose"
    />
    <p v-if="selectedIssue" role="alert" class="warehouse-issue">{{ selectedIssue }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import { getLedgerParties, type LedgerPartyReference } from '@/api/core/cost-ledger'
import { errorMessage } from '@/api/core/error'
const props = defineProps<{
  logistics: boolean
  kind: string
  cityCode?: string
  name?: string | null
  disabled?: boolean
  placeholder?: string
}>()
const code = defineModel<string | null>({ default: null })
const resolvedName = ref('')
const selectedIssue = ref('')
let serial = 0
watch(
  () => [code.value, props.kind, props.cityCode, props.name] as const,
  async ([value]) => {
    const current = ++serial
    resolvedName.value = props.name || ''
    selectedIssue.value = ''
    if (!value || (props.kind === 'CUSTOMER' && !props.cityCode)) return
    try {
      const rows = await getLedgerParties(props.logistics, props.kind, {
        code: value,
        cityCode: props.cityCode,
      })
      if (current === serial) {
        const row = rows.find((r) => r.code === value)
        resolvedName.value = row?.name || props.name || ''
        selectedIssue.value =
          row?.referenceIssue ||
          (props.kind === 'WAREHOUSE' && !row
            ? `当前账号的可用仓库目录中没有仓库（${value}），请重新选择目录中的有效仓库`
            : '')
      }
    } catch (e) {
      // 保留历史选择和已填内容，明确提示核验失败，不能当作配置正常。
      if (current === serial && props.kind === 'WAREHOUSE')
        selectedIssue.value = `仓库（${value}）资料核验失败：${errorMessage(e, '仓库资料核验服务暂不可用，请稍后重试')}`
    }
  },
  { immediate: true },
)
const emit = defineEmits<{ selected: [row: LedgerPartyReference | null] }>()
async function load(keyword: string, begin: number): Promise<ReferenceOption[]> {
  if (props.kind === 'CUSTOMER' && !props.cityCode) return []
  const rows = await getLedgerParties(props.logistics, props.kind, {
    keyword,
    begin,
    cityCode: props.cityCode,
  })
  return rows.map((row) => ({
    ...row,
    id: row.code,
    label: `${row.name}（${row.code}）`,
    name: row.name,
    reference: row,
    description: row.referenceIssue || undefined,
  }))
}
function choose(option: ReferenceOption | null) {
  const row = (option?.reference as LedgerPartyReference | null) ?? null
  selectedIssue.value = row?.referenceIssue || ''
  emit('selected', row)
}
</script>
<style scoped>
.ledger-party-select {
  width: 100%;
}
.warehouse-issue {
  margin: 6px 0 0;
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
