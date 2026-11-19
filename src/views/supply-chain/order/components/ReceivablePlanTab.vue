<template>
  <div class="terms" v-loading="busy">
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <header>
      <b>合同账期</b
      ><el-button
        v-if="write && !editing"
        :disabled="!plan || busy"
        link
        type="primary"
        @click="change"
        ><SupplyActionLabel code="order:receivable-plan:write" fallback="维护账期"
      /></el-button>
    </header>
    <template v-if="plan && !editing"
      ><el-empty v-if="!plan.version" description="暂无订单分期约定" />
      <template v-else
        ><p>版本 {{ plan.version }} · {{ plan.effectiveDate }} 生效 · {{ plan.evidence }}</p>
        <el-table :data="plan.lines"
          ><el-table-column type="index" label="期次" /><el-table-column
            prop="dueDate"
            label="到期日" /><el-table-column
            prop="amount"
            label="应收金额"
            align="right" /></el-table></template
    ></template>
    <el-form v-if="editing" label-position="top" @submit.prevent="save">
      <el-form-item label="约定生效日"
        ><el-date-picker
          v-model="effective"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
      /></el-form-item>
      <el-form-item label="合同或补充协议依据"
        ><el-input
          v-model="evidence"
          maxlength="500"
          placeholder="填写合同编号、条款或已签署的补充协议"
      /></el-form-item>
      <div v-for="(line, i) in lines" :key="i" class="term-row">
        <span>第 {{ i + 1 }} 期</span
        ><el-date-picker
          v-model="line.dueDate"
          type="date"
          value-format="YYYY-MM-DD"
          aria-label="到期日"
        /><el-input-number
          v-model="line.amount"
          :min="0"
          :precision="6"
          aria-label="应收金额"
        /><el-button v-if="lines.length > 1" link @click="lines.splice(i, 1)">移除</el-button>
      </div>
      <el-button @click="lines.push({ dueDate: '', amount: 0 })">添加分期</el-button
      ><el-button @click="editing = false">取消</el-button
      ><el-button type="primary" native-type="submit" :loading="busy">保存</el-button>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { apiClient } from '@/api/core/client'
import { useAuthStore } from '@/stores/auth'
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'
import { businessDate } from '@/utils/business-date'
interface Term {
  dueDate: string
  amount: number
}
interface Plan {
  version: number
  effectiveDate: string | null
  evidence: string | null
  lines: Term[]
}
const props = defineProps<{ id: string | number; amount: number }>()
const auth = useAuthStore(),
  write = computed(() => auth.hasPermission('order:receivable-plan:write'))
const plan = ref<Plan>(),
  lines = ref<Term[]>([]),
  effective = ref(''),
  evidence = ref(''),
  busy = ref(false),
  editing = ref(false),
  error = ref('')
let version = 0
const path = () => '/orders/sales/' + encodeURIComponent(String(props.id)) + '/receivable-plan'
async function load() {
  const token = ++version
  plan.value = undefined
  editing.value = false
  busy.value = true
  error.value = ''
  try {
    const r = await apiClient.get<Plan>(path(), { cacheBypass: true, errorFeedback: 'inline' })
    if (token === version) plan.value = r
  } catch (e) {
    if (token === version) error.value = e instanceof Error ? e.message : '账期读取失败'
  } finally {
    if (token === version) busy.value = false
  }
}
function change() {
  if (!plan.value) return
  effective.value = businessDate(new Date())
  evidence.value = plan.value.evidence || ''
  lines.value = plan.value.lines.length
    ? plan.value.lines.map((r) => ({ ...r }))
    : [{ dueDate: '', amount: props.amount }]
  editing.value = true
}
async function save() {
  if (!plan.value || busy.value) return
  const token = version
  busy.value = true
  error.value = ''
  try {
    const r = await apiClient.put<Plan>(
      path(),
      {
        version: plan.value.version,
        effectiveDate: effective.value,
        evidence: evidence.value,
        lines: lines.value,
      },
      { errorFeedback: 'inline' },
    )
    if (token === version) {
      plan.value = r
      editing.value = false
    }
  } catch (e) {
    if (token === version) error.value = e instanceof Error ? e.message : '账期保存失败'
  } finally {
    if (token === version) busy.value = false
  }
}
watch(() => props.id, load, { immediate: true })
onBeforeUnmount(() => version++)
</script>
<style scoped>
.terms {
  display: grid;
  gap: 12px;
}
.terms header,
.term-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.terms header {
  justify-content: space-between;
}
.term-row {
  margin-bottom: 12px;
}
</style>
