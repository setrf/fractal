import { useState, useEffect } from 'react'

export const MOBILE_BREAKPOINT = 768

type MobileWindowLike = Pick<Window, 'innerWidth' | 'addEventListener' | 'removeEventListener'>

export function resolveMobileWindow(): MobileWindowLike | null {
  if (typeof window === 'undefined') return null
  return window
}

export function computeIsMobile(width: number): boolean {
  return width <= MOBILE_BREAKPOINT
}

export function getInitialIsMobile(mobileWindow: Pick<MobileWindowLike, 'innerWidth'> | null = resolveMobileWindow()): boolean {
  return mobileWindow ? computeIsMobile(mobileWindow.innerWidth) : false
}

/**
 * Hook to detect if the current viewport is mobile-sized.
 * Returns true if window width is <= 768px.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => getInitialIsMobile())

  useEffect(() => {
    const mobileWindow = resolveMobileWindow() as MobileWindowLike

    const handleResize = () => {
      setIsMobile(computeIsMobile(mobileWindow.innerWidth))
    }

    mobileWindow.addEventListener('resize', handleResize)

    // Initial check
    handleResize()

    return () => mobileWindow.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
