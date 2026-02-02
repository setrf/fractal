/**
 * MobileHeader Component Tests
 * ===========================
 * 
 * Tests for the MobileHeader component.
 * Covers rendering, interaction with contexts, and menu actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import { MobileHeader } from './MobileHeader'

describe('MobileHeader', () => {
  const defaultProps = {
    onOpenOnboarding: vi.fn(),
    onCreateNote: vi.fn(),
    onMinimizeAll: vi.fn(),
    onCloseAll: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the title', () => {
    render(<MobileHeader {...defaultProps} />)
    expect(screen.getByText('Fractal')).toBeInTheDocument()
  })

  it('should render core navigation buttons', () => {
    render(<MobileHeader {...defaultProps} />)
    expect(screen.getByLabelText('Toggle stash')).toBeInTheDocument()
    expect(screen.getByLabelText('Toggle view mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Toggle probe')).toBeInTheDocument()
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })

  it('should open settings menu when menu button clicked', () => {
    render(<MobileHeader {...defaultProps} />)
    
    fireEvent.click(screen.getByLabelText('Open menu'))
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Minimize All')).toBeInTheDocument()
    expect(screen.getByText('Close All')).toBeInTheDocument()
  })

  it('should call onCreateNote and close menu when "New Note" is clicked', () => {
    const onCreateNote = vi.fn()
    render(<MobileHeader {...defaultProps} onCreateNote={onCreateNote} />)
    
    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    
    // Click New Note
    fireEvent.click(screen.getByText('New Note'))
    
    expect(onCreateNote).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('should call onMinimizeAll and close menu when "Minimize All" is clicked', () => {
    const onMinimizeAll = vi.fn()
    render(<MobileHeader {...defaultProps} onMinimizeAll={onMinimizeAll} />)
    
    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    
    // Click Minimize All
    fireEvent.click(screen.getByText('Minimize All'))
    
    expect(onMinimizeAll).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('should call onOpenOnboarding and close menu when "Help & Onboarding" is clicked', () => {
    const onOpenOnboarding = vi.fn()
    render(<MobileHeader {...defaultProps} onOpenOnboarding={onOpenOnboarding} />)
    
    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    
    // Click Help
    fireEvent.click(screen.getByText('Help & Onboarding'))
    
    expect(onOpenOnboarding).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('should close menu when overlay is clicked', () => {
    render(<MobileHeader {...defaultProps} />)
    
    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Settings')).toBeInTheDocument()
    
    // Click backdrop (the overlay div)
    // Find the overlay by its role or just by its relationship to the menu
    const overlay = screen.getByText('Settings').closest('[class*="menuOverlay"]')
    if (overlay) {
      fireEvent.click(overlay)
    }
    
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })
})
