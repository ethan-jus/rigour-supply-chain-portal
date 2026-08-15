<template>
  <el-card>
    <template #header><div class="header"><strong>菜单与资源管理</strong><div>
      <el-select v-model="applicationId" placeholder="选择应用" style="width:220px" @change="loadResources">
        <el-option v-for="app in applications" :key="app.id" :label="app.name" :value="app.id" />
      </el-select><el-button type="primary" :disabled="!applicationId" @click="openCreate">新增资源</el-button>
    </div></div></template>
    <el-table :data="resources" row-key="id"><el-table-column prop="displayName" label="名称" />
      <el-table-column prop="code" label="资源编码" min-width="220" /><el-table-column label="类型"><template #default="scope">{{ formatPortalResourceType(scope.row.type) }}</template></el-table-column>
      <el-table-column prop="permissionCode" label="权限码" min-width="180" /><el-table-column prop="routePath" label="路由" min-width="180" />
      <el-table-column label="状态"><template #default="scope">{{ formatPortalStatus(scope.row.status) }}</template></el-table-column><el-table-column label="操作"><template #default="scope"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button></template></el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="dialog" title="资源配置" width="620px"><el-form label-width="110px">
    <el-form-item label="父资源"><el-select v-model="form.parentId" clearable style="width:100%"><el-option v-for="item in resources" :key="item.id" :label="item.displayName" :value="item.id" /></el-select></el-form-item>
    <el-form-item label="资源编码"><el-input v-model="form.code" /></el-form-item>
    <el-form-item label="资源类型"><el-select v-model="form.type"><el-option v-for="item in resourceTypes" :key="item" :label="formatPortalResourceType(item)" :value="item" /></el-select></el-form-item>
    <el-form-item label="显示名称"><el-input v-model="form.displayName" /></el-form-item>
    <el-form-item label="权限码"><el-input v-model="form.permissionCode" placeholder="如 iam:user:read" /></el-form-item>
    <el-form-item label="路由标识"><el-input v-model="form.routeKey" placeholder="仅菜单和页面必填" /></el-form-item>
    <el-form-item label="路由地址"><el-input v-model="form.routePath" /></el-form-item>
    <el-form-item label="图标"><el-input v-model="form.iconKey" /></el-form-item>
    <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
    <el-form-item label="显示"><el-switch v-model="form.visible" /></el-form-item>
    <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="DISABLED"/></el-select></el-form-item>
  </el-form><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template></el-dialog>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import type { ApplicationRecord, ResourceRecord } from '@/types/management'
import { formatPortalResourceType, formatPortalStatus } from '@/utils/portal-labels'
const applications=ref<ApplicationRecord[]>([]); const resources=ref<ResourceRecord[]>([]); const applicationId=ref(''); const dialog=ref(false); const editingId=ref('')
const resourceTypes=['APPLICATION','MENU','PAGE','BUTTON','API']
const form=reactive({applicationId:'',parentId:null as string|null,code:'',type:'MENU',permissionCode:'',displayName:'',sortOrder:0,status:'ACTIVE',routeKey:'',routePath:'',iconKey:'',visible:true,keepAlive:false,version:0})
async function loadResources(){ if(!applicationId.value)return; resources.value=(await apiClient.get(`/management/platform/applications/${applicationId.value}/resources`)) as ResourceRecord[] }
function reset(){ Object.assign(form,{applicationId:applicationId.value,parentId:null,code:'',type:'MENU',permissionCode:'',displayName:'',sortOrder:0,status:'ACTIVE',routeKey:'',routePath:'',iconKey:'',visible:true,keepAlive:false,version:0}) }
function openCreate(){editingId.value='';reset();dialog.value=true}
function openEdit(row:ResourceRecord){editingId.value=row.id;Object.assign(form,row);dialog.value=true}
async function save(){ if(editingId.value)await apiClient.put(`/management/platform/resources/${editingId.value}`,form);else await apiClient.post('/management/platform/resources',form);ElMessage.success('保存成功');dialog.value=false;await loadResources() }
onMounted(async()=>{applications.value=(await apiClient.get('/management/platform/applications')) as ApplicationRecord[];if(applications.value[0]){applicationId.value=applications.value[0].id;await loadResources()}})
</script>
<style scoped>.header{display:flex;justify-content:space-between;align-items:center}.header>div{display:flex;gap:12px}</style>
