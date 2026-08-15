<template>
  <ManagementCrudPage title="组织" endpoint="/management/tenant/organizations"
    write-permission="iam:organization:write" :columns="columns" :fields="fields" />
</template>
<script setup lang="ts">
import ManagementCrudPage, { type CrudColumn, type CrudField } from '@/components/management/ManagementCrudPage.vue'
import { formatPortalOrganizationType, formatPortalStatus } from '@/utils/portal-labels'
const columns: CrudColumn[] = [{key:'code',label:'编码'},{key:'name',label:'名称'},{key:'type',label:'类型',formatter:(value)=>formatPortalOrganizationType(value as string)},{key:'path',label:'组织路径',width:220},{key:'status',label:'状态',formatter:(value)=>formatPortalStatus(value as string)}]
const fields: CrudField[] = [
  {key:'parentId',label:'上级组织ID'},{key:'code',label:'组织编码',required:true},{key:'name',label:'组织名称',required:true},
  {key:'type',label:'组织类型',type:'select',defaultValue:'DEPARTMENT',options:[{label:'公司',value:'COMPANY'},{label:'区域',value:'REGION'},{label:'城市',value:'CITY'},{label:'部门',value:'DEPARTMENT'},{label:'团队',value:'TEAM'}]},
  {key:'sortOrder',label:'排序',type:'number',defaultValue:0},{key:'status',label:'状态',type:'select',defaultValue:'ACTIVE',options:[{label:'启用',value:'ACTIVE'},{label:'停用',value:'DISABLED'}]},
]
</script>
