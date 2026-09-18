<template>
  <section class="parameters" v-loading="loading">
    <aside><h3>业务分组</h3><el-menu :default-active="group" @select="group=$event"><el-menu-item v-for="name in groups" :key="name" :index="name">{{ name }}</el-menu-item></el-menu></aside>
    <main><SupplyPageTitle tag="h2">业务参数</SupplyPageTitle><el-empty v-if="!parameters.length" description="暂无可维护参数" />
      <el-card v-for="parameter in parameters.filter(p=>p.group===group)" :key="parameter.code" class="parameter">
        <h3>{{ parameter.name }}</h3><p>{{ parameter.description }}</p>
        <el-form label-width="95px"><el-form-item label="当前值"><strong>{{ parameter.value }}</strong></el-form-item><el-form-item label="默认值">{{ parameter.defaultValue }}</el-form-item><el-form-item label="生效范围">{{ parameter.effect }}</el-form-item></el-form>
        <el-button v-if="can('supply:parameter:update')" type="primary" @click="edit(parameter)">修改参数</el-button>
      </el-card>
    </main>
    <el-dialog v-model="visible" :title="selected?.name" width="570px">
      <template v-if="selected"><el-alert :title="selected.effect" :closable="false" type="info" />
        <el-form label-width="95px" class="edit-form"><el-form-item label="新的值" required><el-input-number v-model="value" :min="selected.minimum" :max="selected.maximum" :precision="0" /><el-button link @click="value=Number(selected.defaultValue)">恢复默认值</el-button></el-form-item><el-form-item label="变更原因" required><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit /></el-form-item></el-form>
        <p>保存后：{{ selected.value }} → {{ value }}</p>
      </template>
      <template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存并生效</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed,onMounted,ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrderParameters,saveOrderParameter,type OrderParameter } from '@/api/core/order-parameters'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const {can}=useSupplyPermissions()
const parameters=ref<OrderParameter[]>([]), loading=ref(false),saving=ref(false),visible=ref(false),group=ref(''),selected=ref<OrderParameter|null>(null),value=ref(200),reason=ref('')
const groups=computed(()=>[...new Set(parameters.value.map(p=>p.group))])
async function load(){loading.value=true;try{parameters.value=await getOrderParameters();if(!groups.value.includes(group.value))group.value=groups.value[0]||''}finally{loading.value=false}}
function edit(parameter:OrderParameter){selected.value=parameter;value.value=Number(parameter.value);reason.value='';visible.value=true}
async function save(){if(!selected.value)return;if(!reason.value.trim()){ElMessage.warning('请填写变更原因');return} saving.value=true;try{await saveOrderParameter(selected.value.code,String(value.value),selected.value.revision,reason.value.trim());visible.value=false;await load();ElMessage.success('参数已保存并生效')}finally{saving.value=false}}
onMounted(load)
</script>
<style scoped>.parameters{display:grid;grid-template-columns:190px 1fr;gap:24px;padding:20px}.parameter{margin:16px 0}.edit-form{margin-top:20px}p{color:#64748b;line-height:1.7}@media(max-width:800px){.parameters{grid-template-columns:1fr}}</style>
