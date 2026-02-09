import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileHeader } from './MobileHeader'

let stashContext: {
  isOpen: boolean
  setIsOpen: ReturnType<typeof vi.fn>
  count: number
}

let probeContext: {
  isOpen: boolean
  setIsOpen: ReturnType<typeof vi.fn>
  probes: Array<{ id: string }>
}

let viewModeContext: {
  isGraphView: boolean
  toggleViewMode: ReturnType<typeof vi.fn>
}

let themeContext: {
  effectiveTheme: 'light' | 'dark'
  toggleTheme: ReturnType<typeof vi.fn>
}

let modelContext: {
  models: string[]
  selectedModel: string | null
  setSelectedModel: ReturnType<typeof vi.fn>
  isLoading: boolean
}

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashContext,
}))

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => probeContext,
}))

vi.mock('../../context/ViewModeContext', () => ({
  useViewModeContext: () => viewModeContext,
}))

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => themeContext,
}))

vi.mock('../../context/ModelContext', () => ({
  useModelContext: () => modelContext,
}))

describe('MobileHeader behavior', () => {
  const defaultProps = {
    onOpenOnboarding: vi.fn(),
    onCreateNote: vi.fn(),
    onMinimizeAll: vi.fn(),
    onCloseAll: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    stashContext = {
      isOpen: false,
      setIsOpen: vi.fn(),
      count: 2,
    }
    probeContext = {
      isOpen: false,
      setIsOpen: vi.fn(),
      probes: [{ id: 'p1' }],
    }
    viewModeContext = {
      isGraphView: false,
      toggleViewMode: vi.fn(),
    }
    themeContext = {
      effectiveTheme: 'light',
      toggleTheme: vi.fn(),
    }
    modelContext = {
      models: ['openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet'],
      selectedModel: null,
      setSelectedModel: vi.fn(),
      isLoading: false,
    }
  })

  it('renders badges and toggles stash/probe/view controls', () => {
    render(<MobileHeader {...defaultProps} />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Toggle stash'))
    fireEvent.click(screen.getByLabelText('Toggle probe'))
    fireEvent.click(screen.getByLabelText('Toggle view mode'))

    expect(stashContext.setIsOpen).toHaveBeenCalledWith(true)
    expect(probeContext.setIsOpen).toHaveBeenCalledWith(true)
    expect(viewModeContext.toggleViewMode).toHaveBeenCalledTimes(1)
  })

  it('runs menu actions and closes the menu from item handlers and close button', () => {
    const onCreateNote = vi.fn()
    const onMinimizeAll = vi.fn()
    const onCloseAll = vi.fn()
    const onOpenOnboarding = vi.fn()

    render(
      <MobileHeader
        onCreateNote={onCreateNote}
        onMinimizeAll={onMinimizeAll}
        onCloseAll={onCloseAll}
        onOpenOnboarding={onOpenOnboarding}
      />
    )

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('New Note'))
    expect(onCreateNote).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Minimize All'))
    expect(onMinimizeAll).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Close All'))
    expect(onCloseAll).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Help & Onboarding'))
    expect(onOpenOnboarding).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('supports theme toggling and model selection in the menu', () => {
    render(<MobileHeader {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Dark Mode'))
    expect(themeContext.toggleTheme).toHaveBeenCalledTimes(1)

    const select = screen.getByLabelText('Model:')
    const options = Array.from(select.querySelectorAll('option')).map((option) => option.textContent)
    expect(options).toEqual(['Auto', 'claude-3-5-sonnet', 'gpt-4o-mini'])

    fireEvent.change(select, { target: { value: 'openai/gpt-4o-mini' } })
    fireEvent.change(select, { target: { value: '' } })
    expect(modelContext.setSelectedModel).toHaveBeenNthCalledWith(1, 'openai/gpt-4o-mini')
    expect(modelContext.setSelectedModel).toHaveBeenNthCalledWith(2, null)
  })

  it('shows light-mode label for dark theme and disables model selector while loading', () => {
    themeContext = {
      ...themeContext,
      effectiveTheme: 'dark',
    }
    modelContext = {
      ...modelContext,
      isLoading: true,
    }

    render(<MobileHeader {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Light Mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Model:')).toBeDisabled()
  })
})
