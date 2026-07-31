import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { PortalApplication } from '@/types/application'

/** “我的应用”只保存IAM返回的授权卡片，不根据角色或前端常量扩权。 */
export const useApplicationStore = defineStore('application', () => {
  const applications = ref<PortalApplication[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref('')

  async function fetchApplications() {
    loading.value = true
    error.value = ''
    try {
      applications.value = (await apiClient.get('/portal/apps')) as PortalApplication[]
      loaded.value = true
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : '应用目录加载失败'
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
