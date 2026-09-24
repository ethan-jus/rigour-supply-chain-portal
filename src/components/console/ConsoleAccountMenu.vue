<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
    <button class="account" type="button" aria-label="账号菜单">
      <span class="account__avatar"><UserFilled /></span>
      <span class="account__name">{{ auth.user?.displayName || '当前用户' }}</span>
      <ArrowDown class="account__arrow" />
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="password" :icon="Lock">修改密码</el-dropdown-item>
        <el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  <el-dialog
    v-model="passwordVisible" title="修改密码" width="440px" align-center
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving"
    destroy-on-close @closed="clearForm"
  >
    <el-alert v-if="failure" :title="failure" type="error" show-icon :closable="false" class="password-feedback" />
    <el-form label-position="top" @submit.prevent="savePassword">
      <el-form-item label="原密码" required>
        <el-input v-model="form.currentPassword" type="password" show-password autocomplete="current-password" :maxlength="128" :disabled="saving" />
      </el-form-item>
      <el-form-item label="新密码" required>
        <el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" :maxlength="12" :disabled="saving" />
        <div class="password-hint">{{ MEMBER_PASSWORD_HINT }}</div>
      </el-form-item>
      <el-form-item label="确认新密码" required>
        <el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" :maxlength="12" :disabled="saving" @keyup.enter="savePassword" />
      </el-form-item>
      <p class="password-hint">修改成功后，所有设备需使用新密码重新登录。</p>
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="passwordVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="savePassword">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ArrowDown, Lock, SwitchButton, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/core'
import { errorMessage } from '@/api/core/error'
import { MEMBER_PASSWORD_HINT, memberPasswordError } from '@/utils/member-password'

const auth = useAuthStore()
const passwordVisible = ref(false)
const saving = ref(false)
const failure = ref('')
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

function clearForm() {
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  failure.value = ''
}

function handleCommand(command: string) {
  if (command === 'logout') void auth.logout()
  if (command === 'password') {
    clearForm()
    passwordVisible.value = true
  }
}

async function savePassword() {
  if (saving.value) return
  failure.value = !form.currentPassword ? '请输入原密码'
    : memberPasswordError(form.newPassword)
      || (form.newPassword === form.currentPassword ? '新密码不能与原密码相同' : '')
      || (form.newPassword !== form.confirmPassword ? '两次输入的新密码不一致' : '')
  if (failure.value) return
  saving.value = true
  try {
    await apiClient.post('/scdp/password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    })
    // 服务端已经撤销所有登录会话，无需再依赖旧凭据调用退出接口。
    clearForm()
    passwordVisible.value = false
    auth.clearLocalSession()
    ElMessage.success('密码修改成功，请使用新密码重新登录')
    window.location.hash = '/login?reason=password_changed'
  } catch (error) {
    failure.value = errorMessage(error, '密码修改失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.account {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border: 0; border-radius: 8px; background: transparent; color: $color-text-primary;
  font: inherit; cursor: pointer;
  &:hover { background: $color-bg-muted; }
  &:focus-visible { outline: 2px solid $color-primary; outline-offset: 2px; }
  &__avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #e9f1ff; color: $color-primary; }
  &__avatar svg { width: 22px; height: 22px; }
  &__name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: $font-size-sm; font-weight: 500; }
  &__arrow { width: 12px; height: 12px; color: $color-text-secondary; }
}
.password-feedback { margin-bottom: 16px; }
.password-hint { margin: 6px 0 0; color: $color-text-secondary; font-size: 12px; line-height: 1.6; }
@media (max-width: 1100px) { .account__name { display: none; } }
</style>
