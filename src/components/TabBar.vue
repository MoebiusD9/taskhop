<script setup lang="ts">
import { ref } from 'vue'
import type { ListName } from '../types'

defineProps<{ counts: Record<ListName, number> }>()
const active = defineModel<ListName>({ required: true })

const tabs: { id: ListName; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'skipped', label: 'Skipped' },
]

const buttons = ref<HTMLButtonElement[]>([])

// Arrow keys move between tabs, following the WAI-ARIA tabs pattern.
function onKey(e: KeyboardEvent, index: number) {
  const last = tabs.length - 1
  const next =
    e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
    : e.key === 'Home' ? 0
    : e.key === 'End' ? last
    : null
  if (next === null) return
  e.preventDefault()
  active.value = tabs[next].id
  buttons.value[next]?.focus()
}
</script>

<template>
  <div role="tablist" aria-label="Task lists" class="flex gap-1 border-b border-line px-3 pt-2">
    <button
      v-for="(tab, i) in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      ref="buttons"
      type="button"
      role="tab"
      :aria-selected="active === tab.id"
      :aria-controls="`panel-${tab.id}`"
      :tabindex="active === tab.id ? 0 : -1"
      class="-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 text-sm
             focus-visible:outline-2 focus-visible:outline-hop cursor-pointer"
      :class="active === tab.id
        ? 'border-hop font-medium text-ink'
        : 'border-transparent text-ink-2 hover:text-ink'"
      @click="active = tab.id"
      @keydown="onKey($event, i)"
    >
      {{ tab.label }}
      <span
        v-if="counts[tab.id] > 0"
        class="min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums"
        :class="tab.id === 'skipped'
          ? 'bg-hop text-on-hop'
          : 'bg-line text-ink'"
      >
        <span class="sr-only">(</span>{{ counts[tab.id] }}<span class="sr-only"> pending)</span>
      </span>
    </button>
  </div>
</template>
