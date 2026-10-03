export type Theme = 'system' | 'light' | 'dark'

// Cached in localStorage too, so the right theme is applied before the database
// (where the setting really lives) has loaded, with no flash of the wrong one.
const CACHE_KEY = 'taskhop.theme'

/** "system" follows the OS via CSS; "light"/"dark" force it (see style.css). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    localStorage.setItem(CACHE_KEY, theme)
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
}

export function cachedTheme(): Theme {
  try {
    const value = localStorage.getItem(CACHE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // Fall through to the default.
  }
  return 'system'
}
