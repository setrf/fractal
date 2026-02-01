/**
 * @fileoverview Tests for the OnboardingOverlay component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnboardingOverlay, type OnboardingStep } from './OnboardingOverlay'

describe('OnboardingOverlay', () => {
  it('renders step content and disables next when blocked', () => {
    const step: OnboardingStep = {
      id: 'welcome',
      title: 'Welcome to Fractal',
      body: 'Line one.\nLine two.',
    }

    render(
      <OnboardingOverlay
        isOpen={true}
        step={step}
        stepIndex={0}
        totalSteps={3}
        canProceed={false}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Welcome to Fractal')).toBeInTheDocument()
    expect(screen.getByText('Line one.')).toBeInTheDocument()
    expect(screen.getByText('Line two.')).toBeInTheDocument()
    expect(screen.getByText('Step 1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
