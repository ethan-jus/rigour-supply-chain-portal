<template>
  <el-dialog
    :model-value="true"
    title="维护经营状态"
    width="min(520px, calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="!$event && !saving && emit('close')"
  >
    <p class="store-name">{{ store.name }}</p>
    <el-form label-position="top" :disabled="saving" @submit.prevent="save">
      <el-form-item label="核实后的经营状态" required>
        <el-select v-model="status" aria-label="门店经营状态" placeholder="选择经营状态">
          <el-option
            v-for="item in options"
            :key="item.dictionaryItemCode"
            :value="item.dictionaryItemCode"
            :label="item.dictionaryItemName"
          />
        </el-select>
      </el-form-item>
      <p v-if="!options.length" class="error" role="alert">经营状态字典未加载，请关闭后重试。</p>
      <el-alert
        v-if="status === 'CLOSED'"
        title="确认已停业后结束当前归属，停止认领与新作业；门店档案、拜访和成交历史保留。恢复营业由管理员核实。停业标记不计有效拜访，未完成拜访需另行处理。"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-alert
        v-else-if="status === 'TEMP_CLOSED'"
        title="暂时停业保留当前归属，暂停新拜访和开单；保护期限仍按原规则计算。"
        type="info"
        :closable="false"
      />
      <el-alert
        v-else-if="store.businessStatus === 'CLOSED' && status === 'OPEN'"
        title="恢复营业后进入可认领公海；历史归属不会自动恢复。"
        type="info"
        :closable="false"
      />
      <el-form-item label="核实依据" required class="reason">
        <el-input
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          aria-label="经营状态核实依据"
          placeholder="例如：现场核实已撤店；电话确认装修暂停至某日"
        />
      </el-form-item>
    </el-form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <template #footer
      ><el-button :disabled="saving" @click="emit('close')">取消</el-button
      ><el-button
        type="primary"
        :loading="saving"
        :disabled="!options.length || status === store.businessStatus || !reason.trim()"
        @click="save"
        >确认并留痕</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { crmStoreApi, type StoreRow } from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
const props = defineProps<{ store: StoreRow; statuses: DictItemView[]; management: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const status = ref(props.store.businessStatus),
  reason = ref(''),
  saving = ref(false),
  error = ref(''),
  requestId = crypto.randomUUID()
const options = computed(() =>
  props.statuses.filter(
    (item) =>
      item.enabled !== false &&
      ['UNKNOWN', 'OPEN', 'TEMP_CLOSED', 'CLOSED'].includes(item.dictionaryItemCode) &&
      (props.management || item.dictionaryItemCode !== 'UNKNOWN'),
  ),
)
async function save() {
  if (
    saving.value ||
    !reason.value.trim() ||
    !options.value.some((item) => item.dictionaryItemCode === status.value) ||
    status.value === props.store.businessStatus
  )
    return
  saving.value = true
  error.value = ''
  try {
    await crmStoreApi.businessStatus(
      props.store,
      status.value,
      reason.value.trim(),
      props.management,
      requestId,
    )
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '状态保存失败，请重试'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.store-name {
  margin: 0 0 16px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}
.el-select {
  width: 100%;
}
.reason {
  margin-top: 16px;
}
.error {
  color: var(--el-color-danger);
  line-height: 1.6;
}
</style>
