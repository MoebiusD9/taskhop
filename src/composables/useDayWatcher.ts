import { onMounted, onUnmounted } from 'vue'
import { localDate } from '../lib/dates'

const TICK_MS = 30_000

/**
 * Calls `onChange` when the local date rolls over, or when the computer
 * appears to have woken from sleep (timers stop during sleep, so a tick that
 * arrives much later than scheduled means time jumped).
 */
export function useDayWatcher(onChange: () => void) {
  let day = localDate()
  let lastTick = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined

  function check() {
    const now = Date.now()
    const woke = now - lastTick > TICK_MS * 3
    lastTick = now
    const current = localDate()
    if (current !== day || woke) {
      day = current
      onChange()
    }
  }

  onMounted(() => {
    timer = setInterval(check, TICK_MS)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
  })

  onUnmounted(() => {
    clearInterval(timer)
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', check)
  })
}
