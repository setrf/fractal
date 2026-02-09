import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReplayTimeline, type ReplayEvent } from './ReplayTimeline'

const events: ReplayEvent[] = [
  {
    id: 'e1',
    timestamp: new Date('2024-01-01T10:00:00.000Z').getTime(),
    type: 'seed',
    label: 'Root question added',
    detail: 'Why do we dream?',
  },
  {
    id: 'e2',
    timestamp: new Date('2024-01-01T10:00:02.000Z').getTime(),
    type: 'branch',
    label: 'Deep dive generated',
  },
  {
    id: 'e3',
    timestamp: new Date('2024-01-01T10:00:04.000Z').getTime(),
    type: 'stash',
    label: 'Insight stashed',
  },
]

describe('ReplayTimeline', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when events are empty', () => {
    const { container } = render(<ReplayTimeline events={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders current event and updates via slider', () => {
    render(<ReplayTimeline events={events} />)

    expect(screen.getByText(/Replay Timeline/i)).toBeInTheDocument()
    expect(screen.getByText('Root question added')).toBeInTheDocument()
    expect(screen.getByText('Detail: Why do we dream?')).toBeInTheDocument()

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '1' } })

    expect(screen.getByText('Deep dive generated')).toBeInTheDocument()
    expect(screen.queryByText(/Detail:/i)).not.toBeInTheDocument()
  })

  it('plays forward through events and stops at the end', () => {
    vi.useFakeTimers()
    render(<ReplayTimeline events={events} />)

    const playButton = screen.getByRole('button', { name: /play replay timeline/i })
    fireEvent.click(playButton)

    expect(screen.getByRole('button', { name: /pause replay timeline/i })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByText('Deep dive generated')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByText('Insight stashed')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByRole('button', { name: /play replay timeline/i })).toBeInTheDocument()
  })
})
