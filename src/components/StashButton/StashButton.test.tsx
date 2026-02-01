/**
 * @fileoverview Tests for the StashButton component.
 *
 * Tests cover:
 * - Rendering with different states
 * - Click handling
 * - Disabled state
 * - Already stashed state
 * - Animation on click
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StashButton } from './StashButton'

describe('StashButton', () => {
  describe('rendering', () => {
    it('should render with empty star when not stashed', () => {
      render(<StashButton onClick={() => {}} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('☆')
    })

    it('should render with filled star when stashed', () => {
      render(<StashButton onClick={() => {}} isStashed={true} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('★')
    })

    it('should have correct aria-label', () => {
      render(<StashButton onClick={() => {}} />)
      
      expect(screen.getByLabelText('Add to Stash')).toBeInTheDocument()
    })

    it('should show "Already in Stash" when stashed', () => {
      render(<StashButton onClick={() => {}} isStashed={true} />)
      
      expect(screen.getByLabelText('Already in Stash')).toBeInTheDocument()
    })

    it('should use custom aria-label when provided', () => {
      render(<StashButton onClick={() => {}} ariaLabel="Custom label" />)
      
      expect(screen.getByLabelText('Custom label')).toBeInTheDocument()
    })
  })

  describe('sizes', () => {
    it('should apply small size class', () => {
      const { container } = render(<StashButton onClick={() => {}} size="small" />)
      const button = container.querySelector('button')
      
      // CSS Modules mangles class names, so check for partial match
      expect(button?.className).toMatch(/small/)
    })

    it('should apply medium size class by default', () => {
      const { container } = render(<StashButton onClick={() => {}} />)
      const button = container.querySelector('button')
      
      expect(button?.className).toMatch(/medium/)
    })

    it('should apply large size class', () => {
      const { container } = render(<StashButton onClick={() => {}} size="large" />)
      const button = container.querySelector('button')
      
      expect(button?.className).toMatch(/large/)
    })
  })

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<StashButton onClick={handleClick} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<StashButton onClick={handleClick} disabled={true} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when already stashed', () => {
      const handleClick = vi.fn()
      render(<StashButton onClick={handleClick} isStashed={true} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should stop event propagation', () => {
      const handleClick = vi.fn()
      const handleParentClick = vi.fn()
      
      render(
        <div onClick={handleParentClick}>
          <StashButton onClick={handleClick} />
        </div>
      )
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(handleClick).toHaveBeenCalled()
      expect(handleParentClick).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<StashButton onClick={() => {}} disabled={true} />)
      
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should be disabled when already stashed', () => {
      render(<StashButton onClick={() => {}} isStashed={true} />)
      
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <StashButton onClick={() => {}} className="custom-class" />
      )
      
      expect(container.querySelector('button')).toHaveClass('custom-class')
    })
  })

  describe('tooltip', () => {
    it('should show default tooltip', () => {
      render(<StashButton onClick={() => {}} />)
      
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Add to Stash')
    })

    it('should show custom tooltip', () => {
      render(<StashButton onClick={() => {}} tooltip="Custom tooltip" />)
      
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Custom tooltip')
    })

    it('should show "Already in Stash" tooltip when stashed', () => {
      render(<StashButton onClick={() => {}} isStashed={true} />)
      
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Already in Stash')
    })
  })
})
