import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { PortalApplication } from '@/types/application'
import { devInfo, devWarn } from '@/utils/dev-log'

/** “我的应用”只保存IAM返回的授权卡片，不根据角色或前端常量扩权。 */
export const useApplicationStore = defineStore('application', () => {
  const applications = ref<PortalApplication[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref('')

  async function fetchApplications() {
    loading.value = true
    error.value = ''
    devInfo('开始加载门户应用卡片')
    try {
      applications.value = (await apiClient.get('/portal/apps')) as PortalApplication[]
      loaded.value = true
      devInfo('门户应用卡片加载成功', {
        count: applications.value.length,
        codes: applications.value.map((application) => application.code),
      })
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : '应用目录加载失败'
      devWarn('门户应用卡片加载失败', { message: reason instanceof Error ? reason.message : reason })
      throw reason
    } finally {
      loading.value = false
    }
  }

  function reset() {
    applications.value = []
    loaded.value = false
    loading.value = false
    error.value = ''
  }

  return { applications, loaded, loading, error, fetchApplications, reset }
})
