<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  crmStoreContactsApi as api,
  type ContactView,
  type StoreContact,
  type ContactMethod,
} from '@/api/core/crm-store-contacts'
import { crmStoreApi, type StoreRow } from '@/api/core/crm-store'
import { auditActorLabel } from '@/utils/audit-actor'

const props = defineProps<{ storeId: string; view: ContactView; editable: boolean }>()
const contacts = ref<StoreContact[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref('')
const mode = ref(''),
  current = ref<StoreContact | null>(null),
  method = ref<ContactMethod | null>(null)
const name = ref(''),
  role = ref(''),
  phone = ref(''),
  wechat = ref(''),
  reason = ref('')
const primary = ref(false),
  status = ref('ACTIVE'),
  methodType = ref('PHONE'),
  value = ref('')
const methodStatus = ref('VERIFIED'),
  verification = ref('PHONE_CALL')
const sourceKeyword = ref(''),
  sourceStores = ref<StoreRow[]>([]),
  sourceId = ref('')
const sourceContacts = ref<StoreContact[]>([]),
  sourceContactId = ref('')
const history = ref<Awaited<ReturnType<typeof api.changes>>>([])
const requests = new Map<string, string>()
let generation = 0
const message = (e: unknown) => (e instanceof Error ? e.message : '操作失败，请重试')
function command(body: object) {
  const key = JSON.stringify([props.storeId, mode.value, current.value?.id, method.value?.id, body])
  if (!requests.has(key)) requests.set(key, crypto.randomUUID())
  return { ...body, requestId: requests.get(key)! }
}
async function load() {
  const version = ++generation
  loading.value = true
  error.value = ''
  contacts.value = []
  try {
    const result = await api.list(props.storeId, props.view)
    if (version === generation) contacts.value = result
  } catch (e) {
    if (version === generation) error.value = message(e)
  } finally {
    if (version === generation) loading.value = false
  }
}
function open(
  next: string,
  contact: StoreContact | null = null,
  channel: ContactMethod | null = null,
) {
  mode.value = next
  current.value = contact
  method.value = channel
  name.value = contact?.name ?? ''
  role.value = contact?.role ?? ''
  primary.value = contact?.primary ?? false
  status.value = contact?.status ?? 'ACTIVE'
  phone.value = ''
  wechat.value = ''
  reason.value = ''
  value.value = ''
  methodType.value = 'PHONE'
  methodStatus.value = 'VERIFIED'
  verification.value = 'PHONE_CALL'
  sourceKeyword.value = ''
  sourceId.value = ''
  sourceContactId.value = ''
  sourceContacts.value = []
  sourceStores.value = []
  history.value = []
}
async function save() {
  if (busy.value) return
  if (
    ['create', 'edit', 'link'].includes(mode.value) &&
    (!role.value.trim() || (mode.value !== 'link' && !name.value.trim()))
  ) {
    ElMessage.warning('请填写姓名或称呼与本店角色')
    return
  }
  if (mode.value === 'create' && !phone.value.trim()) {
    ElMessage.warning('正式联系人需要电话；未留资可直接记录拜访')
    return
  }
  if (mode.value !== 'create' && !reason.value.trim()) {
    ElMessage.warning('请填写依据或原因')
    return
  }
  busy.value = true
  try {
    const person = current.value
    if (mode.value === 'create')
      await api.create(
        props.storeId,
        props.view,
        command({
          name: name.value.trim(),
          role: role.value.trim(),
          primary: primary.value,
          phone: phone.value.trim(),
          wechatHint: wechat.value.trim(),
        }),
      )
    else if (mode.value === 'edit' && person)
      await api.update(
        props.storeId,
        props.view,
        person.id,
        command({
          name: name.value.trim(),
          role: role.value.trim(),
          primary: status.value === 'ACTIVE' && primary.value,
          status: status.value,
          revision: person.revision,
          personRevision: person.personRevision,
          reason: reason.value.trim(),
        }),
      )
    else if (mode.value === 'method' && person)
      await api.addMethod(
        props.storeId,
        props.view,
        person.id,
        command({ type: methodType.value, value: value.value.trim(), reason: reason.value.trim() }),
      )
    else if (mode.value === 'verify' && person && method.value)
      await api.verify(
        props.storeId,
        props.view,
        person.id,
        method.value.id,
        command({
          revision: method.value.revision,
          status: methodStatus.value,
          verificationMethod: verification.value,
          reason: reason.value.trim(),
        }),
      )
    else if (mode.value === 'link') {
      if (!sourceId.value || !sourceContactId.value)
        throw new Error('请选择已核实的来源门店及联系人')
      await api.link(
        props.storeId,
        props.view,
        command({
          sourceStoreId: sourceId.value,
          contactId: sourceContactId.value,
          role: role.value.trim(),
          primary: primary.value,
          reason: reason.value.trim(),
        }),
      )
    }
    mode.value = ''
    requests.clear()
    await load()
    ElMessage.success('联系人已保存')
  } catch (e) {
    ElMessage.error(message(e))
  } finally {
    busy.value = false
  }
}
async function searchSources() {
  try {
    const result = await crmStoreApi.list({
      view: props.view,
      keyword: sourceKeyword.value.trim(),
      size: 30,
    })
    sourceStores.value = result.items.filter((s) => s.id !== props.storeId)
  } catch (e) {
    ElMessage.error(message(e))
  }
}
async function selectSource(id: string) {
  sourceContactId.value = ''
  sourceContacts.value = []
  try {
    const result = await api.list(id, props.view)
    if (sourceId.value === id) sourceContacts.value = result.filter((c) => c.status === 'ACTIVE')
  } catch (e) {
    ElMessage.error(message(e))
  }
}
async function showHistory(person: StoreContact) {
  open('history', person)
  const version = generation
  try {
    const result = await api.changes(props.storeId, props.view, person.id)
    if (version === generation && current.value?.id === person.id) history.value = result
  } catch (e) {
    ElMessage.error(message(e))
  }
}
watch(
  () => [props.storeId, props.view],
  () => {
    mode.value = ''
    requests.clear()
    load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <section v-loading="loading" class="store-contacts">
    <div class="contact-toolbar">
      <span>联系人及联系方式</span
      ><el-button v-if="editable" type="primary" @click="open('create')">新增联系人</el-button>
    </div>
    <p class="hint">
      角色、主要联系人及离职状态按门店维护；姓名和联系方式属于本人。电话保存后待核实，微信线索不代表企微已建联。
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-button
      v-if="error"
      @click="load"
      >重新加载</el-button
    >
    <el-empty v-else-if="!loading && !contacts.length" description="尚未登记联系人" />
    <article v-for="person in contacts" :key="person.id" class="contact">
      <div class="contact-toolbar">
        <strong>{{ person.name }} · {{ person.role }}</strong
        ><span
          ><el-tag v-if="person.primary">主要联系人</el-tag
          ><el-tag v-if="person.status === 'LEFT'" type="info">离职 / 关系失效</el-tag></span
        >
      </div>
      <div v-for="channel in person.methods" :key="channel.id" class="contact-channel">
        <span
          >{{ channel.type === 'PHONE' ? '电话' : '微信线索' }} {{ channel.value
          }}<small>{{
            channel.status === 'VERIFIED'
              ? '已核验'
              : channel.status === 'INVALID'
                ? '已失效'
                : channel.type === 'PHONE'
                  ? '待核实'
                  : '未确认建联'
          }}</small></span
        >
        <el-button
          v-if="editable && person.status === 'ACTIVE' && channel.type === 'PHONE'"
          link
          type="primary"
          @click="open('verify', person, channel)"
          >核验 / 标记失效</el-button
        >
      </div>
      <div class="contact-actions">
        <el-button v-if="editable" link type="primary" @click="open('edit', person)"
          >编辑关系</el-button
        ><el-button
          v-if="editable && person.status === 'ACTIVE'"
          link
          type="primary"
          @click="open('method', person)"
          >补联系方式</el-button
        ><el-button link @click="showHistory(person)">变更记录</el-button>
      </div>
    </article>
    <el-button v-if="editable && !error" @click="open('link')">关联其他授权门店的联系人</el-button>
    <el-dialog
      :model-value="!!mode"
      :title="
        (
          {
            create: '新增联系人',
            edit: '编辑联系人与门店关系',
            method: '补充联系方式',
            verify: '核验电话',
            link: '关联已有联系人',
            history: '变更记录',
          } as Record<string, string>
        )[mode]
      "
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
      :show-close="!busy"
      :close-on-press-escape="!busy"
      @update:model-value="!$event && (mode = '')"
    >
      <el-form label-position="top" :disabled="busy" @submit.prevent="save">
        <template v-if="mode === 'link'">
          <el-form-item label="来源门店"
            ><el-input
              v-model="sourceKeyword"
              placeholder="输入门店名称"
              @keyup.enter="searchSources"
              ><template #append
                ><el-button @click="searchSources">查询</el-button></template
              ></el-input
            ></el-form-item
          >
          <el-form-item label="选择门店" required
            ><el-select v-model="sourceId" @change="selectSource"
              ><el-option
                v-for="store in sourceStores"
                :key="store.id"
                :value="store.id"
                :label="`${store.name} · ${store.address}`" /></el-select
          ></el-form-item>
          <el-form-item label="选择联系人" required
            ><el-select v-model="sourceContactId"
              ><el-option
                v-for="person in sourceContacts"
                :key="person.id"
                :value="person.id"
                :label="`${person.name} · ${person.role}`" /></el-select
          ></el-form-item>
        </template>
        <el-form-item v-if="['create', 'edit'].includes(mode)" label="姓名 / 称呼" required
          ><el-input v-model="name" maxlength="100" aria-label="姓名或称呼"
        /></el-form-item>
        <el-form-item v-if="['create', 'edit', 'link'].includes(mode)" label="本店角色" required
          ><el-input
            v-model="role"
            maxlength="50"
            placeholder="老板、店长、前台等"
            aria-label="本店角色"
        /></el-form-item>
        <el-form-item v-if="mode === 'create'" label="电话" required
          ><el-input
            v-model="phone"
            maxlength="50"
            placeholder="手机或含区号的座机"
            aria-label="电话"
        /></el-form-item>
        <el-form-item v-if="mode === 'create'" label="微信线索"
          ><el-input v-model="wechat" maxlength="200" placeholder="选填，不算已建联"
        /></el-form-item>
        <el-form-item v-if="['create', 'edit', 'link'].includes(mode)"
          ><el-checkbox v-model="primary">设为本店主要联系人</el-checkbox></el-form-item
        >
        <el-form-item v-if="mode === 'edit'" label="本店关系"
          ><el-radio-group v-model="status"
            ><el-radio value="ACTIVE">有效</el-radio
            ><el-radio value="LEFT">离职 / 关系失效</el-radio></el-radio-group
          ></el-form-item
        >
        <template v-if="mode === 'method'"
          ><el-form-item label="类型"
            ><el-radio-group v-model="methodType"
              ><el-radio value="PHONE">电话</el-radio
              ><el-radio value="WECHAT_HINT">微信线索</el-radio></el-radio-group
            ></el-form-item
          ><el-form-item label="联系方式" required
            ><el-input v-model="value" maxlength="200" /></el-form-item
        ></template>
        <template v-if="mode === 'verify'"
          ><p>{{ method?.value }}</p>
          <el-form-item label="核验状态"
            ><el-radio-group v-model="methodStatus"
              ><el-radio value="VERIFIED">已确认可用</el-radio
              ><el-radio value="INVALID">已失效</el-radio
              ><el-radio value="PENDING">待核实</el-radio></el-radio-group
            ></el-form-item
          ><el-form-item v-if="methodStatus === 'VERIFIED'" label="核验方式"
            ><el-radio-group v-model="verification"
              ><el-radio value="PHONE_CALL">已拨通</el-radio
              ><el-radio value="ON_SITE">现场确认</el-radio></el-radio-group
            ></el-form-item
          ></template
        >
        <el-form-item v-if="!['create', 'history'].includes(mode)" label="依据 / 原因" required
          ><el-input v-model="reason" type="textarea" maxlength="500" :rows="3"
        /></el-form-item>
        <template v-if="mode === 'history'"
          ><p v-for="entry in history" :key="entry.id">
            {{ new Date(entry.occurredAt).toLocaleString('zh-CN') }} ·
            {{ auditActorLabel(entry.actorUserId) }} · {{ entry.reason }}
          </p>
          <el-empty v-if="!history.length" description="暂无变更记录"
        /></template>
      </el-form>
      <template #footer
        ><el-button :disabled="busy" @click="mode = ''">{{
          mode === 'history' ? '关闭' : '取消'
        }}</el-button
        ><el-button v-if="mode !== 'history'" type="primary" :loading="busy" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>

<style scoped>
.contact-toolbar,
.contact-channel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.hint,
small {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
small {
  display: block;
}
.contact {
  padding: 18px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.contact-channel {
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.contact-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.el-tag + .el-tag {
  margin-left: 6px;
}
</style>
