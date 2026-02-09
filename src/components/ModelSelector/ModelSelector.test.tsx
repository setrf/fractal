import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelSelector } from './ModelSelector'

let modelContext: {
  models: string[]
  selectedModel: string | null
  setSelectedModel: ReturnType<typeof vi.fn>
  isLoading: boolean
  error: string | null
}

vi.mock('../../context/ModelContext', () => ({
  useModelContext: () => modelContext,
}))

describe('ModelSelector', () => {
  beforeEach(() => {
    modelContext = {
      models: ['openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet', 'openai/gpt-4o'],
      selectedModel: null,
      setSelectedModel: vi.fn(),
      isLoading: false,
      error: null,
    }
  })

  it('renders sorted models and applies right offset style', () => {
    render(<ModelSelector rightOffset={52} />)

    const select = screen.getByRole('combobox', { name: /select model/i })
    const options = Array.from(select.querySelectorAll('option')).map((option) => option.value)

    expect(options).toEqual([
      '',
      'anthropic/claude-3-5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
    ])
    expect(select.closest('div')).toHaveStyle('right: calc(52px + var(--space-4))')
  })

  it('updates selected model and supports resetting back to auto', () => {
    render(<ModelSelector />)

    const select = screen.getByRole('combobox', { name: /select model/i })
    fireEvent.change(select, { target: { value: 'openai/gpt-4o' } })
    fireEvent.change(select, { target: { value: '' } })

    expect(modelContext.setSelectedModel).toHaveBeenNthCalledWith(1, 'openai/gpt-4o')
    expect(modelContext.setSelectedModel).toHaveBeenNthCalledWith(2, null)
  })

  it('shows loading placeholder and disables selector while loading', () => {
    modelContext = {
      ...modelContext,
      models: [],
      isLoading: true,
    }

    render(<ModelSelector />)

    const select = screen.getByRole('combobox', { name: /select model/i })
    expect(select).toBeDisabled()
    expect(screen.getByRole('option', { name: /loading models/i })).toBeInTheDocument()
  })

  it('renders error indicator when model loading fails', () => {
    modelContext = {
      ...modelContext,
      error: 'request failed',
    }

    render(<ModelSelector />)

    const error = screen.getByText(/models unavailable/i)
    expect(error).toBeInTheDocument()
    expect(error).toHaveAttribute('title', 'request failed')
  })
})
