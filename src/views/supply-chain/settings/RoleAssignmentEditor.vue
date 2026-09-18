<template>
  <el-select
    v-model="selectedIds"
    multiple
    filterable
    style="width: 100%"
    placeholder="选择角色"
    :disabled="disabled"
    ><el-option
      v-for="role in roles"
      :key="role.id"
      :label="role.name"
      :value="role.id"
      :disabled="role.status !== 'ACTIVE'"
  /></el-select>
  <div v-if="!removeOnly" class="assignments">
    <section v-for="assignment in assignments" :key="assignment.roleId">
      <h4>{{ roles.find((r) => r.id === assignment.roleId)?.name }}</h4>
      <template v-for="rule in rulesFor(assignment.roleId)" :key="rule.id!">
        <div v-for="dimension in requiredDimensions(rule)" :key="dimension" class="scope-row">
          <label>{{ actionLabel(rule) }} · {{ labels[dimension] }}</label
          ><ScopeReferencePicker
            :model-value="assignment.parameters[rule.id!]?.[dimension] || []"
            :dimension="dimension"
            :disabled="disabled"
            @update:model-value="setScope(assignment, rule.id!, dimension, $event)"
          />
        </div>
      </template>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type {
  RoleAssignment,
  SupplyRole,
  ScopeRule,
  ScopeDimension,
} from '@/api/core/supply-settings'
import ScopeReferencePicker from './ScopeReferencePicker.vue'
const props = defineProps<{ roles: SupplyRole[]; disabled?: boolean; removeOnly?: boolean }>()
const assignments = defineModel<RoleAssignment[]>({ default: () => [] })
const selectedIds = computed({
  get: () => assignments.value.map((a) => a.roleId),
  set: (ids) => {
    assignments.value = ids.map(
      (id) => assignments.value.find((a) => a.roleId === id) ?? { roleId: id, parameters: {} },
    )
  },
})
const labels = { DEPARTMENT: '管理部门', REGION: '客户归属地区', WAREHOUSE: '授权仓库' }
function rulesFor(id: string) {
  return props.roles.find((r) => r.id === id)?.rules ?? []
}
function requiredDimensions(r: ScopeRule): ScopeDimension[] {
  return (['DEPARTMENT', 'REGION', 'WAREHOUSE'] as const).filter((d) =>
    ['MANAGED', 'MEMBER'].includes(
      d === 'DEPARTMENT' ? r.departmentMode : d === 'REGION' ? r.regionMode : r.warehouseMode,
    ),
  )
}
function setScope(a: RoleAssignment, id: string, d: ScopeDimension, refs: string[]) {
  a.parameters[id] ??= {}
  a.parameters[id][d] = refs
}
function actionLabel(r: ScopeRule) {
  const objects: Record<string, string> = {
    CUSTOMER: '客户',
    ORDER: '订单',
    EMPLOYEE: '员工',
    INVENTORY: '库存',
    FULFILLMENT: '履约',
    ANALYTICS: '统计',
  }
  return (objects[r.objectType] ?? r.objectType) + ' / ' + r.actionCode
}
</script>
<style scoped>
.assignments section {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
}
.scope-row {
  margin: 12px 0;
}
.scope-row label {
  display: block;
  margin-bottom: 8px;
  color: #475569;
}
</style>
