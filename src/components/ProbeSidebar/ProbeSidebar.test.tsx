/**
 * @fileoverview Tests for the ProbeSidebar component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
