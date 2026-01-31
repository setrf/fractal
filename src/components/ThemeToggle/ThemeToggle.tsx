import { useTheme } from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const { effectiveTheme, toggleTheme } = useTheme()
  
  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className={styles.icon}>
        {effectiveTheme === 'light' ? '◐' : '◑'}
      </span>
    </button>
  )
}
