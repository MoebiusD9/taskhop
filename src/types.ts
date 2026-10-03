export type TaskStatus = 'pending' | 'done' | 'dropped'

/** Lists are never stored; they are derived from scheduled_date and status. */
export type ListName = 'today' | 'tomorrow' | 'skipped'

/** What the Rust parse_task / test_gemini_key commands return. */
export interface ParsedTask {
  title: string
  scheduled_date: string
}

/** A row of the `tasks` table. Dates are local YYYY-MM-DD, timestamps are ISO UTC. */
export interface Task {
  id: number
  title: string
  notes: string | null
  scheduled_date: string
  status: TaskStatus
  sort_order: number
  created_at: string
  completed_at: string | null
}
