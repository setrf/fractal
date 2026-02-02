/**
 * @fileoverview Guided onboarding overlay with spotlight and step card.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styles from './OnboardingOverlay.module.css'

export interface OnboardingStep {
  id: string
  title: string
  body: string
  selector?: string
}

export interface OnboardingOverlayProps {
  isOpen: boolean
  step: OnboardingStep | null
  stepIndex: number
  totalSteps: number
  canProceed?: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onRestart: () => void
  onClose: () => void
}

type Placement = 'right' | 'left' | 'bottom' | 'top' | 'center' | 'floating'

interface CardPosition {
  left: number
  top: number
  placement: Placement
}

const HIGHLIGHT_PADDING = 6
const CARD_GAP = 12
const VIEWPORT_MARGIN = 16

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function OnboardingOverlay({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  canProceed = true,
  onNext,
  onPrev,
  onSkip,
  onRestart,
  onClose,
}: OnboardingOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardPosition, setCardPosition] = useState<CardPosition | null>(null)

  const stepBodyLines = useMemo(() => {
    if (!step?.body) return []
    return step.body.split('\n').map(line => line.trim()).filter(Boolean)
  }, [step?.body])

  const updateTargetRect = useCallback(() => {
    if (!step?.selector) {
      setTargetRect(null)
      return
    }
    const element = document.querySelector(step.selector) as HTMLElement | null
    if (!element) {
      setTargetRect(null)
      return
    }
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setTargetRect(null)
      return
    }
    const outOfView = rect.top < 0 || rect.bottom > window.innerHeight
    if (outOfView && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setTargetRect(rect)
  }, [step?.selector])

  useEffect(() => {
    if (!isOpen) return
    updateTargetRect()
    const handleScroll = () => updateTargetRect()
    const handleResize = () => updateTargetRect()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, updateTargetRect])

  useLayoutEffect(() => {
    if (!isOpen || !step) return
    if (!cardRef.current) return

    const cardRect = cardRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isMobile = viewportWidth <= 768

    if (!targetRect) {
      setCardPosition({
        left: (viewportWidth - cardRect.width) / 2,
        top: isMobile ? 80 : Math.min(120, (viewportHeight - cardRect.height) / 2),
        placement: 'center',
      })
      return
    }

    if (isMobile) {
      // On mobile, if there's a target, try to place it below if it fits, else above, else center bottom
      const spaceBelow = viewportHeight - targetRect.bottom - CARD_GAP - VIEWPORT_MARGIN
      const spaceAbove = targetRect.top - CARD_GAP - VIEWPORT_MARGIN
      
      if (spaceBelow >= cardRect.height) {
        setCardPosition({
          placement: 'bottom',
          left: (viewportWidth - cardRect.width) / 2,
          top: targetRect.bottom + CARD_GAP,
        })
      } else if (spaceAbove >= cardRect.height) {
        setCardPosition({
          placement: 'top',
          left: (viewportWidth - cardRect.width) / 2,
          top: targetRect.top - cardRect.height - CARD_GAP,
        })
      } else {
        setCardPosition({
          placement: 'floating',
          left: (viewportWidth - cardRect.width) / 2,
          top: viewportHeight - cardRect.height - VIEWPORT_MARGIN - 60, // Above typical mobile bottom controls
        })
      }
      return
    }

    const candidates: CardPosition[] = [
      {
        placement: 'right',
        left: targetRect.right + CARD_GAP,
        top: targetRect.top,
      },
      {
        placement: 'left',
        left: targetRect.left - cardRect.width - CARD_GAP,
        top: targetRect.top,
      },
      {
        placement: 'bottom',
        left: targetRect.left,
        top: targetRect.bottom + CARD_GAP,
      },
      {
        placement: 'top',
        left: targetRect.left,
        top: targetRect.top - cardRect.height - CARD_GAP,
      },
    ]

    const fits = (candidate: CardPosition) => {
      const withinLeft = candidate.left >= VIEWPORT_MARGIN
      const withinRight = candidate.left + cardRect.width <= viewportWidth - VIEWPORT_MARGIN
      const withinTop = candidate.top >= VIEWPORT_MARGIN
      const withinBottom = candidate.top + cardRect.height <= viewportHeight - VIEWPORT_MARGIN
      return withinLeft && withinRight && withinTop && withinBottom
    }

    const preferred = candidates.find(fits)
    if (preferred) {
      setCardPosition(preferred)
      return
    }

    const fallbackLeft = clamp(targetRect.left, VIEWPORT_MARGIN, viewportWidth - cardRect.width - VIEWPORT_MARGIN)
    const fallbackTop = clamp(targetRect.bottom + CARD_GAP, VIEWPORT_MARGIN, viewportHeight - cardRect.height - VIEWPORT_MARGIN)
    setCardPosition({
      left: fallbackLeft,
      top: fallbackTop,
      placement: 'floating',
    })
  }, [isOpen, step, targetRect])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1
  const nextLabel = isLast ? 'Finish' : 'Next'

  const highlightStyle = targetRect
    ? {
        left: targetRect.left - HIGHLIGHT_PADDING,
        top: targetRect.top - HIGHLIGHT_PADDING,
        width: targetRect.width + HIGHLIGHT_PADDING * 2,
        height: targetRect.height + HIGHLIGHT_PADDING * 2,
      }
    : undefined

  return (
    <div className={styles.overlay} aria-live="polite" aria-label="Onboarding tour">
      {targetRect ? (
        <div className={styles.highlight} style={highlightStyle} />
      ) : (
        <div className={styles.scrim} />
      )}

      <div
        ref={cardRef}
        className={styles.card}
        data-placement={cardPosition?.placement || 'center'}
        style={
          cardPosition
            ? { left: cardPosition.left, top: cardPosition.top }
            : undefined
        }
      >
        <div className={styles.header}>
          <div>
            <p className={styles.stepCount}>
              Step {stepIndex + 1} / {totalSteps}
            </p>
            <h3 className={styles.title}>{step.title}</h3>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close onboarding">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {stepBodyLines.map((line, index) => (
            <p key={`${step.id}-${index}`}>{line}</p>
          ))}
        </div>

        <div className={styles.controls}>
          <div className={styles.leftActions}>
            <button className={styles.button} onClick={onRestart}>
              Restart
            </button>
            <button className={styles.buttonGhost} onClick={onSkip}>
              Skip
            </button>
          </div>
          <div className={styles.rightActions}>
            {!isFirst && (
              <button className={styles.buttonGhost} onClick={onPrev}>
                Back
              </button>
            )}
            <button
              className={styles.buttonPrimary}
              onClick={onNext}
              disabled={!canProceed}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
