import { useEffect, useMemo, useState } from 'react'
import styles from './ReplayTimeline.module.css'

export interface ReplayEvent {
  id: string
  timestamp: number
  type: string
  label: string
  detail?: string
}

interface ReplayTimelineProps {
  events: ReplayEvent[]
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function ReplayTimeline({ events }: ReplayTimelineProps) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const maxIndex = Math.max(0, events.length - 1)
  const clampedIndex = Math.min(index, maxIndex)

  useEffect(() => {
    if (!isPlaying || events.length === 0) return
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = current + 1
        if (next >= events.length) {
          setIsPlaying(false)
          return events.length - 1
        }
        return next
      })
    }, 900)
    return () => clearInterval(timer)
  }, [isPlaying, events.length])

  const current = useMemo(() => events[clampedIndex] ?? null, [events, clampedIndex])

  if (events.length === 0) {
    return null
  }

  return (
    <section className={styles.timeline}>
      <div className={styles.header}>
        <h4 className={styles.title}>Replay Timeline</h4>
        <button
          className={styles.play}
          onClick={() => setIsPlaying((prev) => !prev)}
          aria-label={isPlaying ? 'Pause replay timeline' : 'Play replay timeline'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <input
        className={styles.slider}
        type="range"
        min={0}
        max={maxIndex}
        value={clampedIndex}
        onChange={(event) => setIndex(Number(event.target.value))}
      />

      {current && (
        <div className={styles.current}>
          <span className={styles.badge}>{current.type}</span>
          <span className={styles.label}>{current.label}</span>
          <span className={styles.time}>{formatTime(current.timestamp)}</span>
          {current.detail && <p className={styles.detail}>Detail: {current.detail}</p>}
        </div>
      )}
    </section>
  )
}
