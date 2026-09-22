import type { Directive } from 'vue'

/**
 * filterable 下拉的「清空搜索文字 = 清掉条件」。
 *
 * Element Plus 的 filterable 下拉在选中后，把输入框里的搜索文字删掉时只清显示、
 * 不清已选值，用户看到「查询框是空的」但查询仍带旧条件。这里只在本次聚焦里
 * 手动输入过搜索词、且失焦时输入框为空的情况下清值，正常选中值不受影响。
 */
export const vClearFilterOnEmptyInput: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    let typedDuringFocus = false
    const onKeydown = (event: Event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Backspace' || key === 'Delete' || (key.length === 1 && key !== ' ')) {
        typedDuringFocus = true
      }
    }
    const onFocusOut = () => {
      const shouldClear = typedDuringFocus
      typedDuringFocus = false
      if (!shouldClear) return
      const input = el.querySelector('input')
      if (input && input.value.trim() === '') binding.value?.()
    }
    el.addEventListener('keydown', onKeydown, true)
    el.addEventListener('focusout', onFocusOut, true)
    el.dataset.filterSelectClear = 'true'
  },
  unmounted(el) {
    delete el.dataset.filterSelectClear
  },
}
