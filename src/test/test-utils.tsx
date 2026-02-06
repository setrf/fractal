/* eslint-disable react-refresh/only-export-components */

/**
 * Test Utilities
 * ==============
 * 
 * Custom render function and utilities for testing React components.
 * 
 * Features:
 * - Custom render with providers
 * - Detailed logging for LLM analysis
 * - Helper functions for common assertions
 */

import { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StashProvider } from '../context/StashContext'
import { ProbeProvider } from '../context/ProbeContext'
import { ViewModeProvider } from '../context/ViewModeContext'
import { ModelProvider } from '../context/ModelContext'

function Providers({ children }: { children: ReactNode }) {
  return (
    <ViewModeProvider>
      <StashProvider>
        <ProbeProvider>
          <ModelProvider autoLoad={false}>{children}</ModelProvider>
        </ProbeProvider>
      </StashProvider>
    </ViewModeProvider>
  )
}

/**
 * Custom render function that wraps components with necessary providers.
 * Currently no providers needed, but structure is in place for future use.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Providers, ...options }),
  }
}

/**
 * Logs the current state of the DOM for debugging.
 * Useful for LLM agents to understand test state.
 */
function logDOMState(label: string = 'Current DOM State') {
  console.log(`\n=== ${label} ===`)
  console.log(document.body.innerHTML)
  console.log('='.repeat(label.length + 8) + '\n')
}

/**
 * Logs all accessible elements for debugging.
 * Helps LLM agents understand what's available for interaction.
 */
function logAccessibleElements() {
  console.log('\n=== Accessible Elements ===')
  
  const buttons = screen.queryAllByRole('button')
  console.log(`Buttons (${buttons.length}):`, buttons.map(b => b.textContent || b.getAttribute('aria-label')))
  
  const inputs = screen.queryAllByRole('textbox')
  console.log(`Textboxes (${inputs.length}):`, inputs.map(i => i.getAttribute('placeholder') || i.getAttribute('aria-label')))
  
  const headings = screen.queryAllByRole('heading')
  console.log(`Headings (${headings.length}):`, headings.map(h => h.textContent))
  
  console.log('===========================\n')
}

/**
 * Creates a detailed test result object for analysis.
 */
interface TestResult {
  passed: boolean
  description: string
  expected: unknown
  actual: unknown
  details?: string
}

function createTestResult(
  passed: boolean,
  description: string,
  expected: unknown,
  actual: unknown,
  details?: string
): TestResult {
  const result: TestResult = { passed, description, expected, actual, details }
  
  console.log(`\n[TEST RESULT] ${passed ? '✓ PASS' : '✗ FAIL'}: ${description}`)
  console.log(`  Expected: ${JSON.stringify(expected)}`)
  console.log(`  Actual:   ${JSON.stringify(actual)}`)
  if (details) console.log(`  Details:  ${details}`)
  
  return result
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render, userEvent, logDOMState, logAccessibleElements, createTestResult }
