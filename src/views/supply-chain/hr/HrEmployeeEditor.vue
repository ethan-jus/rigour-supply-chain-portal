<template>
  <el-dialog
    v-model="visible"
    :title="record ? '编辑员工' : '新增员工'"
    width="min(960px,calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    class="employee-editor"
  >
    <el-form v-loading="loading" label-position="top" :model="form" @submit.prevent="save">
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
      <h3>基本信息</h3>
      <div class="form-grid">
        <el-form-item label="部门" required
          ><el-tree-select
            v-model="form.departmentId"
            :data="departmentTree"
            node-key="id"
            :props="{ label: 'departmentName', children: 'children', disabled: 'disabled' }"
            check-strictly
            filterable
            placeholder="请选择部门"
        /></el-form-item>
        <el-form-item label="岗位" required
          ><el-select v-model="form.positionCode" filterable placeholder="请选择岗位">
            <el-option
              v-for="p in positions"
              :key="p.positionCode"
              :value="p.positionCode"
              :label="p.positionName" /></el-select
        ></el-form-item>
        <el-form-item label="姓名" required
          ><el-input v-model="form.employeeName" maxlength="128" placeholder="请输入姓名"
        /></el-form-item>
        <el-form-item label="手机号"
          ><el-input v-model="form.mobile" maxlength="32"
        /></el-form-item>
        <el-form-item label="身份证号" :error="identity.error"
          ><el-input v-model="profile.idNumber" maxlength="18" placeholder="18位居民身份证号"
        /></el-form-item>
        <el-form-item label="出生日期"
          ><el-input :model-value="identity.birthDate" readonly placeholder="根据身份证自动显示"
        /></el-form-item>
        <el-form-item label="年龄"
          ><el-input :model-value="identity.age" readonly placeholder="自动计算"
        /></el-form-item>
        <el-form-item label="性别"
          ><el-input :model-value="identity.gender" readonly placeholder="根据身份证自动显示"
        /></el-form-item>
        <el-form-item label="学历"
          ><el-select v-model="profile.education" clearable
            ><el-option v-for="v in educationOptions" :key="v" :label="v" :value="v" /></el-select
        ></el-form-item>
      </div>
      <h3>教育信息</h3>
      <div class="form-grid">
        <el-form-item label="毕业院校" class="span-two"
          ><el-input v-model="profile.graduationSchool" maxlength="128"
        /></el-form-item>
        <el-form-item label="专业"
          ><el-input v-model="profile.major" maxlength="128"
        /></el-form-item>
      </div>
      <h3>任职信息</h3>
      <div class="form-grid">
        <el-form-item label="职级"
          ><el-input v-model="form.jobGrade" maxlength="32" placeholder="业务员默认 S1"
        /></el-form-item>
        <el-form-item label="入职日期"
          ><el-date-picker v-model="entryDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="在职状态"
          ><el-select
            v-model="form.employmentStatus"
            :disabled="!!record && !can('hr:employee:status')"
          >
            <el-option label="在职" value="ACTIVE" /><el-option
              label="离职"
              value="LEFT"
            /><el-option label="停用" value="INACTIVE" /><el-option
              label="待确认"
              value="PENDING"
            /> </el-select
        ></el-form-item>
        <el-form-item v-if="form.employmentStatus === 'LEFT'" label="离职日期" required
          ><el-date-picker v-model="leaveDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="工龄"><el-input :model-value="tenure" readonly /></el-form-item>
        <el-form-item label="合同截止日期"
          ><el-date-picker v-model="profile.contractEndDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="参保状态"
          ><el-select v-model="profile.socialInsurance" clearable
            ><el-option v-for="v in insuranceOptions" :key="v" :label="v" :value="v" /></el-select
        ></el-form-item>
      </div>
      <h3>薪资档案</h3>
      <p class="section-note">记录约定薪资，支持填写薪资构成；此处不会自动调整薪酬核算规则。</p>
      <div class="form-grid">
        <el-form-item label="转正薪资"
          ><el-input v-model="profile.regularSalary" maxlength="64" placeholder="例如 8000+8000"
        /></el-form-item>
        <el-form-item label="试用期薪资"
          ><el-input v-model="profile.probationSalary" maxlength="64"
        /></el-form-item>
        <el-form-item label="试用期"
          ><el-input v-model="profile.probationPeriod" maxlength="32" placeholder="例如 3个月"
        /></el-form-item>
      </div>
      <h3>联系与账户信息</h3>
      <div class="form-grid">
        <el-form-item label="户口性质"
          ><el-select v-model="profile.householdType" clearable
            ><el-option v-for="v in householdOptions" :key="v" :label="v" :value="v" /></el-select
        ></el-form-item>
        <el-form-item label="户籍地址" class="span-two"
          ><el-input v-model="profile.registeredAddress" maxlength="300"
        /></el-form-item>
        <el-form-item label="现居住地" class="full-row"
          ><el-input v-model="profile.residentialAddress" maxlength="300"
        /></el-form-item>
        <el-form-item label="银行卡号"
          ><el-input v-model="profile.bankAccount" maxlength="32"
        /></el-form-item>
        <el-form-item label="开户行" class="span-two"
          ><el-input v-model="profile.bankName" maxlength="128"
        /></el-form-item>
        <el-form-item label="紧急联系人"
          ><el-input v-model="profile.emergencyContact" maxlength="128"
        /></el-form-item>
        <el-form-item label="紧急联系方式"
          ><el-input v-model="profile.emergencyPhone" maxlength="32"
        /></el-form-item>
        <el-form-item label="备注" class="full-row"
          ><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500"
        /></el-form-item>
      </div>
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
    </el-form>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="loading || !!loadError" :loading="saving" @click="save"
        >确定</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getHrEmployee,
  getHrPositions,
  hrOrganizationApi,
  type HrDepartmentOption,
  type HrEmployeeCommand,
  type HrEmployeeProfile,
  type HrEmployeeRecord,
  type HrPositionRecord,
} from '@/api/core/hr'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  dateOnly,
  identityDetails,
  serviceLength,
  educationOptions,
  householdOptions,
  insuranceOptions,
} from '@/utils/hr-employee-profile'
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ record: HrEmployeeRecord | null; departmentId?: number | null }>()
const emit = defineEmits<{ saved: [] }>()
const { can } = useSupplyPermissions()
const loading = ref(false),
  saving = ref(false),
  loadError = ref(''),
  saveError = ref('')
const departments = ref<HrDepartmentOption[]>([]),
  positions = ref<HrPositionRecord[]>([])
const blankProfile = (): HrEmployeeProfile => ({
  graduationSchool: null,
  major: null,
  regularSalary: null,
  probationSalary: null,
  probationPeriod: null,
  idNumber: null,
  contractEndDate: null,
  education: null,
  registeredAddress: null,
  householdType: null,
  residentialAddress: null,
  bankAccount: null,
  bankName: null,
  socialInsurance: null,
  emergencyContact: null,
  emergencyPhone: null,
})
const empty = (): HrEmployeeCommand => ({
  employeeName: '',
  departmentId: null,
  positionCode: '',
  jobGrade: null,
  employmentStatus: 'ACTIVE',
  mobile: null,
  email: null,
  entryDate: null,
  leaveDate: null,
  remark: null,
  revision: 0,
})
const form = reactive(empty()),
  profile = reactive(blankProfile()),
  entryDate = ref(''),
  leaveDate = ref('')
const identity = computed(() => identityDetails(profile.idNumber))
const tenure = computed(() =>
  serviceLength(entryDate.value, form.employmentStatus === 'LEFT' ? leaveDate.value : null),
)
type Node = HrDepartmentOption & { children: Node[]; disabled: boolean }
const departmentTree = computed(() => {
  const map = new Map(
    departments.value.map((d) => [
      d.id,
      { ...d, children: [] as Node[], disabled: d.statusCode !== 'ACTIVE' },
    ]),
  )
  const roots: Node[] = []
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
watch(
  () => form.positionCode,
  (code) => {
    if (
      !form.jobGrade &&
      positions.value.some((p) => p.positionCode === code && p.positionName === '业务员')
    )
      form.jobGrade = 'S1'
  },
)
watch(visible, async (open) => {
  if (!open) return
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  Object.assign(form, empty(), { departmentId: props.departmentId ?? null })
  Object.assign(profile, blankProfile())
  entryDate.value = ''
  leaveDate.value = ''
  try {
    const [deps, detail] = await Promise.all([
      hrOrganizationApi.employeeDepartments(),
      props.record ? getHrEmployee(props.record.id) : Promise.resolve(null),
    ])
    departments.value = deps
    positions.value = []
    let begin = 0
    while (true) {
      const page = await getHrPositions({
        begin,
        step: 200,
        statusCode: 'ACTIVE',
      })
      positions.value.push(...page.items)
      begin += page.items.length
      if (begin >= page.total || !page.items.length) break
    }
    if (detail) {
      Object.assign(form, {
        employeeName: detail.employeeName,
        departmentId: detail.departmentId,
        positionCode: detail.positionCode ?? '',
        jobGrade: detail.jobGrade ?? null,
        employmentStatus: detail.employmentStatus,
        mobile: detail.mobile,
        email: detail.email,
        remark: detail.remark,
        revision: detail.revision,
      })
      Object.assign(profile, detail.profile ?? blankProfile())
      entryDate.value = dateOnly(detail.entryDate)
      leaveDate.value = dateOnly(detail.leaveDate)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '员工资料加载失败'
  } finally {
    loading.value = false
  }
})
async function save() {
  if (saving.value || loading.value || loadError.value) return
  saveError.value = ''
  if (!form.employeeName.trim() || !form.departmentId || !form.positionCode) {
    saveError.value = '请填写姓名并选择部门和岗位'
    return
  }
  if (identity.value.error) {
    saveError.value = identity.value.error
    return
  }
  if (form.employmentStatus === 'LEFT' && !leaveDate.value) {
    saveError.value = '离职员工必须填写离职日期'
    return
  }
  if (form.employmentStatus === 'LEFT' && entryDate.value && leaveDate.value < entryDate.value) {
    saveError.value = '离职日期不能早于入职日期'
    return
  }
  try {
    if (props.record?.employmentStatus === 'ACTIVE' && form.employmentStatus !== 'ACTIVE')
      await ElMessageBox.confirm(
        '员工离职或停用后，关联业务账号将失去访问资格。',
        '确认员工状态变更',
        { type: 'warning' },
      )
    saving.value = true
    const normalized = Object.fromEntries(
      Object.entries(profile).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
    ) as unknown as HrEmployeeProfile
    await hrOrganizationApi.saveEmployee(props.record ? String(props.record.id) : null, {
      ...form,
      employeeName: form.employeeName.trim(),
      jobGrade: form.jobGrade?.trim() || null,
      entryDate: entryDate.value ? `${entryDate.value}T00:00:00+08:00` : null,
      leaveDate:
        form.employmentStatus === 'LEFT' && leaveDate.value
          ? `${leaveDate.value}T00:00:00+08:00`
          : null,
      profile: normalized,
    })
    visible.value = false
    emit('saved')
    ElMessage.success('员工档案已保存')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close')
      saveError.value = e instanceof Error ? e.message : '员工保存失败'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
:global(.employee-editor.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
  margin: 24px auto;
}
:global(.employee-editor .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
}
:global(.employee-editor .el-dialog__header),
:global(.employee-editor .el-dialog__footer) {
  flex-shrink: 0;
}
:global(.employee-editor .el-dialog__footer) {
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

h3 {
  font-size: 15px;
  margin: 4px 0 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}
.section-note {
  color: #64748b;
  margin: -6px 0 18px;
  font-size: 13px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 22px;
}
.full-row {
  grid-column: 1/-1;
}
.span-two {
  grid-column: span 2;
}
:deep(.el-select),
:deep(.el-tree-select),
:deep(.el-date-editor) {
  width: 100%;
}
@media (max-width: 700px) {
  .section-note {
    color: #64748b;
    margin: -6px 0 18px;
    font-size: 13px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-two {
    grid-column: auto;
  }
}
</style>
