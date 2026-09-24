<template>
  <el-drawer
    v-model="visible"
    :title="`分配用户 · ${role?.name || ''}`"
    size="min(900px,96vw)"
    :close-on-click-modal="false"
    :before-close="close"
  >
    <template v-if="role">
      <el-alert
        title="追加或移除当前角色，保留用户的其他角色。每批最多 100 人，全部成功或全部回滚。"
        type="info"
        :closable="false"
      />
      <el-radio-group v-model="mode" :disabled="saving" @change="clearSelection">
        <el-radio value="APPEND" :disabled="role.status !== 'ACTIVE'">追加此角色</el-radio>
        <el-radio value="REMOVE">移除此角色</el-radio>
      </el-radio-group>
      <el-form inline @submit.prevent="search">
        <el-form-item
          ><el-input
            v-model="keyword"
            placeholder="登录账号 / 员工编码"
            clearable
            :disabled="saving"
        /></el-form-item>
        <el-button native-type="submit" :disabled="saving">查询用户</el-button>
      </el-form>
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
      <el-table
        ref="table"
        v-loading="loading"
        :data="rows"
        row-key="id"
        @selection-change="selected = $event"
      >
        <el-table-column type="selection" :selectable="selectable" width="48" />
        <el-table-column prop="username" label="登录账号" />
        <el-table-column prop="name" label="员工姓名" />
        <el-table-column label="账号状态"
          ><template #default="{ row }">{{
            row.status === 'ACTIVE' ? '启用' : '禁用'
          }}</template></el-table-column
        >
        <!-- @vue-generic {SupplyMember} -->
        <el-table-column label="当前角色"
          ><template #default="{ row }">{{
            hasRole(row) ? '已关联' : '未关联'
          }}</template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total,sizes,prev,pager,next"
        :disabled="saving"
        @change="load"
      />
      <p>本页已选择 {{ selected.length }} 人；切换页码、查询或操作模式后需重新选择。</p>
    </template>
    <template #footer>
      <el-alert
        v-if="saveError"
        class="role-members-error"
        :title="saveError"
        type="error"
        :closable="false"
      />
      <el-button :disabled="saving" @click="visible = false">关闭</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="loading || !selected.length"
        @click="save"
        >预览并确认分配</el-button
      >
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  supplyAccessApi,
  type SupplyRole,
  type SupplyMember,
  type BatchRoleCommand,
} from '@/api/core/supply-settings'
import { errorMessage } from '@/api/core/error'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
const emit = defineEmits<{ saved: [] }>()
const access = useSupplyAuthorizationStore()
const visible = ref(false),
  saving = ref(false),
  loading = ref(false)
const role = ref<SupplyRole>(),
  mode = ref<'APPEND' | 'REMOVE'>('APPEND')
const keyword = ref(''),
  page = ref(1),
  size = ref(20),
  total = ref(0)
const rows = ref<SupplyMember[]>([]),
  selected = ref<SupplyMember[]>([])
const loadError = ref(''),
  saveError = ref(''),
  table = ref<{ clearSelection: () => void }>()
let request = 0
watch(visible, (open) => {
  if (!open) request++
})
function hasRole(member: SupplyMember) {
  return member.roles.some((r) => r.roleId === role.value?.id)
}
function selectable(member: SupplyMember) {
  return (
    !saving.value &&
    member.kind !== 'PROTECTED' &&
    (mode.value === 'REMOVE' ? hasRole(member) : !hasRole(member))
  )
}
function clearSelection() {
  selected.value = []
  table.value?.clearSelection()
  saveError.value = ''
}
function close(done: () => void) {
  if (!saving.value) done()
}
async function open(value: SupplyRole) {
  if (
    !access.can('supply:user:read') ||
    !access.can('supply:user:assign-role') ||
    value.protectedRole
  )
    return
  role.value = value
  mode.value = value.status === 'ACTIVE' ? 'APPEND' : 'REMOVE'
  keyword.value = ''
  page.value = 1
  visible.value = true
  await load()
}
async function search() {
  page.value = 1
  await load()
}
async function load() {
  const current = ++request
  clearSelection()
  loadError.value = ''
  loading.value = true
  try {
    const data = await supplyAccessApi.members(keyword.value, page.value, size.value)
    if (current !== request) return
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    if (current === request) {
      rows.value = []
      total.value = 0
      loadError.value = errorMessage(error, '用户读取失败，请重试')
    }
  } finally {
    if (current === request) loading.value = false
  }
}
async function save() {
  if (saving.value || loading.value || !role.value || !selected.value.length) return
  saving.value = true
  saveError.value = ''
  try {
    const command: BatchRoleCommand = {
      mode: mode.value,
      members: selected.value.map((m) => ({ id: m.id, version: m.version })),
      roles: [{ roleId: role.value.id, parameters: {} }],
      applicationVersion: 0,
    }
    const preview = await supplyAccessApi.previewBatch(command)
    await ElMessageBox.confirm(
      `确认向 ${preview.members.length} 名用户${mode.value === 'APPEND' ? '追加' : '移除'}“${role.value.name}”？`,
      '角色用户分配',
      { type: 'warning' },
    )
    await supplyAccessApi.assignBatch({
      ...command,
      applicationVersion: preview.applicationVersion,
    })
    await load()
    await access.refresh()
    emit('saved')
    ElMessage.success('角色用户分配已完成')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      saveError.value = errorMessage(error, '角色用户分配失败，请重试')
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>
<style scoped>
.el-radio-group,
.el-form,
.el-pagination {
  margin-top: 16px;
}
.role-members-error {
  margin-bottom: 12px;
  text-align: left;
}
</style>
