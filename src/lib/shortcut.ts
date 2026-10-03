// Global shortcuts are stored in the format the Rust side parses, e.g.
// "CommandOrControl+Alt+KeyT". Keys use KeyboardEvent.code names.

export const isMac = navigator.userAgent.includes('Mac')

/** Ctrl+Alt+T on Windows, Cmd+Option+T on macOS. */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Alt+KeyT'

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/

/**
 * Turns a keydown into a shortcut string, or null if it isn't usable yet:
 * a lone modifier, or a key without Ctrl/Cmd/Alt (Shift alone is too easy to hit).
 */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.test(e.code) || !e.code) return null
  const mods: string[] = []
  if (isMac ? e.metaKey : e.ctrlKey) mods.push('CommandOrControl')
  if (isMac && e.ctrlKey) mods.push('Control')
  if (!isMac && e.metaKey) mods.push('Super')
  if (e.altKey) mods.push('Alt')
  if (mods.length === 0) return null
  if (e.shiftKey) mods.push('Shift')
  return [...mods, e.code].join('+')
}

const MAC_LABELS: Record<string, string> = {
  CommandOrControl: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧', Super: '⌘',
}
const PC_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Super: 'Win',
}
const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
}

/** Splits a shortcut into display labels, e.g. ["Ctrl", "Alt", "T"] or ["⌘", "⌥", "T"]. */
export function shortcutLabels(shortcut: string): string[] {
  const mods = isMac ? MAC_LABELS : PC_LABELS
  return shortcut.split('+').map((part) => {
    if (mods[part]) return mods[part]
    if (KEY_LABELS[part]) return KEY_LABELS[part]
    return part.replace(/^(Key|Digit|Numpad)/, '')
  })
}
