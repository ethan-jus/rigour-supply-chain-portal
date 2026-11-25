import { inject, shallowRef, type InjectionKey, type Ref } from 'vue'

export const workspaceMediaVisibilityKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('workspaceMediaVisibility')
const alwaysVisible = shallowRef(true)

export function useWorkspaceMediaVisibility() {
  return inject(workspaceMediaVisibilityKey, alwaysVisible)
}

const queue: Array<() => void> = []
let running = 0
const concurrentRequests = 2

function drain() {
  while (running < concurrentRequests && queue.length) queue.shift()!()
}

/** Limit automatic media transfers so they leave room for navigation and user actions. */
export function loadBackgroundMedia<T>(
  signal: AbortSignal,
  load: () => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    function cancelQueued() {
      const index = queue.indexOf(start)
      if (index !== -1) queue.splice(index, 1)
      reject(signal.reason)
    }
    function start() {
      signal.removeEventListener('abort', cancelQueued)
      running++
      void Promise.resolve()
        .then(() => {
          signal.throwIfAborted()
          return load()
        })
        .then(resolve, reject)
        .finally(() => {
          running--
          drain()
        })
    }
    signal.addEventListener('abort', cancelQueued, { once: true })
    queue.push(start)
    drain()
  })
}

