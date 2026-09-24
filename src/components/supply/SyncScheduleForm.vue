<template>
  <el-form class="schedule-form" label-position="top" @submit.prevent="submit">
    <el-form-item label="执行方式">
      <el-radio-group v-model="form.mode" :disabled="!editable || saving" aria-label="执行方式">
        <el-radio-button value="FIXED_DELAY">完成后间隔</el-radio-button>
        <el-radio-button value="DAILY">每天定点</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item v-if="form.mode === 'FIXED_DELAY'" label="间隔时间">
      <el-input-number
        v-model="form.intervalMinutes"
        :disabled="!editable || saving"
        :min="5"
        :max="1440"
        :precision="0"
        controls-position="right"
        aria-label="间隔分钟"
      />
      <span class="unit">分钟</span>
    </el-form-item>
    <el-form-item v-else label="每天执行时间">
      <el-input
        v-model="form.dailyTime"
        type="time"
        :disabled="!editable || saving"
        aria-label="每天执行时间"
      />
    </el-form-item>
    <el-form-item label="时区"><div class="zone">北京时间 Asia/Shanghai</div></el-form-item>
    <el-form-item label="任务状态" class="task-status">
      <el-switch v-model="form.enabled" :disabled="!editable || saving" aria-label="启用定时计划" />
      <span class="unit">{{ form.enabled ? '启用定时计划' : '未启用' }}</span>
    </el-form-item>
    <p class="form-hint">
      {{
        form.enabled
          ? '保存后按新计划执行，不会立即触发同步。停用不取消正在执行的任务。'
          : '保存为停用配置，后台不会自动执行。'
      }}
    </p>
    <p v-if="!editable" class="form-hint">当前账号仅可查看，请联系有配置权限的管理员。</p>
    <div class="form-actions">
      <el-button
        type="primary"
        native-type="submit"
        :loading="saving"
        :disabled="!editable || !valid"
        >{{
          form.enabled ? '保存配置' : (inactiveLabel ?? (plan.managed ? '保存并停用' : '保存草稿'))
        }}</el-button
      >
      <el-button :disabled="saving" @click="reset">取消</el-button>
    </div>
  </el-form>
</template>
<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ScheduleSettings, ScheduleView } from '@/api/core/sync-schedule'
const props = defineProps<{
  plan: ScheduleView
  editable: boolean
  saving: boolean
  inactiveLabel?: string
}>()
const emit = defineEmits<{ save: [settings: ScheduleSettings]; cancel: [] }>()
const form = reactive({
  enabled: false,
  mode: 'FIXED_DELAY' as ScheduleSettings['mode'],
  intervalMinutes: 60 as number | undefined,
  dailyTime: '02:00',
})
function restore() {
  Object.assign(form, props.plan.settings, {
    intervalMinutes: props.plan.settings.intervalMinutes ?? 60,
    dailyTime: props.plan.settings.dailyTime ?? '02:00',
  })
}
watch(() => props.plan, restore, { immediate: true })
const valid = computed(() =>
  form.mode === 'DAILY'
    ? /^([01]\d|2[0-3]):[0-5]\d$/.test(form.dailyTime)
    : Number.isInteger(form.intervalMinutes) &&
      Number(form.intervalMinutes) >= 5 &&
      Number(form.intervalMinutes) <= 1440,
)
function reset() {
  restore()
  emit('cancel')
}
function submit() {
  if (!props.editable || props.saving || !valid.value) return
  emit('save', {
    enabled: form.enabled,
    mode: form.mode,
    intervalMinutes: form.mode === 'FIXED_DELAY' ? Number(form.intervalMinutes) : null,
    dailyTime: form.mode === 'DAILY' ? form.dailyTime : null,
  })
}
</script>
<style scoped lang="scss">
.schedule-form {
  --el-component-size: 40px;
}
.schedule-form :deep(.el-form-item__label) {
  color: #334155;
  font-size: 14px;
  margin-bottom: 10px;
}
.schedule-form :deep(.el-radio-group) {
  display: flex;
  width: 100%;
}
.schedule-form :deep(.el-radio-button) {
  flex: 1;
}
.schedule-form :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 12px;
}
.schedule-form :deep(.el-input-number) {
  flex: 1;
  width: auto;
}
.zone {
  width: 100%;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #334155;
  line-height: 40px;
  background: #f8fafc;
}
.unit {
  margin-left: 12px;
  font-size: 14px;
  color: #64748b;
}
.form-hint {
  color: #64748b;
  font-size: 12px;
  line-height: 1.65;
}
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.schedule-form :deep(.task-status) {
  display: flex;
  align-items: center;
  gap: 20px;
}
.schedule-form :deep(.task-status .el-form-item__label) {
  margin: 0;
}
.schedule-form :deep(.task-status .el-form-item__content) {
  flex: 1;
}
.schedule-form :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: #eff6ff;
  color: #2563eb;
}
.form-actions .el-button {
  height: 44px;
  flex: 1;
  margin: 0;
}
</style>
