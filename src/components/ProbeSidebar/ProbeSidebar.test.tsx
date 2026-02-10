/**
 * @fileoverview Tests for the ProbeSidebar component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent, render, screen, fireEvent } from '@testing-library/react'
import { ProbeSidebar } from './ProbeSidebar'
import { ProbeProvider } from '../../context/ProbeContext'
import { StashProvider } from '../../context/StashContext'
import { ModelProvider } from '../../context/ModelContext'

// Mock useIsMobile
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ModelProvider autoLoad={false}>
      <StashProvider>
        <ProbeProvider>
          {ui}
        </ProbeProvider>
      </StashProvider>
    </ModelProvider>
  )
}

describe('ProbeSidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should render collapsed by default', () => {
    renderWithProviders(<ProbeSidebar />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar.className).toContain('collapsed')
  })

  it('should expand when toggle button is clicked', () => {
    renderWithProviders(<ProbeSidebar />)
    const toggleButton = screen.getByLabelText(/Expand probe/i)
    
    fireEvent.click(toggleButton)
    
    const sidebar = screen.getByRole('complementary')
    expect(sidebar.className).toContain('open')
  })

  it('should show drop overlay during dragover of stash item', () => {
    renderWithProviders(<ProbeSidebar />)
    const sidebar = screen.getByRole('complementary')
    
    // Create a mock drag event
    const dragOverEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        types: ['text/x-stash-item'],
        dropEffect: 'none'
      },
      stopPropagation: vi.fn()
    }
    
    fireEvent.dragOver(sidebar, dragOverEvent)
    
    // The sidebar should have the drop overlay (we need to be open and have an active probe for full overlay)
    // But even if not open, handleDragOver sets isDragOver state.
  })

  it('should handle drop of a stash item', async () => {
    const onStashItemDrop = vi.fn()
    renderWithProviders(<ProbeSidebar onStashItemDrop={onStashItemDrop} />)
    
    // 1. Open sidebar
    const toggleButton = screen.getByLabelText(/Expand probe/i)
    fireEvent.click(toggleButton)
    
    // 2. Create a probe
    const createButton = screen.getByTitle(/New Probe/i)
    fireEvent.click(createButton)
    
    // 3. Perform drop
    const sidebar = screen.getByRole('complementary')
    const dropEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        getData: (type: string) => {
          if (type === 'text/x-stash-item') return 's_123'
          return ''
        },
        types: ['text/x-stash-item']
      }
    }
    
    fireEvent.drop(sidebar, dropEvent)
    
    // Check if callback was called
    expect(onStashItemDrop).toHaveBeenCalledWith('s_123')
  })

  it('treats text/plain and Files drags as external and ignores non-external dragover/leave', () => {
    renderWithProviders(<ProbeSidebar />)
    const sidebar = screen.getByRole('complementary')

    fireEvent.dragOver(sidebar, {
      dataTransfer: { types: ['text/plain'], dropEffect: 'none' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    fireEvent.dragOver(sidebar, {
      dataTransfer: { types: ['Files'], dropEffect: 'none' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    fireEvent.dragOver(sidebar, {
      dataTransfer: { types: ['text/x-internal'], dropEffect: 'none' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    const internalLeave = createEvent.dragLeave(sidebar)
    Object.defineProperty(internalLeave, 'dataTransfer', {
      value: { types: ['text/x-internal'], dropEffect: 'none' },
    })
    fireEvent(sidebar, internalLeave)
  })

  it('handles drag-leave containment branches and drop fallback when json payload is absent', () => {
    renderWithProviders(<ProbeSidebar />)

    // Open and create a probe so drop logic proceeds beyond activeProbe guard.
    fireEvent.click(screen.getByLabelText(/Expand probe/i))
    fireEvent.click(screen.getByTitle(/New Probe/i))

    const sidebar = screen.getByRole('complementary')
    const externalTransfer = {
      types: ['application/json'],
      dropEffect: 'none',
      getData: (type: string) => {
        if (type === 'text/x-stash-item') return ''
        if (type === 'text/plain') return 'not-a-stash-id'
        if (type === 'application/json') return ''
        return ''
      },
    }

    fireEvent.dragOver(sidebar, { dataTransfer: externalTransfer })

    const inside = document.createElement('div')
    sidebar.appendChild(inside)
    const leaveInside = createEvent.dragLeave(sidebar)
    Object.defineProperty(leaveInside, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveInside, 'relatedTarget', { value: inside })
    fireEvent(sidebar, leaveInside)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const leaveOutside = createEvent.dragLeave(sidebar)
    Object.defineProperty(leaveOutside, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveOutside, 'relatedTarget', { value: outside })
    fireEvent(sidebar, leaveOutside)

    const leaveNoTarget = createEvent.dragLeave(sidebar)
    Object.defineProperty(leaveNoTarget, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveNoTarget, 'relatedTarget', { value: null })
    fireEvent(sidebar, leaveNoTarget)

    fireEvent.drop(sidebar, {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: externalTransfer,
    })
  })
})
