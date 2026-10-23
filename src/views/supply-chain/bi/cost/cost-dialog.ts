import type { ObjectDirective } from 'vue'
const cleanup = new WeakMap<HTMLElement, () => void>()
/** 原生分析弹层的焦点约束；多层详情关闭后回到触发按钮。 */
export const costDialog: ObjectDirective<HTMLElement> = {
  mounted(element) {
    const previous = document.activeElement as HTMLElement | null
    element.tabIndex = -1
    const controls = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      ).filter((el) => !el.closest('[hidden]'))
    const handle = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = controls(),
        first = items[0] || element,
        last = items.at(-1) || element
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    element.addEventListener('keydown', handle)
    ;(controls()[0] || element).focus()
    cleanup.set(element, () => {
      element.removeEventListener('keydown', handle)
      if (previous?.isConnected) previous.focus()
    })
  },
  unmounted(element) {
    cleanup.get(element)?.()
    cleanup.delete(element)
  },
}
