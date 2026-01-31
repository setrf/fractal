# Changelog

All notable changes to Fractal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Comprehensive Testing Infrastructure**
  - Vitest configuration with jsdom environment for React testing
  - Test setup with localStorage and matchMedia mocks
  - Custom render utilities with userEvent integration
  - Detailed logging for LLM agent analysis
  
- **Unit Tests** (`src/types/question.test.ts`)
  - 34 tests covering all utility functions
  - Tests for generateId, createEmptyTree, createQuestionNode
  - Tests for addNodeToTree, getChildren, getPathToNode, getNodeDepth
  
- **Hook Tests** 
  - `useQuestionTree.test.tsx` - 24 tests for tree state management
  - `useTheme.test.tsx` - 14 tests for theme switching and persistence
  
- **Component Tests**
  - `QuestionInput.test.tsx` - 18 tests for input behavior
  - `QuestionNode.test.tsx` - 22 tests for node display and interaction
  
- **Integration Tests** (`App.test.tsx`)
  - 24 tests covering complete user journeys
  - Welcome view rendering
  - Question submission flow
  - Tree interaction (adding children)
  - Reset functionality
  - Theme persistence

### Fixed
- Fixed ESM import error for TypeScript interfaces in `useQuestionTree.ts`
  - Changed `import { QuestionTree, QuestionNode }` to `import type { ... }`
  - This prevents Vite/esbuild from expecting runtime exports for type-only imports

### Planned
- Persistence layer (localStorage)
- AI-generated related questions
- Export/import functionality
- Keyboard navigation enhancements

---

## [0.1.0] - 2026-01-31

### Added

#### Core Application
- Initial React + Vite + TypeScript project scaffold
- Root `App.tsx` component with conditional rendering for input vs. tree views
- Application entry point with global style imports

#### Design System
- **OKLCH Color Tokens** (`src/styles/tokens.css`)
  - Light mode palette: white backgrounds, near-black text
  - Dark mode palette: near-black backgrounds, off-white text
  - Single accent color (red) for error states
  - 5 chart colors reserved for future data visualization
  - Typography tokens for font families, sizes, and spacing
  - Neobrutalist border and spacing tokens

- **CSS Reset** (`src/styles/reset.css`)
  - Modern CSS reset removing default browser styles
  - Neobrutalist focus styles with visible outlines
  - Custom scrollbar styling matching the design system
  - Selection styling with inverted colors

- **Global Styles** (`src/styles/global.css`)
  - Utility classes for typography and borders
  - Root layout configuration

#### Theme System
- **useTheme Hook** (`src/hooks/useTheme.ts`)
  - Three modes: light, dark, system
  - Persists preference to localStorage
  - Respects `prefers-color-scheme` media query
  - Reactive to system theme changes

- **ThemeToggle Component** (`src/components/ThemeToggle/`)
  - Fixed position toggle button
  - Half-moon icon indicating current theme
  - Smooth hover and active states

#### Question Input
- **QuestionInput Component** (`src/components/QuestionInput/`)
  - Centered text input with terminal-style prompt (`?`)
  - Submit button with arrow icon
  - Keyboard support (Enter to submit)
  - Autofocus on mount
  - Neobrutalist shadow effect on focus
  - Hint text below input

#### Question Data Model
- **TypeScript Types** (`src/types/question.ts`)
  - `QuestionNode` interface with id, text, parent/child relationships
  - `QuestionTree` interface with normalized node storage
  - Utility functions:
    - `createEmptyTree()` — Initialize empty tree state
    - `generateId()` — Create unique node identifiers
    - `createQuestionNode()` — Factory for new nodes
    - `addNodeToTree()` — Immutable tree updates
    - `getChildren()` — Retrieve child nodes
    - `getPathToNode()` — Trace ancestry
    - `getNodeDepth()` — Calculate tree depth

- **useQuestionTree Hook** (`src/hooks/useQuestionTree.ts`)
  - `addRootQuestion()` — Create the root node
  - `addChildQuestion()` — Add branching questions
  - `setActiveNode()` — Focus management
  - `toggleNodeExpansion()` — Collapse/expand branches
  - `reset()` — Clear the entire tree

#### Question Visualization
- **QuestionNode Component** (`src/components/QuestionNode/`)
  - Displays question text with `?` prefix
  - Action buttons: expand/collapse, add child
  - Inline child creation form
  - Active state with shadow offset
  - Root node distinguished by thicker border

- **QuestionTree Component** (`src/components/QuestionTree/`)
  - Recursive `TreeBranch` renderer
  - Visual connector lines between nodes
  - CSS-based branch indentation
  - Slide-in animation for new nodes

#### Assets
- Custom SVG favicon (question mark on dark background)
- Google Fonts integration (JetBrains Mono, Inter)

#### Configuration
- Vite configuration with React plugin
- TypeScript strict mode configuration
- ESLint with React hooks plugin
- `.gitignore` for node_modules and build artifacts

### Technical Decisions

#### Why OKLCH?
OKLCH (Oklab Lightness Chroma Hue) is a perceptually uniform color space. Unlike HSL or RGB, equal steps in OKLCH values produce equal perceived changes in color. This is critical for:
- Consistent contrast ratios across the palette
- Predictable hover/active state darkening
- Accessible color combinations

#### Why Normalized Tree Structure?
Storing nodes in a `Record<string, QuestionNode>` instead of nested objects provides:
- O(1) lookups by ID
- Simpler immutable updates (only the modified node changes)
- Easier future serialization/deserialization
- Better React rendering performance (shallow comparison works)

#### Why CSS Modules?
- Scoped class names prevent style conflicts
- Co-located with components for maintainability
- Full CSS feature support (no runtime overhead)
- Easy migration path to other solutions if needed

---

## Repository

- **GitHub**: https://github.com/setrf/fractal
- **Created**: 2026-01-31
- **Author**: setrf

---

[Unreleased]: https://github.com/setrf/fractal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/setrf/fractal/releases/tag/v0.1.0
