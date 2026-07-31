<template>
  <el-card>
    <template #header><div class="header"><div><strong>用户管理</strong><small>用户数受当前租户套餐上限约束</small></div>
      <el-button v-if="canCreate" type="primary" @click="open()">新增用户</el-button></div></template>
    <el-table v-loading="loading" :data="users" row-key="id">
      <el-table-column prop="username" label="用户名"/><el-table-column prop="displayName" label="姓名"/>
      <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.status==='ACTIVE'?'success':scope.row.status==='LOCKED'?'warning':'info'">{{ statusLabel(scope.row.status) }}</el-tag></template></el-table-column>
      <el-table-column label="角色" min-width="180"><template #default="scope">{{ roleNames(scope.row.roleIds) || '—' }}</template></el-table-column>
      <el-table-column label="组织" min-width="180"><template #default="scope">{{ organizationNames(scope.row.organizationIds) || '—' }}</template></el-table-column>
      <el-table-column label="操作" width="180" fixed="right"><template #default="scope">
        <el-button v-if="canEdit" link type="primary" @click="open(scope.row)">编辑</el-button>
        <el-button v-if="canResetPassword" link type="warning" @click="openPasswordReset(scope.row)">重置密码</el-button>
      </template></el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialog" :title="editingId?'编辑用户':'新增用户'" width="600px" @closed="clearPassword">
    <el-form label-width="100px">
      <el-form-item label="用户名" required><el-input v-model="form.username" :disabled="!!editingId" maxlength="64"/></el-form-item>
      <el-form-item label="姓名" required><el-input v-model="form.displayName" maxlength="128"/></el-form-item>
      <template v-if="!editingId"><el-form-item label="初始密码" required><el-input v-model="form.initialPassword" type="password" show-password maxlength="128" autocomplete="new-password"/><div class="field-hint">至少14个字符，请使用独立强密码</div></el-form-item>
        <el-form-item label="确认密码" required><el-input v-model="confirmPassword" type="password" show-password maxlength="128" autocomplete="new-password"/></el-form-item></template>
      <el-form-item label="所属组织"><el-select v-model="form.organizationIds" multiple filterable style="width:100%"><el-option v-for="org in organizations" :key="org.id" :label="org.name" :value="org.id"/></el-select></el-form-item>
      <el-form-item label="角色" required><el-select v-model="form.roleIds" multiple filterable style="width:100%"><el-option v-for="role in activeRoles" :key="role.id" :label="`${role.name} (${role.code})`" :value="role.id"/></el-select></el-form-item>
      <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE"/><el-option label="锁定" value="LOCKED"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item>
    </el-form>
    <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="passwordDialog" title="重置用户密码" width="500px" @closed="clearResetPassword">
    <el-alert type="warning" :closable="false" show-icon :title="`重置 ${passwordTarget?.displayName||''} 的密码后，该用户的所有 IAM 会话将立即失效。`"/>
    <el-form class="password-form" label-width="100px"><el-form-item label="新密码" required><el-input v-model="newPassword" type="password" show-password maxlength="128" autocomplete="new-password"/></el-form-item>
      <el-form-item label="确认密码" required><el-input v-model="newPasswordConfirm" type="password" show-password maxlength="128" autocomplete="new-password"/></el-form-item></el-form>
    <template #footer><el-button @click="passwordDialog=false">取消</el-button><el-button type="danger" :loading="saving" @click="resetPassword">确认重置</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { useAuthStore } from '@/stores'
import type { OrganizationRecord, RoleRecord, UserRecord } from '@/types/management'

const auth = useAuthStore()
const users = ref<UserRecord[]>([]); const roles = ref<RoleRecord[]>([]); const organizations = ref<OrganizationRecord[]>([])
const loading = ref(false); const saving = ref(false); const dialog = ref(false); const editingId = ref('')
const confirmPassword = ref(''); const passwordDialog = ref(false); const passwordTarget = ref<UserRecord|null>(null)
const newPassword = ref(''); const newPasswordConfirm = ref('')
const form = reactive({ username:'', displayName:'', status:'ACTIVE', initialPassword:'', roleIds:[] as string[], organizationIds:[] as string[], version:0 })
const canEdit = computed(() => auth.hasPermission('iam:user:write') && auth.hasPermission('iam:user:assign-role'))
const canResetPassword = computed(() => auth.hasPermission('iam:user:reset-password'))
const canCreate = computed(() => canEdit.value && canResetPassword.value)
const activeRoles = computed(() => roles.value.filter((role) => role.status === 'ACTIVE'))

async function load() { loading.value=true; try { [users.value,roles.value,organizations.value]=await Promise.all([apiClient.get('/management/tenant/users') as Promise<UserRecord[]>,apiClient.get('/management/tenant/roles') as Promise<RoleRecord[]>,apiClient.get('/management/tenant/organizations') as Promise<OrganizationRecord[]>]) } finally { loading.value=false } }
function open(row?:UserRecord) { editingId.value=row?.id||''; Object.assign(form,row||{username:'',displayName:'',status:'ACTIVE',initialPassword:'',roleIds:[],organizationIds:[],version:0}); clearPassword(); dialog.value=true }
function clearPassword(){form.initialPassword='';confirmPassword.value=''}
function roleNames(ids:string[]){return ids.map((id)=>roles.value.find((role)=>role.id===id)?.name||id).join('、')}
function organizationNames(ids:string[]){return ids.map((id)=>organizations.value.find((org)=>org.id===id)?.name||id).join('、')}
function statusLabel(status:string){return {ACTIVE:'启用',LOCKED:'锁定',DISABLED:'停用'}[status]||status}
function validatePassword(password:string, confirmation:string){if(password.length<14||password.length>128)throw new Error('密码长度必须为14至128个字符');if(password!==confirmation)throw new Error('两次输入的密码不一致')}
async function save(){try{if(!form.username.trim()||!form.displayName.trim())throw new Error('请完整填写用户名和姓名');if(!editingId.value)validatePassword(form.initialPassword,confirmPassword.value);saving.value=true;const payload={...form,initialPassword:editingId.value?null:form.initialPassword};if(editingId.value)await apiClient.put(`/management/tenant/users/${editingId.value}`,payload);else await apiClient.post('/management/tenant/users',payload);ElMessage.success('用户已保存');dialog.value=false;await load()}catch(error){ElMessage.error(error instanceof Error?error.message:'用户保存失败')}finally{saving.value=false}}
function openPasswordReset(row:UserRecord){passwordTarget.value=row;clearResetPassword();passwordDialog.value=true}
function clearResetPassword(){newPassword.value='';newPasswordConfirm.value=''}
async function resetPassword(){if(!passwordTarget.value)return;try{validatePassword(newPassword.value,newPasswordConfirm.value);saving.value=true;await apiClient.post(`/management/tenant/users/${passwordTarget.value.id}/password-reset`,{newPassword:newPassword.value});ElMessage.success('密码已重置，用户会话已撤销');passwordDialog.value=false;await load()}catch(error){ElMessage.error(error instanceof Error?error.message:'密码重置失败')}finally{saving.value=false}}
onMounted(()=>{void load()})
</script>

<style scoped>.header{display:flex;justify-content:space-between;align-items:center}.header>div{display:grid;gap:4px}.header small{color:#8a97a8;font-weight:400}.field-hint{margin-top:6px;color:#909399;font-size:12px}.password-form{margin-top:22px}</style>
