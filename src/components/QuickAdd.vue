<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { loadHistory } from '../lib/history'
import { formatShortDate } from '../lib/dates'
import { useSettingsStore } from '../stores/settings'
import { useTaskStore } from '../stores/tasks'
import type { ParsedTask } from '../types'

defineProps<{ target: string; busy?: boolean }>()
const emit = defineEmits<{
  /** Plain text typed and submitted with Enter. */
  add: [text: string]
  /** A suggestion the user picked; already has a title and date. */
  pick: [task: ParsedTask]
}>()

const settings = useSettingsStore()
const tasks = useTaskStore()

const text = ref('')
const input = ref<HTMLInputElement>()

// ---- Suggestions while typing ------------------------------------------------
// Only with AI quick add, a saved key and "Use my task history" all on.

const DEBOUNCE_MS = 600
const MIN_CHARS = 3
const RATE_LIMIT_PAUSE_MS = 60_000

const suggestions = ref<ParsedTask[]>([])
/** Highlighted suggestion, or -1 for none. */
const active = ref(-1)
const open = computed(() => suggestions.value.length > 0)
const enabled = computed(() => settings.aiQuickAdd && settings.hasKey && settings.useHistory)

let debounce: ReturnType<typeof setTimeout> | undefined
let inFlight = false
/** Text typed while a request was running; fetched as soon as it finishes. */
let queued: string | null = null
let pausedUntil = 0

function closeSuggestions() {
  clearTimeout(debounce)
  suggestions.value = []
  active.value = -1
}

watch(text, (value) => {
  closeSuggestions()
  const query = value.trim()
  if (!enabled.value || query.length < MIN_CHARS || Date.now() < pausedUntil) return
  debounce = setTimeout(() => fetchSuggestions(query), DEBOUNCE_MS)
})

async function fetchSuggestions(query: string) {
  // One request at a time; remember the latest text and fetch it afterwards.
  if (inFlight) {
    queued = query
    return
  }
  inFlight = true
  try {
    const history = await loadHistory(query)
    const result = await invoke<ParsedTask[]>('suggest_tasks', { partial: query, history })
    // Ignore replies for text the user has already changed.
    if (text.value.trim() === query) {
      suggestions.value = result
      active.value = -1
    }
  } catch (err) {
    // Free-tier rate limit: stop asking for a minute. Other errors: just no suggestions.
    if (String(err).includes('429')) pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS
    console.warn('No suggestions:', err)
  } finally {
    inFlight = false
    const next = queued
    queued = null
    if (next && next === text.value.trim()) fetchSuggestions(next)
  }
}

onUnmounted(() => clearTimeout(debounce))

function pick(index: number) {
  const task = suggestions.value[index]
  if (!task) return
  emit('pick', task)
  text.value = ''
  closeSuggestions()
}

function submit() {
  if (active.value >= 0) return pick(active.value)
  const value = text.value.trim()
  if (!value) return
  emit('add', value)
  text.value = ''
  closeSuggestions()
}

function onKeydown(e: KeyboardEvent) {
  const count = suggestions.value.length
  if (e.key === 'Escape') {
    e.preventDefault()
    if (open.value) closeSuggestions()
    else text.value = ''
  } else if (!open.value) {
    return
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % count
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = active.value <= 0 ? count - 1 : active.value - 1
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    pick(Math.max(active.value, 0))
  }
}

function dateLabel(date: string) {
  if (date === tasks.today) return 'Today'
  if (date === tasks.tomorrow) return 'Tomorrow'
  return formatShortDate(date)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <form class="px-3 pt-3" @submit.prevent="submit">
    <label for="quick-add" class="sr-only">Add a task</label>
    <div class="relative">
      <input
        id="quick-add"
        ref="input"
        v-model="text"
        type="text"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="quick-add-suggestions"
        :aria-expanded="open"
        :aria-activedescendant="active >= 0 ? `suggestion-${active}` : undefined"
        :placeholder="`Add a task for ${target}…`"
        :aria-busy="busy"
        class="w-full rounded-md border border-line-strong bg-field py-2 pr-8 pl-3 text-sm placeholder:text-ink-3
               focus:border-hop focus:outline-2 focus:outline-hop/30"
        @keydown="onKeydown"
        @blur="closeSuggestions"
      />
      <!-- Shown while AI is reading a task; you can keep typing the next one. -->
      <span v-auto-animate="{ duration: 150 }" class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <svg
          v-if="busy"
          viewBox="0 0 24 24"
          class="size-4 animate-spin text-hop motion-reduce:animate-none"
          fill="none"
          role="img"
          aria-label="Adding task with AI"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
      </span>

      <ul
        id="quick-add-suggestions"
        v-auto-animate="{ duration: 150 }"
        role="listbox"
        aria-label="Suggestions"
        class="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-paper shadow-lg
               empty:hidden"
      >
        <li
          v-for="(s, i) in suggestions"
          :id="`suggestion-${i}`"
          :key="s.title + s.scheduled_date"
          role="option"
          :aria-selected="i === active"
          class="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm"
          :class="i === active ? 'bg-wash' : 'hover:bg-wash'"
          @mousedown.prevent="pick(i)"
          @mouseenter="active = i"
        >
          <span class="truncate">{{ s.title }}</span>
          <span class="shrink-0 text-xs text-ink-2">{{ dateLabel(s.scheduled_date) }}</span>
        </li>
      </ul>
    </div>
  </form>
</template>
