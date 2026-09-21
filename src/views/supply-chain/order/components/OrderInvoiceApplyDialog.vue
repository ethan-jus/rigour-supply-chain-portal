<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="640px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-width="110px"
    >
      <el-form-item v-if="profiles.length" label="开票信息">
        <el-select
          v-model="selectedProfileId"
          placeholder="选择该客户的开票信息"
          style="width: 100%"
        >
          <el-option
            v-for="item in profiles"
            :key="profileValue(item)"
            :label="profileLabel(item)"
            :value="profileValue(item)"
          />
          <el-option label="＋ 新增开票信息" :value="NEW_PROFILE" />
        </el-select>
      </el-form-item>
      <div v-if="profileHint" class="order-invoice-apply-dialog__hint">{{ profileHint }}</div>
      <el-form-item label="抬头类型" prop="titleType">
        <el-radio-group v-model="form.titleType">
          <el-radio value="COMPANY">企业</el-radio>
          <el-radio value="PERSONAL">个人</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="发票抬头" prop="title">
        <el-input v-model="form.title" maxlength="200" placeholder="营业执照/身份证上的名称" />
      </el-form-item>
      <el-form-item label="发票类型" prop="invoiceType">
        <el-radio-group v-model="form.invoiceType">
          <el-radio value="NORMAL">普通发票</el-radio>
          <el-radio value="SPECIAL">专用发票</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="纳税人识别号" prop="taxNo">
        <el-input v-model="form.taxNo" maxlength="64" placeholder="企业抬头必填" />
      </el-form-item>
      <template v-if="form.invoiceType === 'SPECIAL'">
        <el-form-item label="开户行" prop="bankName">
          <el-input v-model="form.bankName" maxlength="200" />
        </el-form-item>
        <el-form-item label="银行账号" prop="bankAccount">
          <el-input v-model="form.bankAccount" maxlength="64" />
        </el-form-item>
        <el-form-item label="注册地址" prop="registerAddress">
          <el-input v-model="form.registerAddress" maxlength="300" />
        </el-form-item>
        <el-form-item label="注册电话" prop="registerPhone">
          <el-input v-model="form.registerPhone" maxlength="64" />
        </el-form-item>
      </template>
      <el-form-item label="收票邮箱" prop="email">
        <el-input v-model="form.email" maxlength="200" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">提交申请</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  applyOrderInvoice,
  getOrderInvoice,
  getOrderInvoiceProfiles,
  type OrderInvoiceApplyPayload,
  type OrderInvoiceProfile,
  type OrderInvoiceView,
} from '@/api/core/order-register'

/** 表单可来自本单发票、客户资料或空表单；只取共同字段。 */
interface InvoiceFormSource {
  titleType?: string | null
  title?: string | null
  taxNo?: string | null
  invoiceType?: string | null
  bankName?: string | null
  bankAccount?: string | null
  registerAddress?: string | null
  registerPhone?: string | null
  email?: string | null
  remark?: string | null
}

const NEW_PROFILE = 'NEW'
const props = defineProps<{
  modelValue: boolean
  orderNo: string
  /** 已加载的本单发票；传 undefined 时弹窗打开后自行拉取（列表入口不知道详情）。 */
  invoice?: OrderInvoiceView | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  applied: [view: OrderInvoiceView]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const loading = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const resolved = ref<OrderInvoiceView | null>(null)
const profiles = ref<OrderInvoiceProfile[]>([])
const selectedProfileId = ref<string>(NEW_PROFILE)
const profileHint = ref('')
const form = reactive({
  titleType: 'COMPANY',
  title: '',
  taxNo: '',
  invoiceType: 'NORMAL',
  bankName: '',
  bankAccount: '',
  registerAddress: '',
  registerPhone: '',
  email: '',
  remark: '',
})

const title = computed(() => {
  const status = resolved.value?.statusCode
  if (status === 'REVOKED') return '重新申请开票'
  if (status === 'PENDING') return '修改开票资料'
  return '申请开票'
})

/** 必填规则跟随当前选择动态变化：红星与校验一起切换。 */
const rules = computed<FormRules>(() => ({
  title: [{ required: true, message: '请填写发票抬头', trigger: 'blur' }],
  taxNo: [
    {
      required: form.titleType === 'COMPANY',
      message: '企业抬头必须填写纳税人识别号',
      trigger: 'blur',
    },
  ],
  bankName: [
    { required: form.invoiceType === 'SPECIAL', message: '专票必须填写开户行', trigger: 'blur' },
  ],
  bankAccount: [
    { required: form.invoiceType === 'SPECIAL', message: '专票必须填写银行账号', trigger: 'blur' },
  ],
  registerAddress: [
    { required: form.invoiceType === 'SPECIAL', message: '专票必须填写注册地址', trigger: 'blur' },
  ],
  registerPhone: [
    { required: form.invoiceType === 'SPECIAL', message: '专票必须填写注册电话', trigger: 'blur' },
  ],
}))

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await prefill()
  },
  { immediate: true },
)

watch(
  () => form.titleType,
  () => formRef.value?.clearValidate('taxNo'),
)
watch(
  () => form.invoiceType,
  () => formRef.value?.clearValidate(['bankName', 'bankAccount', 'registerAddress', 'registerPhone']),
)

/** 预填会程序化赋值选中项，这里同步跳过，仅响应用户选择。 */
let selectingProgrammatically = false
watch(
  selectedProfileId,
  (value) => {
    if (selectingProgrammatically) return
    onProfileChange(value)
  },
  { flush: 'sync' },
)

function selectProfile(profileId: string) {
  selectingProgrammatically = true
  selectedProfileId.value = profileId
  selectingProgrammatically = false
}

function profileValue(profile: OrderInvoiceProfile) {
  return String(profile.id)
}

function profileLabel(profile: OrderInvoiceProfile) {
  const type = profile.invoiceTypeName || '-'
  const taxNo = profile.taxNo ? ` · ${profile.taxNo}` : ''
  return `${profile.title || '-'}（${type}${taxNo}）`
}

function sameProfile(profile: OrderInvoiceProfile, invoice: OrderInvoiceView) {
  return (
    profile.title === invoice.title &&
    (profile.taxNo || '') === (invoice.taxNo || '') &&
    profile.invoiceType === invoice.invoiceType
  )
}

async function prefill() {
  let own = props.invoice
  if (own === undefined) {
    loading.value = true
    try {
      own = await getOrderInvoice(props.orderNo)
    } catch {
      ElMessage.warning('开票资料加载失败，可按新申请填写')
      own = null
    } finally {
      loading.value = false
    }
  }
  resolved.value = own ?? null

  profiles.value = []
  try {
    profiles.value = await getOrderInvoiceProfiles(props.orderNo)
  } catch {
    // 客户资料下拉不可用不阻断申请；按空表单走。
  }

  if (own) {
    fill(own)
    const matched = profiles.value.find((item) => sameProfile(item, own))
    selectProfile(matched ? profileValue(matched) : NEW_PROFILE)
    profileHint.value = ''
    return
  }
  const recent = profiles.value[0] ?? null
  if (recent) {
    fill(recent)
    selectProfile(profileValue(recent))
    profileHint.value = '已带入该客户最近使用的开票信息，可切换或新增'
    return
  }
  fill(null)
  selectProfile(NEW_PROFILE)
  profileHint.value = ''
}

function onProfileChange(value: string) {
  if (value === NEW_PROFILE) {
    fill(null)
    profileHint.value = '已切换为新增开票信息，请填写后提交'
    return
  }
  const profile = profiles.value.find((item) => profileValue(item) === value)
  if (profile) {
    fill(profile)
    profileHint.value = ''
  }
}

function fill(source: InvoiceFormSource | null) {
  form.titleType = source?.titleType || 'COMPANY'
  form.title = source?.title || ''
  form.taxNo = source?.taxNo || ''
  form.invoiceType = source?.invoiceType || 'NORMAL'
  form.bankName = source?.bankName || ''
  form.bankAccount = source?.bankAccount || ''
  form.registerAddress = source?.registerAddress || ''
  form.registerPhone = source?.registerPhone || ''
  form.email = source?.email || ''
  form.remark = source?.remark || ''
  formRef.value?.clearValidate()
}

async function submit() {
  const instance = formRef.value
  if (!instance) return
  const valid = await instance.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload: OrderInvoiceApplyPayload = { orderNo: props.orderNo, ...form }
    const view = await applyOrderInvoice(payload)
    emit('applied', view)
    visible.value = false
    ElMessage.success('开票申请已提交，状态为待开票')
  } catch (reason) {
    const message =
      reason && typeof reason === 'object' && 'message' in reason
        ? String((reason as { message?: unknown }).message || '开票申请提交失败，请稍后重试')
        : '开票申请提交失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.order-invoice-apply-dialog__hint {
  margin: -6px 0 10px 110px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
