<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useTaskStore } from '../stores/tasks'
import type { ListName, Task } from '../types'
import TaskItem from './TaskItem.vue'

const props = defineProps<{ list: ListName }>()
const emit = defineEmits<{ 'focus-input': [] }>()

const store = useTaskStore()
const listEl = ref<HTMLUListElement>()

const tasks = computed(() => store.lists[props.list])
const pendingIds = computed(() => tasks.value.filter((t) => t.status === 'pending').map((t) => t.id))

const empty: Record<ListName, { title: string; hint: string }> = {
  today: { title: 'Nothing planned for today', hint: 'Type a task above and press Enter.' },
  tomorrow: { title: 'Nothing planned for tomorrow yet', hint: 'Tasks you add on this tab go to tomorrow.' },
  skipped: { title: 'No skipped tasks', hint: 'Unfinished tasks from earlier days show up here.' },
}

// ---- Keyboard focus ------------------------------------------------------

const rows = () => Array.from(listEl.value?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [])
const rowFor = (id: number) => listEl.value?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)

function focusRowAt(index: number) {
  const all = rows()
  if (all.length === 0) return emit('focus-input')
  all[Math.max(0, Math.min(index, all.length - 1))].focus()
}

function step(task: Task, delta: number) {
  const all = rows()
  const index = all.findIndex((el) => el.dataset.taskId === String(task.id))
  all[index + delta]?.focus()
}

/**
 * Runs a store action, then puts focus back where a keyboard user expects it:
 * on the same task if it is still in this list, otherwise on its neighbour.
 * (Re-rendering moves or removes the row, which would otherwise drop focus.)
 */
async function act(task: Task, action: () => Promise<void>) {
  const row = rowFor(task.id)
  const hadFocus = !!row?.contains(document.activeElement)
  const index = row ? rows().indexOf(row) : 0
  await action()
  await nextTick()
  if (!hadFocus) return
  const stillHere = rowFor(task.id)
  if (stillHere) stillHere.focus()
  else focusRowAt(index)
}

function nudge(task: Task, delta: number) {
  const ids = [...pendingIds.value]
  const from = ids.indexOf(task.id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  ids.splice(from, 1)
  ids.splice(to, 0, task.id)
  act(task, () => store.reorder(ids))
}

// ---- Drag and drop -------------------------------------------------------
// Only pending tasks can be dragged; completed ones stay at the bottom.

const dragId = ref<number | null>(null)
/** Position in the pending list where the dragged task would land (0..n). */
const dropIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, task: Task) {
  dragId.value = task.id
  e.dataTransfer?.setData('text/plain', String(task.id))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, task: Task) {
  if (dragId.value === null) return
  e.preventDefault()
  const index = pendingIds.value.indexOf(task.id)
  if (index < 0) {
    dropIndex.value = pendingIds.value.length // over a done task: drop at the end
    return
  }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const id = dragId.value
  const target = dropIndex.value
  resetDrag()
  if (id === null || target === null) return
  const ids = [...pendingIds.value]
  const from = ids.indexOf(id)
  ids.splice(from, 1)
  ids.splice(target > from ? target - 1 : target, 0, id)
  if (ids.some((v, i) => v !== pendingIds.value[i])) store.reorder(ids)
}

function resetDrag() {
  dragId.value = null
  dropIndex.value = null
}

/** Draws the insertion line above (or, for the last slot, below) a row. */
function dropMarker(task: Task) {
  if (dragId.value === null || dropIndex.value === null) return null
  const index = pendingIds.value.indexOf(task.id)
  if (index === dropIndex.value) return 'shadow-[inset_0_2px_0_0_var(--color-hop)]'
  if (index === pendingIds.value.length - 1 && dropIndex.value === pendingIds.value.length)
    return 'shadow-[inset_0_-2px_0_0_var(--color-hop)]'
  return null
}
</script>

<template>
  <!-- Outer auto-animate fades between the list and its empty state; the inner one animates rows. -->
  <div
    :id="`panel-${list}`"
    v-auto-animate="{ duration: 150 }"
    role="tabpanel"
    :aria-labelledby="`tab-${list}`"
    class="px-1.5 py-2"
  >
    <ul
      v-if="tasks.length"
      ref="listEl"
      v-auto-animate="{ duration: 150 }"
      class="flex flex-col"
      @dragover.prevent
      @drop="onDrop"
    >
      <TaskItem
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :list="list"
        :class="[dropMarker(task), dragId === task.id && 'opacity-40']"
        @dragstart="onDragStart($event, task)"
        @dragover="onDragOver($event, task)"
        @dragend="resetDrag"
        @toggle="act(task, () => store.toggle(task))"
        @save="(title, notes) => act(task, () => store.edit(task, title, notes))"
        @remove="act(task, () => store.remove(task))"
        @move="(to) => act(task, () => store.moveTo(task, to === 'today' ? store.today : store.tomorrow))"
        @drop-task="act(task, () => store.drop(task))"
        @nudge="(delta) => nudge(task, delta)"
        @step="(delta) => step(task, delta)"
      />
    </ul>

    <div v-else class="px-4 py-10 text-center">
      <p class="text-sm font-medium text-ink">{{ empty[list].title }}</p>
      <p class="mt-1 text-xs text-ink-2">{{ empty[list].hint }}</p>
    </div>
  </div>
</template>
