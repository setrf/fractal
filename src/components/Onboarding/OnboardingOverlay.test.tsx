/**
 * @fileoverview Tests for the OnboardingOverlay component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OnboardingOverlay, type OnboardingStep } from './OnboardingOverlay'

describe('OnboardingOverlay', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
  })

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

  it('returns null when closed or step is missing', () => {
    const { rerender } = render(
      <OnboardingOverlay
        isOpen={false}
        step={{ id: 'a', title: 'A', body: 'B' }}
        stepIndex={0}
        totalSteps={1}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(/onboarding tour/i)).not.toBeInTheDocument()

    rerender(
      <OnboardingOverlay
        isOpen={true}
        step={null}
        stepIndex={0}
        totalSteps={1}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(/onboarding tour/i)).not.toBeInTheDocument()
  })

  it('handles button interactions and Escape key close', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const onSkip = vi.fn()
    const onRestart = vi.fn()
    const onClose = vi.fn()
    const step: OnboardingStep = {
      id: 'actions',
      title: 'Actions',
      body: 'Body',
    }

    render(
      <OnboardingOverlay
        isOpen={true}
        step={step}
        stepIndex={1}
        totalSteps={3}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onRestart={onRestart}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /close onboarding/i }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows finish label on the last step', () => {
    const step: OnboardingStep = {
      id: 'last',
      title: 'Last',
      body: 'Body',
    }

    render(
      <OnboardingOverlay
        isOpen={true}
        step={step}
        stepIndex={2}
        totalSteps={3}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
  })

  it('targets selector elements, triggers scroll into view when out of viewport, and computes placement', () => {
    const target = document.createElement('div')
    target.id = 'onboarding-target'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    const targetRect = {
      x: 100,
      y: -20,
      width: 120,
      height: 70,
      top: -20,
      left: 100,
      right: 220,
      bottom: 50,
      toJSON: () => ({}),
    }

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'onboarding-target') {
        return targetRect as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        top: 0,
        left: 0,
        right: 280,
        bottom: 160,
        toJSON: () => ({}),
      } as DOMRect
    })

    render(
      <OnboardingOverlay
        isOpen={true}
        step={{
          id: 'targeted',
          title: 'Targeted',
          body: 'Body',
          selector: '#onboarding-target',
        }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const card = screen.getByText('Targeted').closest('div[data-placement]')
    expect(card).toHaveAttribute('data-placement', 'bottom')
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(document.querySelector('div[style*="width"]')).toBeInTheDocument()
  })

  it('clears target rect when selector is missing or has zero-size rect', () => {
    const getRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    getRectSpy.mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    }) as DOMRect)

    const { rerender } = render(
      <OnboardingOverlay
        isOpen={true}
        step={{ id: 'missing', title: 'Missing', body: 'Body', selector: '#nope' }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Missing').closest('div[data-placement]')).toHaveAttribute('data-placement', 'center')

    const zero = document.createElement('div')
    zero.id = 'zero-target'
    document.body.appendChild(zero)
    rerender(
      <OnboardingOverlay
        isOpen={true}
        step={{ id: 'zero', title: 'Zero', body: 'Body', selector: '#zero-target' }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Zero').closest('div[data-placement]')).toHaveAttribute('data-placement', 'center')
  })

  it('prefers right placement on desktop when the target is fully in view', () => {
    const target = document.createElement('div')
    target.id = 'desktop-target'
    document.body.appendChild(target)

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'desktop-target') {
        return {
          x: 120,
          y: 100,
          width: 120,
          height: 70,
          top: 100,
          left: 120,
          right: 240,
          bottom: 170,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        top: 0,
        left: 0,
        right: 280,
        bottom: 160,
        toJSON: () => ({}),
      } as DOMRect
    })

    render(
      <OnboardingOverlay
        isOpen={true}
        step={{
          id: 'desktop',
          title: 'Desktop',
          body: 'Body',
          selector: '#desktop-target',
        }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Desktop').closest('div[data-placement]')).toHaveAttribute('data-placement', 'right')
  })

  it('computes mobile top/floating placement when space is limited', async () => {
    const target = document.createElement('div')
    target.id = 'mobile-target'
    document.body.appendChild(target)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })

    const getRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    getRectSpy.mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'mobile-target') {
        return {
          x: 40,
          y: 400,
          width: 120,
          height: 220,
          top: 400,
          left: 40,
          right: 160,
          bottom: 620,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 300,
        height: 180,
        top: 0,
        left: 0,
        right: 300,
        bottom: 180,
        toJSON: () => ({}),
      } as DOMRect
    })

    const { rerender } = render(
      <OnboardingOverlay
        isOpen={true}
        step={{
          id: 'mobile',
          title: 'Mobile',
          body: 'Body',
          selector: '#mobile-target',
        }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Mobile').closest('div[data-placement]')).toHaveAttribute('data-placement', 'top')

    getRectSpy.mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'mobile-target') {
        return {
          x: 20,
          y: 100,
          width: 120,
          height: 500,
          top: 100,
          left: 20,
          right: 140,
          bottom: 600,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 300,
        height: 180,
        top: 0,
        left: 0,
        right: 300,
        bottom: 180,
        toJSON: () => ({}),
      } as DOMRect
    })

    rerender(
      <OnboardingOverlay
        isOpen={true}
        step={{
          id: 'mobile',
          title: 'Mobile',
          body: 'Body',
          selector: '#mobile-target',
        }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(screen.getByText('Mobile').closest('div[data-placement]')).toHaveAttribute('data-placement', 'floating')
    })
  })

  it('uses mobile bottom placement when there is enough space below target', () => {
    const target = document.createElement('div')
    target.id = 'mobile-bottom-target'
    document.body.appendChild(target)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 760 })

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'mobile-bottom-target') {
        return {
          x: 24,
          y: 80,
          width: 120,
          height: 80,
          top: 80,
          left: 24,
          right: 144,
          bottom: 160,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 220,
        height: 140,
        top: 0,
        left: 0,
        right: 220,
        bottom: 140,
        toJSON: () => ({}),
      } as DOMRect
    })

    render(
      <OnboardingOverlay
        isOpen={true}
        step={{ id: 'mobile-bottom', title: 'Mobile Bottom', body: 'Body', selector: '#mobile-bottom-target' }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Mobile Bottom').closest('div[data-placement]')).toHaveAttribute('data-placement', 'bottom')
  })

  it('falls back to clamped floating placement when desktop candidates do not fit', () => {
    const target = document.createElement('div')
    target.id = 'desktop-fallback-target'
    document.body.appendChild(target)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 320 })

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
      if ((this as HTMLElement).id === 'desktop-fallback-target') {
        return {
          x: 870,
          y: 260,
          width: 20,
          height: 40,
          top: 260,
          left: 870,
          right: 890,
          bottom: 300,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        width: 320,
        height: 220,
        top: 0,
        left: 0,
        right: 320,
        bottom: 220,
        toJSON: () => ({}),
      } as DOMRect
    })

    render(
      <OnboardingOverlay
        isOpen={true}
        step={{ id: 'desktop-fallback', title: 'Desktop Fallback', body: 'Body', selector: '#desktop-fallback-target' }}
        stepIndex={0}
        totalSteps={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onRestart={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Desktop Fallback').closest('div[data-placement]')).toHaveAttribute('data-placement', 'floating')
  })
})
