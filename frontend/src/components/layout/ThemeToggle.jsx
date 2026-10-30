import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const themeStorageKey = 'ikira-theme-v1'

function readThemePreference() {
  try {
    return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'
  } catch (error) {
    console.error('The saved theme preference could not be read.', error)
    return 'light'
  }
}

function ThemeToggle({ variant = 'icon' }) {
  const [theme, setTheme] = useState(readThemePreference)
  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const Icon = theme === 'light' ? Moon : Sun

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(themeStorageKey, theme)
    } catch (error) {
      console.error('The theme preference could not be saved.', error)
    }
    window.dispatchEvent(new CustomEvent('ikira:theme-change', { detail: theme }))
  }, [theme])

  useEffect(() => {
    function syncTheme(event) {
      if (event.detail === 'light' || event.detail === 'dark') setTheme(event.detail)
    }

    window.addEventListener('ikira:theme-change', syncTheme)
    return () => window.removeEventListener('ikira:theme-change', syncTheme)
  }, [])

  return (
    <button
      className={
        variant === 'mobile'
          ? 'mobile-theme-toggle'
          : variant === 'admin'
            ? 'admin-secondary-button admin-theme-toggle'
            : 'icon-button theme-toggle'
      }
      type="button"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon size={variant === 'mobile' ? 16 : 19} aria-hidden="true" />
      {variant !== 'icon' && `Switch to ${nextTheme} theme`}
    </button>
  )
}

export default ThemeToggle
