<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { formatShortDate } from '../lib/dates'
import type { ListName, Task } from '../types'

const props = defineProps<{ task: Task; list: ListName }>()
const emit = defineEmits<{
  toggle: []
  save: [title: string, notes: string | null]
  remove: []
  move: [to: 'today' | 'tomorrow']
  'drop-task': []
  /** Alt+Up/Down: move this task one place up or down. */
  nudge: [delta: -1 | 1]
  /** Up/Down: move keyboard focus to the previous or next task. */
  step: [delta: -1 | 1]
}>()

const done = computed(() => props.task.status === 'done')
const moveTarget = computed(() => (props.list === 'today' ? 'tomorrow' : 'today'))

const row = ref<HTMLLIElement>()
const titleInput = ref<HTMLInputElement>()
const editing = ref(false)
const draftTitle = ref('')
const draftNotes = ref('')

async function startEdit() {
  draftTitle.value = props.task.title
  draftNotes.value = props.task.notes ?? ''
  editing.value = true
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

function commitEdit() {
  if (!editing.value) return
  editing.value = false
  const title = draftTitle.value.trim()
  const notes = draftNotes.value.trim() || null
  // An emptied title cancels the edit rather than saving a blank task.
  if (title && (title !== props.task.title || notes !== props.task.notes)) {
    emit('save', title, notes)
  }
}

function commitAndRefocus() {
  commitEdit()
  row.value?.focus()
}

function cancelEdit() {
  editing.value = false
  row.value?.focus()
}

// Save when focus leaves the edit form (click elsewhere, Tab away).
function onFormFocusOut(e: FocusEvent) {
  const form = e.currentTarget as HTMLElement
  if (!form.contains(e.relatedTarget as Node | null)) commitEdit()
}

function onKey(e: KeyboardEvent) {
  const up = e.key === 'ArrowUp'
  const down = e.key === 'ArrowDown'
  if ((up || down) && e.altKey) {
    e.preventDefault()
    if (!done.value) emit('nudge', up ? -1 : 1)
  } else if (up || down) {
    e.preventDefault()
    emit('step', up ? -1 : 1)
  } else if (e.key === ' ') {
    e.preventDefault()
    emit('toggle')
  } else if (e.key === 'Enter' || e.key === 'F2') {
    e.preventDefault()
    startEdit()
  } else if (e.key === 'Delete') {
    e.preventDefault()
    emit('remove')
  }
}

const iconBtn =
  'grid size-7 place-items-center rounded-md text-ink-2 hover:bg-wash hover:text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-hop'
const textBtn =
  'rounded px-1 font-medium text-hop hover:underline focus-visible:outline-2 focus-visible:outline-hop'
</script>

<template>
  <li
    ref="row"
    :data-task-id="task.id"
    tabindex="0"
    :draggable="!editing && !done"
    :aria-label="`${task.title}${done ? ', done' : ''}`"
    aria-keyshortcuts="Space Enter Delete Alt+ArrowUp Alt+ArrowDown"
    class="group flex items-start gap-2 rounded-md px-2 py-1.5 outline-none
           hover:bg-wash focus-visible:ring-2 focus-visible:ring-hop"
    :class="[done && 'opacity-50', !done && !editing && 'cursor-grab active:cursor-grabbing']"
    @keydown.self="onKey"
  >
    <input
      type="checkbox"
      :checked="done"
      :aria-label="done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`"
      class="mt-0.5 size-4 shrink-0 cursor-pointer accent-hop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hop"
      @change="emit('toggle')"
    />

    <form
      v-if="editing"
      class="flex min-w-0 flex-1 flex-col gap-1"
      @submit.prevent="commitAndRefocus"
      @focusout="onFormFocusOut"
      @keydown.esc.prevent.stop="cancelEdit"
    >
      <input
        ref="titleInput"
        v-model="draftTitle"
        type="text"
        aria-label="Task title"
        class="w-full rounded border border-hop bg-field px-1.5 py-0.5 text-sm outline-none"
      />
      <textarea
        v-model="draftNotes"
        rows="2"
        aria-label="Notes"
        placeholder="Notes (Ctrl+Enter to save)"
        class="w-full resize-none rounded border border-line-strong bg-field px-1.5 py-0.5 text-xs outline-none
               focus:border-hop"
        @keydown.enter.ctrl.prevent="commitAndRefocus"
        @keydown.enter.meta.prevent="commitAndRefocus"
      />
    </form>

    <div v-else class="min-w-0 flex-1 cursor-text" @click="startEdit">
      <p class="text-sm leading-5 break-words" :class="done && 'line-through'">{{ task.title }}</p>
      <p v-if="task.notes" class="line-clamp-2 text-xs whitespace-pre-line text-ink-2">
        {{ task.notes }}
      </p>
      <p v-if="list === 'skipped'" class="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs" @click.stop>
        <span class="text-ink-2">{{ formatShortDate(task.scheduled_date) }}</span>
        <span aria-hidden="true" class="text-ink-3">·</span>
        <button type="button" :class="textBtn" @click="emit('move', 'today')">Move to today</button>
        <span aria-hidden="true" class="text-ink-3">·</span>
        <button type="button" :class="textBtn" @click="emit('drop-task')">Drop</button>
      </p>
    </div>

    <div
      v-if="!editing"
      class="flex shrink-0 items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
    >
      <button
        v-if="!done && list !== 'skipped'"
        type="button"
        class="cursor-pointer"
        :class="iconBtn"
        :aria-label="`Move to ${moveTarget}`"
        :title="`Move to ${moveTarget}`"
        @click="emit('move', moveTarget)"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-if="moveTarget === 'tomorrow'" d="M5 12h14M13 6l6 6-6 6" />
          <path v-else d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </button>
      <button type="button" class="cursor-pointer" :class="iconBtn" aria-label="Delete task" title="Delete" @click="emit('remove')">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </div>
  </li>
</template>
