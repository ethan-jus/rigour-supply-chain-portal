import type { Directive } from 'vue'

const listeners = new WeakMap<HTMLElement, EventListener>()

/** 只响应用户把搜索文本删空；选中选项后的程序清空和失焦不能清掉已选条件。 */
export const vClearFilterOnEmptyInput: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const onInput: EventListener = (event) => {
      const input = event.target
      if (input instanceof HTMLInputElement && !(event as InputEvent).isComposing && input.value.trim() === '') {
        binding.value?.()
      }
    }
    listeners.set(el, onInput)
    el.addEventListener('input', onInput, true)
  },
  unmounted(el) {
    const listener = listeners.get(el)
    if (listener) el.removeEventListener('input', listener, true)
    listeners.delete(el)
  },
}
