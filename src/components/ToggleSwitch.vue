<script setup lang="ts">
defineProps<{ checked: boolean; label: string; description?: string; disabled?: boolean }>()
defineEmits<{ change: [value: boolean] }>()

const id = `switch-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <label :for="id" class="text-sm font-medium">{{ label }}</label>
      <p v-if="description" :id="`${id}-desc`" class="text-xs text-ink-2">{{ description }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-describedby="description ? `${id}-desc` : undefined"
      :disabled="disabled"
      class="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hop disabled:opacity-50"
      :class="checked ? 'bg-hop' : 'bg-line-strong'"
      @click="$emit('change', !checked)"
    >
      <span
        class="inline-block size-4 rounded-full transition-transform"
        :class="checked ? 'translate-x-4.5 bg-on-hop' : 'translate-x-0.5 bg-ink-2'"
      />
    </button>
  </div>
</template>
