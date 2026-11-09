import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readDisplay, type DisplayPreferences } from '@/utils/display-preferences'

/** Session-only UI history; never stores credentials, filters or business records. */
export const useConsoleWorkspace = defineStore('console-workspace', () => {
  const navigationMode = ref(readDisplay().secondaryMenuMode)
  const compact = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 1100px)').matches
  const collapsed = ref(navigationMode.value === 'auto' || compact())
  function setNavigationMode(mode: DisplayPreferences['secondaryMenuMode']) {
    navigationMode.value = mode
    collapsed.value = mode === 'auto' || compact()
  }
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
    collapsed.value = navigationMode.value === 'auto' || compact()
  }
  return { collapsed, navigationMode, setNavigationMode, recent, visit, setSession }
})
