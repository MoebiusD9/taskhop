<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import TitleBar from './components/TitleBar.vue'
import QuickAdd from './components/QuickAdd.vue'
import TabBar from './components/TabBar.vue'
import TaskList from './components/TaskList.vue'
import SettingsView from './components/SettingsView.vue'
import { useDayWatcher } from './composables/useDayWatcher'
import { useSettingsStore } from './stores/settings'
import { useTaskStore } from './stores/tasks'
import { formatShortDate } from './lib/dates'
import { loadHistory } from './lib/history'
import type { ListName, ParsedTask } from './types'

type View = 'tasks' | 'settings'

const store = useTaskStore()
const settings = useSettingsStore()
const view = ref<View>('tasks')
const activeList = ref<ListName>('today')
const quickAdd = ref<InstanceType<typeof QuickAdd>>()
/** Number of AI requests in flight (you can keep adding while one runs). */
const aiPending = ref(0)

let unlisten: UnlistenFn | undefined

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKey)
  // The tray's "Settings" item emits this event from Rust.
  unlisten = await listen('open-settings', () => {
    view.value = 'settings'
  })
  await settings.init()
  await store.refresh()
  quickAdd.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKey)
  unlisten?.()
})

// Recompute Today/Tomorrow/Skipped when the date rolls over or the PC wakes up.
useDayWatcher(() => store.refresh())

function toggleSettings() {
  view.value = view.value === 'settings' ? 'tasks' : 'settings'
}

async function addTask(text: string) {
  const fromList = activeList.value
  // Tasks added from the Tomorrow tab go to tomorrow; everything else to today.
  const defaultDate = fromList === 'tomorrow' ? store.tomorrow : store.today
  let title = text
  let date = defaultDate

  if (settings.aiQuickAdd && settings.hasKey) {
    aiPending.value++
    try {
      // Past task titles go along only if the user opted in to "Use my task history".
      const history = settings.useHistory ? await loadHistory(text) : null
      const parsed = await invoke<ParsedTask>('parse_task', { text, defaultDate, history })
      title = parsed.title
      date = parsed.scheduled_date
    } catch (err) {
      // No key, offline, timeout or an invalid reply: add the text exactly as typed.
      console.warn('AI quick add fell back to plain text:', err)
    } finally {
      aiPending.value--
    }
  }

  await store.add(title, date)
  showWhereItLanded(title, date, fromList)
}

/** A suggestion was picked: it already has a title and date, so no AI call. */
async function addSuggestion(task: ParsedTask) {
  const fromList = activeList.value
  await store.add(task.title, task.scheduled_date)
  showWhereItLanded(task.title, task.scheduled_date, fromList)
}

/** Tells the user when a task didn't land in the tab they're looking at. */
function showWhereItLanded(title: string, date: string, fromList: ListName) {
  const landed: ListName | null =
    date === store.today ? 'today' : date === store.tomorrow ? 'tomorrow' : null
  if (landed === null) {
    showNotice(`“${title}” is scheduled for ${formatShortDate(date)}. It will appear in Today that day.`)
  } else if (fromList === 'skipped') {
    activeList.value = landed
  } else if (landed !== fromList) {
    showNotice(`Added “${title}” to ${landed === 'today' ? 'Today' : 'Tomorrow'}.`)
  }
}

const notice = ref<string | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function showNotice(message: string) {
  clearTimeout(noticeTimer)
  notice.value = message
  noticeTimer = setTimeout(() => (notice.value = null), 5000)
}

// Ctrl/Cmd+1..3 switch tabs; Ctrl/Cmd+N or "/" jumps to the quick-add input.
const tabKeys: Record<string, ListName> = { '1': 'today', '2': 'tomorrow', '3': 'skipped' }

function onGlobalKey(e: KeyboardEvent) {
  if (view.value === 'settings') {
    if (e.key === 'Escape') view.value = 'tasks'
    return
  }
  const mod = e.ctrlKey || e.metaKey
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if (mod && tabKeys[e.key]) {
    e.preventDefault()
    activeList.value = tabKeys[e.key]
  } else if ((mod && e.key.toLowerCase() === 'n') || (e.key === '/' && !typing)) {
    e.preventDefault()
    quickAdd.value?.focus()
  }
}

// "Task deleted · Undo" bar, hidden after a few seconds.
let undoTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => store.lastDeleted,
  (task) => {
    clearTimeout(undoTimer)
    if (task) undoTimer = setTimeout(() => (store.lastDeleted = null), 6000)
  },
)
</script>

<template>
  <div class="flex h-full flex-col bg-paper text-ink">
    <TitleBar :settings-open="view === 'settings'" @toggle-settings="toggleSettings" />

    <template v-if="view === 'tasks'">
      <QuickAdd
        ref="quickAdd"
        :target="activeList === 'tomorrow' ? 'tomorrow' : 'today'"
        :busy="aiPending > 0"
        @add="addTask"
        @pick="addSuggestion"
      />
      <TabBar v-model="activeList" :counts="store.counts" />

      <div v-auto-animate="{ duration: 150 }">
        <p
          v-if="store.error"
          role="alert"
          class="mx-3 mt-2 rounded-md bg-hop/10 px-3 py-2 text-xs text-hop"
        >
          {{ store.error }}
        </p>
      </div>

      <main class="flex-1 overflow-y-auto">
        <!-- Keyed by tab so switching tabs swaps the list instantly instead of animating every row. -->
        <TaskList v-if="store.ready" :key="activeList" :list="activeList" @focus-input="quickAdd?.focus()" />
      </main>

      <div v-auto-animate="{ duration: 150 }" role="status" class="flex flex-col gap-1.5 p-2 empty:hidden">
        <p
          v-if="notice"
          key="notice"
          class="rounded-md bg-wash px-3 py-2 text-xs text-ink"
        >
          {{ notice }}
        </p>
        <div
          v-if="store.lastDeleted"
          key="undo"
          class="flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2 text-xs text-paper"
        >
          <span class="truncate">Deleted “{{ store.lastDeleted.title }}”</span>
          <button
            type="button"
            class="shrink-0 rounded px-1.5 py-0.5 font-semibold text-paper hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-paper"
            @click="store.undoDelete()"
          >
            Undo
          </button>
        </div>
      </div>
    </template>

    <SettingsView v-else @close="view = 'tasks'" />
  </div>
</template>
