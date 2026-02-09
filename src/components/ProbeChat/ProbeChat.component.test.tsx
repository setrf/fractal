import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProbeChat } from './ProbeChat'
import type { Probe } from '../../types/probe'
import type { StashItem } from '../../types/stash'

const apiMocks = vi.hoisted(() => ({
  exportProbeBriefMock: vi.fn(),
  sendProbeChatMessageMock: vi.fn(),
  suggestProbeExperimentsMock: vi.fn(),
}))

let probeContext: any
let stashContext: any
let modelContext: any

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => probeContext,
}))

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashContext,
}))

vi.mock('../../context/ModelContext', () => ({
  useModelContext: () => modelContext,
}))

vi.mock('../../api/client', () => ({
  exportProbeBrief: (...args: unknown[]) => apiMocks.exportProbeBriefMock(...args),
  sendProbeChatMessage: (...args: unknown[]) => apiMocks.sendProbeChatMessageMock(...args),
  suggestProbeExperiments: (...args: unknown[]) => apiMocks.suggestProbeExperimentsMock(...args),
}))

function createProbe(overrides: Partial<Probe> = {}): Probe {
  return {
    id: 'p_1',
    name: 'Probe 1',
    color: 'blue',
    messages: [],
    selectedStashItemIds: ['s_1'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function createStashItems(): StashItem[] {
  return [
    {
      id: 's_1',
      type: 'note',
      content: 'Long context note from exploration',
      metadata: { title: 'Context Note' },
      createdAt: Date.now(),
    },
    {
      id: 's_2',
      type: 'question',
      content: 'What did we learn?',
      metadata: {},
      createdAt: Date.now(),
    },
  ]
}

describe('ProbeChat component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    modelContext = { selectedModel: 'openai/gpt-4.1-mini' }
    stashContext = { items: createStashItems() }
    probeContext = {
      addMessage: vi.fn(),
      removeStashItemFromProbe: vi.fn(),
      synthesizePrompt: vi
        .fn()
        .mockReturnValue('## Context from your exploration:\n\n## Your Direction:\nFocus on tradeoffs'),
    }

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('renders selected context items and removes an item from probe context', () => {
    render(<ProbeChat probe={createProbe()} />)

    expect(screen.getByText(/Context Note/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Remove from context/i }))

    expect(probeContext.removeStashItemFromProbe).toHaveBeenCalledWith('p_1', 's_1')
  })

  it('shows empty context and empty-message hints when no stash items are selected', () => {
    render(<ProbeChat probe={createProbe({ selectedStashItemIds: [] })} />)

    expect(screen.getByText(/Drag items from Stash/i)).toBeInTheDocument()
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Add items from your Stash/i)).toBeInTheDocument()
  })

  it('synthesizes a prompt and sends message with auto experiment suggestions', async () => {
    apiMocks.sendProbeChatMessageMock.mockResolvedValue('Assistant synthesis response')
    apiMocks.suggestProbeExperimentsMock.mockResolvedValue({
      suggestions: [
        {
          title: 'A/B prompt framing',
          hypothesis: 'Specific framing increases depth',
          metric: 'Average quality score',
        },
      ],
    })

    render(<ProbeChat probe={createProbe()} />)

    fireEvent.click(screen.getByRole('button', { name: /Synthesize/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(apiMocks.sendProbeChatMessageMock).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.sendProbeChatMessageMock).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Focus on tradeoffs' }],
      [stashContext.items[0]],
      'openai/gpt-4.1-mini'
    )

    await waitFor(() => {
      expect(probeContext.addMessage).toHaveBeenCalledTimes(3)
    })
    expect(probeContext.addMessage.mock.calls[0][0]).toBe('p_1')
    expect(probeContext.addMessage.mock.calls[0][1]).toMatchObject({
      role: 'user',
      content: 'Focus on tradeoffs',
      sourceStashItemIds: ['s_1'],
    })
    expect(probeContext.addMessage.mock.calls[1][1]).toMatchObject({
      role: 'assistant',
      content: 'Assistant synthesis response',
    })
    expect(probeContext.addMessage.mock.calls[2][1].content).toContain('Suggested next experiments')
  })

  it('continues gracefully when experiment suggestion call fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apiMocks.sendProbeChatMessageMock.mockResolvedValue('Assistant response')
    apiMocks.suggestProbeExperimentsMock.mockRejectedValue(new Error('suggestion error'))

    render(<ProbeChat probe={createProbe()} />)
    fireEvent.click(screen.getByRole('button', { name: /Synthesize/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(apiMocks.sendProbeChatMessageMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(probeContext.addMessage).toHaveBeenCalledTimes(2)
    })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('handles send errors by appending a fallback assistant message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    apiMocks.sendProbeChatMessageMock.mockRejectedValue(new Error('network down'))

    render(<ProbeChat probe={createProbe()} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your message/i), {
      target: { value: 'Investigate uncertainty' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(probeContext.addMessage).toHaveBeenCalledTimes(2)
    })
    expect(probeContext.addMessage.mock.calls[1][1]).toMatchObject({
      role: 'assistant',
      content: 'Sorry, I encountered an error processing your request. Please try again.',
    })

    errorSpy.mockRestore()
  })

  it('exports a PM brief and reports export status', async () => {
    apiMocks.exportProbeBriefMock.mockResolvedValue({
      brief: {
        problemStatement: 'Problem',
        hypotheses: ['H1'],
        primaryExperiment: 'Run experiment A',
        successMetrics: ['Metric A'],
        risks: ['Risk A'],
        recommendation: 'Proceed',
        nextExperiments: ['Experiment B'],
      },
      markdown: '# PM brief',
      model: 'openai/gpt-4.1-mini',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    })

    render(<ProbeChat probe={createProbe()} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your message/i), {
      target: { value: 'Ship the MVP with measurable guardrails.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Export Brief/i }))

    await waitFor(() => {
      expect(apiMocks.exportProbeBriefMock).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.exportProbeBriefMock).toHaveBeenCalledWith(
      [stashContext.items[0]],
      'Ship the MVP with measurable guardrails.',
      'openai/gpt-4.1-mini'
    )
    expect(probeContext.addMessage).toHaveBeenCalledWith(
      'p_1',
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('PM brief exported.'),
      })
    )
    expect(await screen.findByText(/Exported fractal-pm-brief-/i)).toBeInTheDocument()
  })

  it('uses default export direction and surfaces export failures', async () => {
    apiMocks.exportProbeBriefMock.mockRejectedValue(new Error('brief generation failed'))

    render(<ProbeChat probe={createProbe()} />)
    fireEvent.click(screen.getByRole('button', { name: /Export Brief/i }))

    await waitFor(() => {
      expect(apiMocks.exportProbeBriefMock).toHaveBeenCalledWith(
        [stashContext.items[0]],
        'Generate a PM brief from this exploration context.',
        'openai/gpt-4.1-mini'
      )
    })
    expect(await screen.findByText(/Export failed: brief generation failed/i)).toBeInTheDocument()
  })

  it('sends on Enter, does not send on Shift+Enter, and filters system messages', async () => {
    apiMocks.sendProbeChatMessageMock.mockResolvedValue('ok')
    const probe = createProbe({
      messages: [
        { id: 'm1', role: 'system', content: 'hidden', timestamp: Date.now() },
        { id: 'm2', role: 'assistant', content: 'visible assistant', timestamp: Date.now() },
      ],
    })

    render(<ProbeChat probe={probe} />)

    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
    expect(screen.getByText('visible assistant')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/Type your message/i)
    fireEvent.change(textarea, { target: { value: 'Line 1' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(apiMocks.sendProbeChatMessageMock).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    await waitFor(() => {
      expect(apiMocks.sendProbeChatMessageMock).toHaveBeenCalledTimes(1)
    })
  })

  it('resizes the input area from drag handle with clamp behavior', async () => {
    const { container } = render(<ProbeChat probe={createProbe()} />)

    const inputArea = container.querySelector('div[class*="inputArea"]') as HTMLDivElement
    const resizeHandle = container.querySelector('div[class*="inputResizeHandle"]') as HTMLDivElement
    expect(inputArea).toBeTruthy()
    expect(resizeHandle).toBeTruthy()

    vi.spyOn(inputArea, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 700,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    })

    fireEvent.mouseDown(resizeHandle, { clientY: 680 })
    await waitFor(() => {
      expect(resizeHandle.className).toContain('isResizing')
    })
    fireEvent.mouseMove(document, { clientY: 500 })

    await waitFor(() => {
      expect(inputArea.style.height).toBe('176px')
    })
    fireEvent.mouseUp(document)
  })
})
