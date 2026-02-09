import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProbeSidebar } from './ProbeSidebar'
import type { Probe } from '../../types/probe'

let isMobile = false
let probeContext: any

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => isMobile,
}))

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => probeContext,
}))

vi.mock('../ProbeTabBar', () => ({
  ProbeTabBar: () => <div data-testid="probe-tabbar">tab bar</div>,
}))

vi.mock('../ProbeChat', () => ({
  ProbeChat: ({ probe }: { probe: Probe }) => <div data-testid="probe-chat">chat:{probe.name}</div>,
}))

function createProbe(id = 'p_1', name = 'Probe 1'): Probe {
  return {
    id,
    name,
    color: 'blue',
    messages: [],
    selectedStashItemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createContext(overrides: Partial<typeof probeContext> = {}) {
  const activeProbe = createProbe()
  return {
    probes: [activeProbe],
    activeProbe,
    createProbe: vi.fn(),
    isOpen: true,
    setIsOpen: vi.fn(),
    toggleOpen: vi.fn(),
    count: 1,
    canCreateProbe: true,
    sidebarWidth: 400,
    setSidebarWidth: vi.fn(),
    externalDragHover: false,
    addStashItemToProbe: vi.fn(),
    ...overrides,
  }
}

describe('ProbeSidebar behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobile = false
    probeContext = createContext()
  })

  it('renders open desktop view with tab bar and active probe chat', () => {
    render(<ProbeSidebar />)

    expect(screen.getByRole('heading', { name: /Probe/i })).toBeInTheDocument()
    expect(screen.getByTestId('probe-tabbar')).toBeInTheDocument()
    expect(screen.getByTestId('probe-chat')).toHaveTextContent('chat:Probe 1')
    expect(screen.getByRole('button', { name: /Collapse probe/i })).toBeInTheDocument()
  })

  it('renders collapsed desktop view with toggle and count badge', () => {
    probeContext = createContext({ isOpen: false, count: 3 })
    render(<ProbeSidebar />)

    expect(screen.getByRole('button', { name: /Expand probe/i })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides desktop toggle and supports mobile close action', () => {
    isMobile = true
    probeContext = createContext({ isOpen: true })
    render(<ProbeSidebar />)

    expect(screen.queryByRole('button', { name: /Collapse probe/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Close sidebar/i }))
    expect(probeContext.setIsOpen).toHaveBeenCalledWith(false)
  })

  it('renders no-probe state and creates first probe from CTA', () => {
    probeContext = createContext({ probes: [], activeProbe: null, count: 0 })
    render(<ProbeSidebar />)

    expect(screen.getByText(/No probes yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Create First Probe/i }))
    expect(probeContext.createProbe).toHaveBeenCalledTimes(1)
  })

  it('renders select-a-probe state when list exists but no active probe', () => {
    probeContext = createContext({
      probes: [createProbe('p_1', 'Probe 1')],
      activeProbe: null,
      count: 1,
    })
    render(<ProbeSidebar />)

    expect(screen.getByText(/Select a probe/i)).toBeInTheDocument()
    expect(screen.queryByTestId('probe-chat')).not.toBeInTheDocument()
  })

  it('disables create button when max probes is reached', () => {
    probeContext = createContext({ canCreateProbe: false })
    render(<ProbeSidebar />)

    const createButton = screen.getByRole('button', { name: /Create new probe/i })
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('title', 'Max 5 probes reached')
  })

  it('uses text/x-stash-item drop payload first and invokes callback', () => {
    const onStashItemDrop = vi.fn()
    render(<ProbeSidebar onStashItemDrop={onStashItemDrop} />)
    const sidebar = screen.getByRole('complementary')

    fireEvent.drop(sidebar, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/x-stash-item' ? 's_123' : ''),
      },
    })

    expect(probeContext.addStashItemToProbe).toHaveBeenCalledWith('p_1', 's_123')
    expect(onStashItemDrop).toHaveBeenCalledWith('s_123')
  })

  it('falls back to plain-text stash id and JSON payload parsing', () => {
    const onStashItemDrop = vi.fn()
    const { rerender } = render(<ProbeSidebar onStashItemDrop={onStashItemDrop} />)
    const sidebar = screen.getByRole('complementary')

    fireEvent.drop(sidebar, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 's_456' : ''),
      },
    })
    expect(probeContext.addStashItemToProbe).toHaveBeenCalledWith('p_1', 's_456')
    expect(onStashItemDrop).toHaveBeenCalledWith('s_456')

    probeContext = createContext()
    rerender(<ProbeSidebar onStashItemDrop={onStashItemDrop} />)
    fireEvent.drop(sidebar, {
      dataTransfer: {
        getData: (type: string) => {
          if (type === 'application/json') return JSON.stringify({ id: 's_789' })
          return ''
        },
      },
    })
    expect(probeContext.addStashItemToProbe).toHaveBeenCalledWith('p_1', 's_789')
    expect(onStashItemDrop).toHaveBeenCalledWith('s_789')
  })

  it('handles malformed drop payloads and ignores drop when no active probe', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(<ProbeSidebar />)
    const sidebar = screen.getByRole('complementary')

    fireEvent.drop(sidebar, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? '{invalid-json' : ''),
      },
    })
    expect(errorSpy).toHaveBeenCalled()

    probeContext = createContext({ activeProbe: null })
    rerender(<ProbeSidebar />)
    fireEvent.drop(sidebar, {
      dataTransfer: {
        getData: () => 's_123',
      },
    })
    expect(probeContext.addStashItemToProbe).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('resizes width with clamp constraints', () => {
    probeContext = createContext({ sidebarWidth: 400 })
    render(<ProbeSidebar />)

    const handle = screen.getByRole('separator', { name: /Resize sidebar/i })
    fireEvent.mouseDown(handle, { clientX: 600 })

    fireEvent.mouseMove(document, { clientX: -500 })
    fireEvent.mouseMove(document, { clientX: 1000 })
    fireEvent.mouseUp(document)

    expect(probeContext.setSidebarWidth).toHaveBeenCalledWith(700)
    expect(probeContext.setSidebarWidth).toHaveBeenCalledWith(300)
  })

  it('renders drag overlay when external hover is already true', () => {
    probeContext = createContext({ externalDragHover: true })
    render(<ProbeSidebar />)

    expect(screen.getByText(/Add to Probe 1/i)).toBeInTheDocument()
  })

  it('clears drag-over state on external drag leave (outside and null related target)', () => {
    render(<ProbeSidebar />)
    const sidebar = screen.getByRole('complementary')
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    fireEvent.dragOver(sidebar, {
      dataTransfer: { types: ['application/json'], dropEffect: 'none' },
    })
    expect(screen.getByText(/Add to Probe 1/i)).toBeInTheDocument()

    fireEvent.dragLeave(sidebar, {
      dataTransfer: { types: ['application/json'] },
      relatedTarget: outside,
    })
    expect(screen.queryByText(/Add to Probe 1/i)).not.toBeInTheDocument()

    fireEvent.dragOver(sidebar, {
      dataTransfer: { types: ['application/json'], dropEffect: 'none' },
    })
    expect(screen.getByText(/Add to Probe 1/i)).toBeInTheDocument()

    fireEvent.dragLeave(sidebar, {
      dataTransfer: { types: ['application/json'] },
      relatedTarget: null,
    })
    expect(screen.queryByText(/Add to Probe 1/i)).not.toBeInTheDocument()
  })
})
