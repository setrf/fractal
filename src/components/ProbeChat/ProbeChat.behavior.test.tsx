import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProbeChat } from './ProbeChat'
import type { Probe } from '../../types/probe'
import type { StashItem } from '../../types/stash'
import {
  exportProbeBrief,
  sendProbeChatMessage,
  suggestProbeExperiments,
} from '../../api/client'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const harness = vi.hoisted(() => ({
  probeContext: {
    addMessage: vi.fn(),
    removeStashItemFromProbe: vi.fn(),
    synthesizePrompt: vi.fn(),
  },
  stashContext: {
    items: [] as StashItem[],
  },
  modelContext: {
    selectedModel: 'test-model' as string | null,
  },
}))

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => harness.probeContext,
}))

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => harness.stashContext,
}))

vi.mock('../../context/ModelContext', () => ({
  useModelContext: () => harness.modelContext,
}))

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return {
    ...actual,
    exportProbeBrief: vi.fn(),
    sendProbeChatMessage: vi.fn(),
    suggestProbeExperiments: vi.fn(),
  }
})

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <>{children}</>,
}))

const mockedExportProbeBrief = vi.mocked(exportProbeBrief)
const mockedSendProbeChatMessage = vi.mocked(sendProbeChatMessage)
const mockedSuggestProbeExperiments = vi.mocked(suggestProbeExperiments)

function createStashItem(overrides: Partial<StashItem> = {}): StashItem {
  return {
    id: 's-1',
    type: 'note',
    content: 'This is a very long stash content string that should truncate in context chips.',
    metadata: {},
    createdAt: Date.now(),
    ...overrides,
  }
}

function createProbe(overrides: Partial<Probe> = {}): Probe {
  return {
    id: 'p-1',
    name: 'Probe One',
    color: 'blue',
    selectedStashItemIds: ['s-1'],
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('ProbeChat behavior', () => {
  beforeEach(() => {
    harness.probeContext.addMessage.mockReset()
    harness.probeContext.removeStashItemFromProbe.mockReset()
    harness.probeContext.synthesizePrompt.mockReset()

    harness.stashContext.items = [createStashItem()]
    harness.modelContext.selectedModel = 'test-model'

    mockedExportProbeBrief.mockReset()
    mockedSendProbeChatMessage.mockReset()
    mockedSuggestProbeExperiments.mockReset()

    mockedExportProbeBrief.mockResolvedValue({
      brief: {
        problemStatement: 'Problem',
        hypotheses: [],
        primaryExperiment: 'Run experiment A',
        successMetrics: [],
        risks: [],
        recommendation: 'Ship',
        nextExperiments: [],
      },
      markdown: '# Probe brief',
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })

    mockedSendProbeChatMessage.mockResolvedValue('Assistant response')
    mockedSuggestProbeExperiments.mockResolvedValue({
      suggestions: [
        { title: 'Test variant', hypothesis: 'H', metric: 'M' },
      ],
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })

    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:probe')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('renders selected context with fallback truncation, user labels, and item removal action', () => {
    const probe = createProbe({
      messages: [
        {
          id: 'pm-user',
          role: 'user',
          content: 'User message',
          timestamp: Date.now(),
        },
      ],
    })

    render(<ProbeChat probe={probe} />)

    expect(screen.getByText('This is a very long stash cont...')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Remove from context'))
    expect(harness.probeContext.removeStashItemFromProbe).toHaveBeenCalledWith('p-1', 's-1')
  })

  it('exports a brief with default direction, handles concurrent export guard, and falls back to undefined model', async () => {
    harness.modelContext.selectedModel = null
    const exportRequest = deferred<Awaited<ReturnType<typeof exportProbeBrief>>>()
    mockedExportProbeBrief.mockImplementationOnce(() => exportRequest.promise)

    render(<ProbeChat probe={createProbe()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Export Brief' }))
    const exportingButton = screen.getByRole('button', { name: 'Exporting…' }) as HTMLButtonElement
    expect(exportingButton).toBeDisabled()

    // Force second click to hit the exporting-guard return path.
    exportingButton.disabled = false
    fireEvent.click(exportingButton)
    expect(mockedExportProbeBrief).toHaveBeenCalledTimes(1)

    exportRequest.resolve({
      brief: {
        problemStatement: 'Problem',
        hypotheses: [],
        primaryExperiment: 'Experiment X',
        successMetrics: [],
        risks: [],
        recommendation: 'Next',
        nextExperiments: [],
      },
      markdown: '# Exported',
      model: 'model-x',
      usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 },
    })

    await waitFor(() => {
      expect(mockedExportProbeBrief).toHaveBeenCalledWith(
        expect.any(Array),
        'Generate a PM brief from this exploration context.',
        undefined
      )
    })
    await screen.findByText(/Exported fractal-pm-brief-/)
    expect(harness.probeContext.addMessage).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('PM brief exported.'),
      })
    )
  })

  it('handles non-Error export failures with fallback error messaging', async () => {
    harness.modelContext.selectedModel = null
    mockedExportProbeBrief.mockRejectedValueOnce('non-error failure')

    render(<ProbeChat probe={createProbe()} />)

    fireEvent.change(screen.getByPlaceholderText(/Type your message/), {
      target: { value: 'Direction for brief' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Export Brief' }))

    expect(await screen.findByText('Export failed: Failed to export brief')).toBeInTheDocument()
  })

  it('hides brief export actions when no stash items are selected', () => {
    const probe = createProbe({ selectedStashItemIds: [] })
    render(<ProbeChat probe={probe} />)

    expect(screen.queryByRole('button', { name: 'Export Brief' })).not.toBeInTheDocument()
    expect(mockedExportProbeBrief).not.toHaveBeenCalled()
  })

  it('covers send guards, synthesized flow, filtered API history, and empty suggestion branch', async () => {
    harness.modelContext.selectedModel = null
    harness.probeContext.synthesizePrompt.mockReturnValue(
      [
        '## Context from your exploration:',
        '',
        '## Your Direction:',
        'Investigate this branch',
      ].join('\n')
    )
    mockedSuggestProbeExperiments.mockResolvedValueOnce({
      suggestions: [],
      model: 'model-x',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })

    const probe = createProbe({
      messages: [
        {
          id: 'pm-system',
          role: 'system',
          content: 'system context',
          timestamp: Date.now(),
        },
        {
          id: 'pm-assistant',
          role: 'assistant',
          content: 'assistant history',
          timestamp: Date.now(),
        },
      ],
    })

    render(<ProbeChat probe={probe} />)

    const textarea = screen.getByPlaceholderText(/Type your message/)
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(harness.probeContext.addMessage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(mockedSendProbeChatMessage).toHaveBeenCalledWith(
        [
          { role: 'assistant', content: 'assistant history' },
          { role: 'user', content: 'Investigate this branch' },
        ],
        expect.any(Array),
        undefined
      )
    })
    expect(mockedSuggestProbeExperiments).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      undefined
    )
    expect(harness.probeContext.addMessage).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({
        role: 'user',
        content: 'Investigate this branch',
      })
    )
    expect(harness.probeContext.addMessage).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({
        role: 'assistant',
        content: 'Assistant response',
      })
    )
    expect(
      harness.probeContext.addMessage.mock.calls.some(
        (call) =>
          call[1]?.role === 'assistant'
          && typeof call[1]?.content === 'string'
          && call[1].content.includes('### Suggested next experiments')
      )
    ).toBe(false)
  })
})
