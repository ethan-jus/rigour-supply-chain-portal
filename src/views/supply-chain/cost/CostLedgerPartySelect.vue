<template>
  <CostReferenceSelect
    v-model="code"
    :loader="load"
    :snapshot="resolvedName || name || undefined"
    :reset-key="`${kind}:${cityCode || ''}`"
    :disabled="disabled || (kind === 'CUSTOMER' && !cityCode)"
    :placeholder="placeholder || '搜索并选择档案'"
    @change="choose"
  />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import { getLedgerParties, type LedgerPartyReference } from '@/api/core/cost-ledger'
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
let serial = 0
watch(
  () => [code.value, props.kind, props.cityCode, props.name] as const,
  async ([value]) => {
    const current = ++serial
    resolvedName.value = props.name || ''
    if (!value || (props.kind === 'CUSTOMER' && !props.cityCode)) return
    try {
      const rows = await getLedgerParties(props.logistics, props.kind, {
        code: value,
        cityCode: props.cityCode,
      })
      if (current === serial)
        resolvedName.value = rows.find((r) => r.code === value)?.name || props.name || ''
    } catch {
      /* Preserve the selected code when a historical archive cannot be resolved. */
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
  }))
}
function choose(option: ReferenceOption | null) {
  emit('selected', (option?.reference as LedgerPartyReference | null) ?? null)
}
</script>
