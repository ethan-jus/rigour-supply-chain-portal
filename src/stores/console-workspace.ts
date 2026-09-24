import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Session-only UI history; never stores credentials, filters or business records. */
export const useConsoleWorkspace = defineStore('console-workspace', () => {
  const collapsed = ref(false)
  const recent = ref<{ path: string; visitedAt: string }[]>([])
  const session = ref('')
  function visit(path: string) {
    if (path === '/supply-chain') return
    recent.value = [
      { path, visitedAt: new Date().toISOString() },
      ...recent.value.filter((item) => item.path !== path),
    ].slice(0, 6)
  }
  function setSession(key: string) {
    if (session.value === key) return
    session.value = key
    recent.value = []
    collapsed.value =
      typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 760px)').matches
  }
  return { collapsed, recent, visit, setSession }
})
