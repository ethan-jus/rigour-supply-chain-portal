<template>
  <el-dialog
    v-model="visible"
    :title="supplierId ? '编辑供应商' : '新增供应商'"
    width="min(820px, 96vw)"
    top="6vh"
    class="erp-supplier-editor"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-position="top"
      class="supplier-profile-form"
    >
      <section class="supplier-form-section">
        <div class="supplier-section-title">
          <h3>基本信息</h3>
        </div>
        <el-form-item label="供应商名称" prop="supplierName"
          ><el-input v-model="form.supplierName" maxlength="200" placeholder="填写供应商完整名称"
        /></el-form-item>
        <el-form-item label="状态" prop="statusCode"
          ><el-radio-group
            :model-value="form.statusCode || 'ACTIVE'"
            @update:model-value="form.statusCode = String($event)"
            ><el-radio value="ACTIVE">启用</el-radio
            ><el-radio value="DISABLED">停用</el-radio></el-radio-group
          ></el-form-item
        >
      </section>
      <section class="supplier-form-section">
        <h3>联系信息</h3>
        <div class="supplier-form-grid">
          <el-form-item label="联系人" prop="contactName"
            ><el-input
              v-model="form.contactName"
              maxlength="100"
              placeholder="填写联系人" /></el-form-item
          ><el-form-item label="联系电话" prop="contactPhone"
            ><el-input
              v-model="form.contactPhone"
              maxlength="50"
              placeholder="手机号或固定电话" /></el-form-item
          ><el-form-item class="full" label="联系地址" prop="address"
            ><el-input
              v-model="form.address"
              type="textarea"
              :rows="2"
              maxlength="1000"
              placeholder="填写详细联系地址"
          /></el-form-item>
        </div>
      </section>
      <section class="supplier-form-section">
        <h3>财务信息</h3>
        <div class="supplier-form-grid">
          <el-form-item class="full" label="开户名称" prop="accountName">
            <el-input
              v-model="form.accountName"
              maxlength="200"
              placeholder="填写银行账户开户名称"
            />
          </el-form-item>
          <el-form-item label="开户银行" prop="bankName"
            ><el-input
              v-model="form.bankName"
              maxlength="100"
              placeholder="填写银行及支行名称" /></el-form-item
          ><el-form-item label="银行账号" prop="bankAccountNo"
            ><el-input v-model="form.bankAccountNo" maxlength="100" placeholder="填写银行账号"
          /></el-form-item>
          <el-form-item class="full" label="开票抬头" prop="invoiceTitle">
            <el-input v-model="form.invoiceTitle" maxlength="200" placeholder="填写开票抬头" />
          </el-form-item>
          <el-form-item class="full" label="纳税人识别号" prop="taxpayerNumber">
            <el-input v-model="form.taxpayerNumber" maxlength="50" placeholder="填写纳税人识别号" />
          </el-form-item>
        </div>
      </section>
      <section class="supplier-form-section">
        <el-form-item label="备注"
          ><el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
            placeholder="填写补充说明"
        /></el-form-item>
      </section>
    </el-form>
    <template #footer
      ><div class="supplier-form-footer">
        <span><b>*</b> 为必填项</span>
        <div>
          <el-button @click="visible = false">取消</el-button
          ><el-button type="primary" :disabled="loading" :loading="saving" @click="save"
            >保存供应商</el-button
          >
        </div>
      </div></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/core/error'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createErpSupplierProfile,
  updateErpSupplierProfile,
  getErpSupplierProfile,
  type ErpSupplierProfileCommand,
  type ErpSupplierProfileView,
} from '@/api/core/erp-internal'
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ supplierId?: string | null }>()
const emit = defineEmits<{ saved: [supplier: ErpSupplierProfileView] }>()
const formRef = ref<FormInstance>(),
  loading = ref(false),
  saving = ref(false)
const form = reactive<ErpSupplierProfileCommand>({ supplierName: '' })
const requiredFields = {
  supplierName: '请输入供应商名称',
  statusCode: '请选择状态',
  contactName: '请输入联系人',
  contactPhone: '请输入联系电话',
  address: '请输入联系地址',
  accountName: '请输入开户名称',
  bankName: '请输入开户银行',
  bankAccountNo: '请输入银行账号',
} as const
const rules: FormRules = Object.fromEntries(
  Object.entries(requiredFields).map(([key, message]) => [
    key,
    [{ required: true, whitespace: true, message, trigger: 'blur' }],
  ]),
)
let request = 0
watch(visible, async (value) => {
  const token = ++request
  if (!value) return
  loading.value = false
  Object.assign(form, {
    supplierName: '',
    contactName: '',
    contactPhone: '',
    address: '',
    bankName: '',
    bankAccountNo: '',
    accountName: '',
    invoiceTitle: '',
    taxpayerNumber: '',
    statusCode: 'ACTIVE',
    remark: '',
    revision: undefined,
  })
  if (!props.supplierId) return
  loading.value = true
  try {
    const row = await getErpSupplierProfile(props.supplierId)
    if (token !== request) return
    Object.assign(form, row, { statusCode: row.statusCode || 'ACTIVE' })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '供应商加载失败'))
    visible.value = false
  } finally {
    if (token === request) loading.value = false
  }
})
async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  const missing = (Object.keys(requiredFields) as Array<keyof typeof requiredFields>).find(
    (key) => !form[key]?.trim(),
  )
  if (!valid || missing) {
    if (missing) ElMessage.warning(requiredFields[missing])
    return
  }
  saving.value = true
  try {
    // 明确映射可编辑字段，禁止提交主档编码和审计字段。
    const command: ErpSupplierProfileCommand = {
      supplierName: form.supplierName.trim(),
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      address: form.address,
      bankName: form.bankName,
      bankAccountNo: form.bankAccountNo,
      accountName: form.accountName,
      invoiceTitle: form.invoiceTitle,
      taxpayerNumber: form.taxpayerNumber,
      statusCode: form.statusCode,
      remark: form.remark,
      revision: form.revision,
    }
    const row = props.supplierId
      ? await updateErpSupplierProfile(props.supplierId, command)
      : await createErpSupplierProfile(command)
    emit('saved', row)
    visible.value = false
    ElMessage.success('供应商已保存')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '供应商保存失败，请检查输入后重试'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
:global(.erp-supplier-editor.el-dialog) {
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
}
:global(.erp-supplier-editor .el-dialog__header) {
  padding: 18px 22px;
  margin: 0;
  border-bottom: 1px solid #e2e8f0;
}
:global(.erp-supplier-editor .el-dialog__title) {
  font-size: 17px;
  font-weight: 600;
}
:global(.erp-supplier-editor .el-dialog__body) {
  padding: 20px 22px;
}
:global(.erp-supplier-editor .el-dialog__footer) {
  padding: 14px 22px;
  border-top: 1px solid #e2e8f0;
}

.supplier-profile-form {
  max-height: calc(84dvh - 130px);
  overflow-y: auto;
  padding-right: 4px;
}
.supplier-form-section {
  padding: 0 0 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid #e2e8f0;
}
.supplier-form-section:last-child {
  border: 0;
  margin: 0;
  padding: 0;
}
.supplier-form-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}
.supplier-form-section h3 span {
  font-size: 12px;
  font-weight: 400;
  color: #94a3b8;
  margin-left: 8px;
}
.supplier-section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.supplier-section-title > span {
  font-size: 12px;
  color: #64748b;
}
.supplier-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
}
.supplier-form-grid .full {
  grid-column: 1/-1;
}
.supplier-profile-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.supplier-profile-form :deep(.el-form-item__label) {
  height: auto;
  line-height: 20px;
  padding: 0;
  margin-bottom: 6px;
  font-size: 13px;
}
.supplier-form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.supplier-form-footer > span {
  font-size: 12px;
  color: #8492a6;
}
.supplier-form-footer b {
  color: #f56c6c;
}
@media (max-width: 600px) {
  .supplier-form-grid {
    grid-template-columns: 1fr;
  }
  .supplier-section-title {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 12px;
  }
  .supplier-section-title h3 {
    margin: 0;
  }
}
</style>
