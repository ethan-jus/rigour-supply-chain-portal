import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)

  const breadcrumbs = computed(() => {
    try {
      const route = useRoute()
      return route.matched
        .filter((r) => r.meta?.title)
        .map((r) => ({
          path: r.path,
          title: r.meta?.title as string,
        }))
    } catch {
      return []
    }
  })

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(collapsed: boolean): void {
    sidebarCollapsed.value = collapsed
  }

  return {
    sidebarCollapsed,
    breadcrumbs,
    toggleSidebar,
    setSidebarCollapsed,
  }
})
