<template>
  <section class="shipping-addresses">
    <div class="shipping-heading">
      <h3>收货信息</h3>
      <el-button v-if="canEdit" type="primary" class="add-shipping-address" @click="open()"
        >新增收货地址</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="rows" v-loading="loading" row-key="id">
      <el-table-column prop="consignee" label="收货单位" min-width="140" show-overflow-tooltip />
      <el-table-column prop="contact" label="收货人" width="110" />
      <el-table-column prop="phone" label="联系电话" width="145" />
      <el-table-column prop="fullAddress" label="收货地址" min-width="230" show-overflow-tooltip />
      <el-table-column label="默认" width="80"
        ><template #default="{ row }"
          ><el-tag v-if="row.defaultAddress" type="success">默认</el-tag></template
        ></el-table-column
      >
      <!-- @vue-generic {CustomerShippingAddressView} -->
      <el-table-column v-if="canEdit" label="操作" width="160"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="open(row)">编辑</el-button
          ><el-button link type="danger" @click="remove(row)">删除</el-button></template
        ></el-table-column
      >
      <template #empty><el-empty description="暂无收货地址" :image-size="64" /></template>
    </el-table>
    <el-dialog
      v-model="visible"
      :title="editing ? '编辑收货地址' : '新增收货地址'"
      width="min(640px, 92vw)"
      append-to-body
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" @submit.prevent="save">
        <el-form-item label="收货单位"
          ><el-input v-model="form.consignee" maxlength="240" placeholder="收货单位（选填）"
        /></el-form-item>
        <el-form-item label="收货人" required
          ><el-input v-model="form.contact" maxlength="160"
        /></el-form-item>
        <el-form-item label="联系电话" required
          ><el-input v-model="form.phone" maxlength="128"
        /></el-form-item>
        <el-form-item label="所在地区" required
          ><el-input v-model="form.regionText" maxlength="500" placeholder="省 / 市 / 区县"
        /></el-form-item>
        <el-form-item label="详细地址" required
          ><el-input
            v-model="form.addressDetail"
            maxlength="1000"
            placeholder="街道、门牌号等详细地址"
        /></el-form-item>
        <el-form-item label="默认地址"
          ><el-switch
            v-model="form.defaultAddress"
            :disabled="rows.length === 0 || Boolean(editing?.defaultAddress)"
          /><small>默认地址用于客户档案展示</small></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save">保存</el-button></template
      >
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCustomerShippingAddresses,
  saveCustomerShippingAddress,
  deleteCustomerShippingAddress,
  type CustomerShippingAddressView,
  type CustomerShippingAddressCommand,
} from '@/api/core/crm'
const props = defineProps<{ customerId: string | number; canEdit: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const rows = ref<CustomerShippingAddressView[]>([]),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  error = ref('')
const editing = ref<CustomerShippingAddressView | null>(null)
const form = reactive<CustomerShippingAddressCommand>({
  consignee: '',
  contact: '',
  phone: '',
  regionText: '',
  addressDetail: '',
  defaultAddress: true,
})
let request = 0
async function load() {
  const current = ++request
  loading.value = true
  error.value = ''
  try {
    const data = await getCustomerShippingAddresses(props.customerId)
    if (current === request) rows.value = data
  } catch (e) {
    if (current === request) {
      rows.value = []
      error.value = message(e)
    }
  } finally {
    if (current === request) loading.value = false
  }
}
watch(
  () => props.customerId,
  () => {
    visible.value = false
    void load()
  },
  { immediate: true },
)
function open(row?: CustomerShippingAddressView) {
  editing.value = row || null
  Object.assign(
    form,
    row || {
      consignee: '',
      contact: '',
      phone: '',
      regionText: '',
      addressDetail: '',
      defaultAddress: !rows.value.length,
      revision: null,
    },
  )
  visible.value = true
}
async function save() {
  if (
    !['contact', 'phone', 'regionText', 'addressDetail'].every((k) =>
      String(form[k as keyof typeof form] || '').trim(),
    )
  ) {
    ElMessage.warning('请补全收货人、联系电话、所在地区和详细地址')
    return
  }
  saving.value = true
  try {
    await saveCustomerShippingAddress(props.customerId, editing.value?.id || null, { ...form })
    visible.value = false
    await load()
    emit('changed')
    ElMessage.success('收货地址已保存')
  } catch (e) {
    ElMessage.error(message(e))
  } finally {
    saving.value = false
  }
}
async function remove(row: CustomerShippingAddressView) {
  try {
    await ElMessageBox.confirm(`删除 ${row.contact} 的这条收货地址？`, '删除收货地址', {
      type: 'warning',
    })
    await deleteCustomerShippingAddress(props.customerId, row.id, row.revision)
    await load()
    emit('changed')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e))
  }
}
function message(e: unknown) {
  return e instanceof Error ? e.message : '收货地址操作失败，请重试'
}
</script>
<style scoped>
.shipping-addresses {
  margin-top: 24px;
}
.shipping-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  min-height: 32px;
}
.shipping-heading h3 {
  margin: 0;
  font-size: 16px;
}
.add-shipping-address {
  flex: 0 0 auto;
  white-space: nowrap;
}
small {
  margin-left: 12px;
  color: var(--el-text-color-secondary);
}
</style>
