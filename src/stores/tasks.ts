import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type Database from '@tauri-apps/plugin-sql'
import { getDb } from '../lib/db'
import { addDays, localDate } from '../lib/dates'
import type { ListName, Task } from '../types'

const byOrder = (a: Task, b: Task) => a.sort_order - b.sort_order || a.id - b.id

/** Pending tasks first (in their manual order), completed ones after them. */
const doneLast = (a: Task, b: Task) =>
  a.status === b.status ? byOrder(a, b) : a.status === 'pending' ? -1 : 1

const nowIso = () => new Date().toISOString()

/** Appends to the end of a day's list. $1 must be that day's date. */
const NEXT_ORDER = '(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE scheduled_date = $1)'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const today = ref(localDate())
  const tomorrow = computed(() => addDays(today.value, 1))
  const ready = ref(false)
  const error = ref<string | null>(null)
  const lastDeleted = ref<Task | null>(null)

  const lists = computed<Record<ListName, Task[]>>(() => {
    const visible = tasks.value.filter((t) => t.status !== 'dropped')
    return {
      today: visible.filter((t) => t.scheduled_date === today.value).sort(doneLast),
      tomorrow: visible.filter((t) => t.scheduled_date === tomorrow.value).sort(doneLast),
      skipped: visible
        .filter((t) => t.status === 'pending' && t.scheduled_date < today.value)
        .sort(byOrder),
    }
  })

  const pendingCount = (list: Task[]) => list.filter((t) => t.status === 'pending').length
  const counts = computed<Record<ListName, number>>(() => ({
    today: pendingCount(lists.value.today),
    tomorrow: pendingCount(lists.value.tomorrow),
    skipped: pendingCount(lists.value.skipped),
  }))

  /** Reloads every task that can appear in a list, using the current local date. */
  async function refresh() {
    try {
      today.value = localDate()
      const db = await getDb()
      tasks.value = await db.select<Task[]>(
        `SELECT * FROM tasks
         WHERE status != 'dropped'
           AND (scheduled_date IN ($1, $2) OR (status = 'pending' AND scheduled_date < $1))`,
        [today.value, tomorrow.value],
      )
    } catch (err) {
      error.value = `Could not load tasks: ${err}`
    } finally {
      ready.value = true
    }
  }

  /** Runs a write, reports failures, then reloads so the UI matches the database. */
  async function write(action: (db: Database) => Promise<unknown>) {
    try {
      await action(await getDb())
      error.value = null
    } catch (err) {
      error.value = `Could not save: ${err}`
    }
    await refresh()
  }

  function add(title: string, date: string) {
    return write((db) =>
      db.execute(
        `INSERT INTO tasks (scheduled_date, title, status, sort_order, created_at)
         VALUES ($1, $2, 'pending', ${NEXT_ORDER}, $3)`,
        [date, title.trim(), nowIso()],
      ),
    )
  }

  function toggle(task: Task) {
    if (task.status === 'done') {
      return write((db) =>
        db.execute(`UPDATE tasks SET status = 'pending', completed_at = NULL WHERE id = $1`, [task.id]),
      )
    }
    // A skipped task completed today counts as done today, so it stays visible in Today.
    return write((db) =>
      db.execute(
        `UPDATE tasks SET status = 'done', completed_at = $1, scheduled_date = MAX(scheduled_date, $2)
         WHERE id = $3`,
        [nowIso(), today.value, task.id],
      ),
    )
  }

  function edit(task: Task, title: string, notes: string | null) {
    return write((db) =>
      db.execute(`UPDATE tasks SET title = $1, notes = $2 WHERE id = $3`, [title.trim(), notes, task.id]),
    )
  }

  function moveTo(task: Task, date: string) {
    return write((db) =>
      db.execute(`UPDATE tasks SET scheduled_date = $1, sort_order = ${NEXT_ORDER} WHERE id = $2`, [
        date,
        task.id,
      ]),
    )
  }

  function drop(task: Task) {
    return write((db) => db.execute(`UPDATE tasks SET status = 'dropped' WHERE id = $1`, [task.id]))
  }

  async function remove(task: Task) {
    await write((db) => db.execute(`DELETE FROM tasks WHERE id = $1`, [task.id]))
    lastDeleted.value = { ...task }
  }

  async function undoDelete() {
    const t = lastDeleted.value
    if (!t) return
    lastDeleted.value = null
    await write((db) =>
      db.execute(
        `INSERT INTO tasks (id, title, notes, scheduled_date, status, sort_order, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [t.id, t.title, t.notes, t.scheduled_date, t.status, t.sort_order, t.created_at, t.completed_at],
      ),
    )
  }

  /** Saves a new manual order for the given task ids (first id = top of the list). */
  async function reorder(ids: number[]) {
    if (ids.length === 0) return
    // Update locally first so rows don't jump back while the write is in flight.
    ids.forEach((id, i) => {
      const task = tasks.value.find((t) => t.id === id)
      if (task) task.sort_order = i
    })
    // One statement, so the new order is saved all-or-nothing:
    // UPDATE ... SET sort_order = CASE id WHEN $1 THEN 0 WHEN $2 THEN 1 ... END
    const params = ids.map((_, i) => `$${i + 1}`)
    const cases = params.map((p, i) => `WHEN ${p} THEN ${i}`).join(' ')
    await write((db) =>
      db.execute(
        `UPDATE tasks SET sort_order = CASE id ${cases} END WHERE id IN (${params.join(', ')})`,
        ids,
      ),
    )
  }

  return {
    tasks, today, tomorrow, ready, error, lastDeleted, lists, counts,
    refresh, add, toggle, edit, moveTo, drop, remove, undoDelete, reorder,
  }
})
