<template>
  <ManagementCrudPage title="应用目录" endpoint="/management/platform/applications"
    :columns="columns" :fields="fields" />
  <el-card class="client-card"><template #header><div class="client-header"><strong>OIDC公开客户端</strong><el-button type="primary" @click="openClient">注册客户端</el-button></div></template><el-table :data="clients"><el-table-column prop="clientId" label="Client ID"/><el-table-column prop="clientName" label="名称"/><el-table-column prop="redirectUri" label="登录回调" min-width="240"/><el-table-column prop="postLogoutRedirectUri" label="退出回调" min-width="220"/></el-table></el-card>
  <el-dialog v-model="clientDialog" title="公开PKCE客户端"><el-form label-width="110px"><el-form-item label="关联应用"><el-select v-model="client.applicationId" style="width:100%"><el-option v-for="app in applications" :key="app.id" :label="app.name" :value="app.id"/></el-select></el-form-item><el-form-item label="Client ID"><el-input v-model="client.clientId"/></el-form-item><el-form-item label="名称"><el-input v-model="client.clientName"/></el-form-item><el-form-item label="登录回调"><el-input v-model="client.redirectUri"/></el-form-item><el-form-item label="退出回调"><el-input v-model="client.postLogoutRedirectUri"/></el-form-item></el-form><template #footer><el-button @click="clientDialog=false">取消</el-button><el-button type="primary" @click="saveClient">保存</el-button></template></el-dialog>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import ManagementCrudPage, { type CrudColumn, type CrudField } from '@/components/management/ManagementCrudPage.vue'
import type { ApplicationRecord } from '@/types/management'
interface OidcClientRecord { id:string;applicationId:string|null;clientId:string;clientName:string;redirectUri:string;postLogoutRedirectUri:string }
const columns: CrudColumn[] = [
  { key:'code',label:'编码' }, { key:'name',label:'名称' }, { key:'scope',label:'范围' },
  { key:'type',label:'类型' }, { key:'launchMode',label:'启动方式' }, { key:'targetUri',label:'启动地址',width:180 },
  { key:'status',label:'状态' },
]
const fields: CrudField[] = [
  { key:'code',label:'应用编码',required:true }, { key:'name',label:'应用名称',required:true },
  { key:'scope',label:'应用范围',type:'select',defaultValue:'TENANT',options:[{label:'平台',value:'PLATFORM'},{label:'租户',value:'TENANT'}] },
  { key:'type',label:'应用类型',type:'select',defaultValue:'INTERNAL',options:[{label:'内部',value:'INTERNAL'},{label:'外部',value:'EXTERNAL'}] },
  { key:'iconKey',label:'图标标识' }, { key:'sortOrder',label:'排序',type:'number',defaultValue:0 },
  { key:'launchMode',label:'启动方式',type:'select',defaultValue:'INTERNAL_ROUTE',options:[{label:'内部路由',value:'INTERNAL_ROUTE'},{label:'OIDC客户端',value:'OIDC_CLIENT'},{label:'HTTPS外链',value:'EXTERNAL_URL'},{label:'飞书',value:'FEISHU_DEEPLINK'},{label:'外部SSO',value:'SSO_PROVIDER'}] },
  { key:'targetUri',label:'启动地址' }, { key:'status',label:'状态',type:'select',defaultValue:'DISABLED',options:[{label:'启用',value:'ACTIVE'},{label:'停用',value:'DISABLED'}] },
]
const applications=ref<ApplicationRecord[]>([]);const clients=ref<OidcClientRecord[]>([]);const clientDialog=ref(false);const client=reactive({applicationId:'',clientId:'',clientName:'',redirectUri:'',postLogoutRedirectUri:''})
async function loadClients(){[applications.value,clients.value]=await Promise.all([apiClient.get('/management/platform/applications') as Promise<ApplicationRecord[]>,apiClient.get('/management/platform/oidc-clients') as Promise<OidcClientRecord[]>])}
function openClient(){Object.assign(client,{applicationId:applications.value[0]?.id||'',clientId:'',clientName:'',redirectUri:'',postLogoutRedirectUri:''});clientDialog.value=true}
async function saveClient(){await apiClient.post('/management/platform/oidc-clients',client);ElMessage.success('OIDC客户端已保存');clientDialog.value=false;await loadClients()}
onMounted(()=>{void loadClients()})
</script>
<style scoped>.client-card{margin-top:20px}.client-header{display:flex;justify-content:space-between;align-items:center}</style>
