/**
 * @fileoverview Application entry point.
 * 
 * This file bootstraps the React application:
 * 1. Imports global styles (tokens, reset, utilities)
 * 2. Creates the React root
 * 3. Renders the App component in StrictMode
 * 
 * StrictMode is enabled to catch potential issues during development:
 * - Double-invoking component functions to detect side effects
 * - Warning about deprecated APIs
 * - Detecting unexpected side effects
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'

// Ensure THREE is globally available for some older/bundled libraries
if (typeof window !== 'undefined') {
  ;(window as Window & { THREE?: typeof THREE }).THREE = THREE
}

// Global styles must be imported before App
// Order: tokens.css -> reset.css -> global.css (via global.css imports)
import './styles/global.css'

import App from './App.tsx'

// Create React root and render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
