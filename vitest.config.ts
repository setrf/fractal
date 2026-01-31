/**
 * Vitest Configuration
 * ====================
 * 
 * Configuration for the Vitest test runner.
 * 
 * Features:
 * - jsdom environment for React component testing
 * - React plugin for JSX support
 * - Coverage reporting with v8
 * - Verbose output for LLM agent analysis
 * - Global test utilities setup
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for DOM simulation
    environment: 'jsdom',
    
    // Global setup file for test utilities
    setupFiles: ['./src/test/setup.ts'],
    
    // Include test files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    
    // Verbose output for detailed analysis
    reporters: ['verbose'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
    
    // Globals for describe, it, expect without imports
    globals: true,
  },
})
