# Changelog

All notable changes to Fractal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Streaming responses for real-time feedback
- Keyboard navigation enhancements
- Model selection UI
- Concept sub-trees (expand concepts into exploration branches)

---

## [0.7.4] - 2026-02-02

### Added

#### Probe UI/UX Overhaul
- **Auto-Formatting Markdown Input**: Implemented a unified text box in the Probe sidebar that automatically toggles between a raw text editor (on focus) and a rendered Markdown view (on blur/synthesis).
- **Advanced Vertical Resizability**:
  - Replaced standard bottom-right resize with a custom top-edge grab handle.
  - Increased default height to 480px (triple the previous size).
  - Expanded maximum height to 1000px for long-form synthesis.
- **Improved Synthesis Formatting**: Added explicit line breaks before section headers in synthesized prompts for better readability.

#### Core Stability
- **Resilient Drag-and-Drop**: Fixed issues where sidebar overlays would block drag events; added `pointer-events: none` and improved data-type detection for smoother Stash-to-Probe transfers.
- **Enhanced Test Suite**: Added `ProbeSidebar.test.tsx` and mocked `scrollIntoView` globally to improve frontend test coverage and reliability.

---

## [0.7.3] - 2026-02-01

### Added

#### Mobile Optimization
- **MobileHeader Component**: Consolidated top-level navigation (Stash, View Mode, Probe, Menu) into a fixed header for mobile devices.
- **Responsive Popup Stacking**: Implemented an offset-based stacking system for minimized popups on mobile, preventing overlap and ensuring accessibility.
- **Compact Generation Metadata**: Redesigned the Weave Score and model info to fit narrow mobile screens with multi-line layouts.
- **Adaptive Question Nodes**: Optimized quality badges and tap targets for better touch interaction and screen utilization on mobile.
- **Smart Sidebar Overlays**: Ensured sidebars (Stash/Probe) behave as full-screen overlays on mobile with exclusive states (one at a time).

#### 3D Graph Refinement
- **Interactive Geometries**: Updated 3D nodes to use distinct shapes (Sphere, Icosahedron, Box, Torus) synchronized with the legend.
- **Unified Legend & Filters**: Merged graph legend and visibility toggles into a single, efficient control section.
- **Enhanced Relationship Visuals**: Added directional arrows to edges and improved hover precision for tracing connections.
- **Non-blocking Detail Popups**: Removed interaction-blocking backdrops from node details, allowing 3D exploration while reading metadata.
- **Subtle 3D Labeling**: Significantly reduced 3D tag sizes and refined typography for a cleaner, high-density visualization.

### Fixed
- Fixed redundant "Fractal" branding on mobile content screens.
- Fixed layout obstructions where sidebars would hide essential mobile navigation.
- Fixed 3D background click handling to fluidly dismiss open popups.

---

## [0.7.2] - 2026-02-01

### Added

#### Advanced Graph Dynamics
- **Unified Controls Group**: Moved graph settings (⚙) into the primary camera control cluster for better visibility and layout stability.
- **Global Force Management**: Migrated graph physics parameters to `GraphContext`, ensuring the 3D simulation and UI stay in perfect sync.
- **Expanded Dynamics Controls**:
  - **Distance**: Fine-tune link spacing.
  - **Repulsion**: Adjust global separation pressure.
  - **Gravity**: Control the centering pull strength.
  - **Friction**: Adjust velocity decay for faster stabilization.
  - **Visual Scale**: Global multiplier for node and label sizes.
- **Physics Stabilization**: Implemented a power-scaled relationship between distance and repulsion to prevent "drifting" and ensure structural integrity at extreme settings.

#### 3D Visual Refinement
- **Automatic Label Wrapping**: Implemented a smart label wrapper that keeps long question text fully legible in 3D space without truncation.
- **Information Density Tuning**: Reduced default node and text sizes for a more sophisticated, "diagrammatic" aesthetic.
- **Visual Scale multiplier**: Dynamically resize all 3D entities via the control panel.

---

## [0.7.1] - 2026-02-01

### Added

#### 3D View Polish
- **Advanced Post-processing**: Enabled `UnrealBloomPass` for visual depth and "wow" factor.
- **Node Labels**: Implemented `SpriteText` labels for all nodes, showing truncated content/title.
- **Enhanced Geometries**: Unique 3D shapes for each entity type:
  - Questions: High-detail Spheres
  - Concepts: Icosahedrons
  - Stash Items: Boxes
  - Probes: Tori
- **Improved Materials**: Switched to `MeshPhongMaterial` with shininess for better light interaction.

---

## [0.7.0] - 2026-01-31

### Added

#### 3D Knowledge Graph View
An alternative visualization mode displaying all entities (Questions, Concepts, Stash Items, Probes) as interconnected nodes in a 3D force-directed graph with relationship-based clustering.

- **ViewModeToggle Component** (`src/components/ViewModeToggle/`)
  - Fixed position button next to ThemeToggle
  - Switches between traditional tree view and 3D graph view
  - Visual indicator for current mode
  - Persists preference to localStorage

- **GraphView Component** (`src/components/GraphView/`)
  - Full 3D visualization using react-force-graph-3d
  - Custom Three.js node rendering per entity type:
    - Questions: Spheres with emissive glow
    - Concepts: Icosahedrons with flat shading
    - Stash Items: Cubes
    - Probes: Tori (donut shapes)
  - Force-directed layout with relationship-based clustering
  - Interactive zoom, pan, and rotate controls
  - Click nodes to focus camera and show details
  - Stats overlay showing entity counts

- **GraphControls Component** (`src/components/GraphControls/`)
  - Camera controls (reset, zoom in/out)
  - Node type visibility filters (checkboxes)
  - Legend with color and shape indicators
  - Keyboard shortcuts hint (Drag, Scroll, Click)

- **GraphNodePopup Component** (`src/components/GraphNodePopup/`)
  - Floating popup on node click
  - Content adapts to node type:
    - Questions: Full text, child count, Deep Dive/Chat actions
    - Concepts: Name, category, explanation preview
    - Stash Items: Content preview, type badge
    - Probes: Name, color, message count

#### Graph Data Layer
- **Graph Types** (`src/types/graph.ts`)
  - `GraphNode` interface with type, label, data, color, size, group
  - `GraphEdge` interface with source, target, type, strength
  - `GraphNodeType`: question, concept, stash, probe
  - `GraphEdgeType`: question-child, question-concept, concept-related, stash-source, probe-stash
  - `ViewMode`: traditional | graph
  - `GraphFilters` for node visibility control
  - Constants for sizing, widths, strengths

- **useGraphData Hook** (`src/hooks/useGraphData.ts`)
  - Aggregates data from question tree, concepts, stash, and probes
  - Transforms entities into graph nodes with visual properties
  - Builds edges based on relationships
  - Deduplicates concepts by normalized name
  - Supports filtering by node type
  - Memoized computation for performance

- **useViewMode Hook** (`src/hooks/useViewMode.ts`)
  - Manages traditional/graph view state
  - Persists to localStorage
  - Applies data-view-mode attribute to document
  - toggleViewMode() convenience function

- **GraphContext** (`src/context/GraphContext.tsx`)
  - Provides graph data globally
  - Includes filter state and controls
  - toggleNodeType() and resetFilters() functions

#### Edge Types and Relationships
- **question-child**: Tree structure between questions (strongest clustering)
- **question-concept**: Links questions to their extracted concepts
- **concept-related**: Connects related concepts
- **stash-source**: Links stash items to their source entities
- **probe-stash**: Connects probes to their selected stash items

#### Visual Design
- Node colors match existing design tokens (OKLCH)
- Edge widths and colors vary by relationship type
- Dark mode support via CSS custom properties
- Neobrutalist styling on overlay controls
- Graph background matches app theme

#### Tests
- `useViewMode.test.tsx` - 11 tests for view mode state management
- `useGraphData.test.tsx` - 13 tests for graph data aggregation
- `graph.test.ts` - 16 tests for type utilities and constants

### Dependencies Added
- `react-force-graph-3d` - 3D force-directed graph visualization
- `three` - Three.js for 3D rendering
- `@types/three` - TypeScript definitions

---

## [0.6.0] - 2026-01-31

### Added

#### The Probe - Synthesis-Focused Conversations
A major new feature enabling users to synthesize their collected Stash items into focused LLM conversations. Completes the Fractal journey: Seed → Branch → Collect → Synthesize.

- **ProbeSidebar Component** (`src/components/ProbeSidebar/`)
  - Collapsible right panel (400px expanded, 48px collapsed)
  - Smooth slide animation for open/close
  - Fixed position, symmetrical to StashSidebar
  - Resizable width (300px-700px)
  - Drag-and-drop zone for receiving Stash items

- **ProbeTabBar Component** (`src/components/ProbeTabBar/`)
  - Horizontal tabs with color indicators
  - Maximum 5 probes (one per distinct color)
  - Create new probe via "+" button
  - Delete probe via "×" button on tab
  - Inline rename via double-click
  - Context menu on right-click

- **ProbeChat Component** (`src/components/ProbeChat/`)
  - Message history display with user/assistant distinction
  - Selected Stash items shown as context pills
  - "Synthesize" button to generate prompt from context
  - Fully editable textarea for prompts
  - Auto-scroll to latest messages
  - Loading indicator during LLM calls

#### Probe Features
- **Multi-probe support** - Up to 5 concurrent probes with distinct colors (blue, green, yellow, purple, orange)
- **Color-coded visual system** - Each probe has a unique color shown in tabs, badges, and borders
- **Stash item selection** - Select items via checkboxes (when Probe is open) or drag-and-drop
- **Multi-assignment** - Stash items can be assigned to multiple probes simultaneously
- **Prompt synthesis** - Auto-generates structured prompts from selected context
- **Editable prompts** - Users can modify synthesized prompts before sending
- **Persistent conversations** - Probe conversations stored in localStorage
- **Dedicated system prompt** - LLM optimized for synthesis and insight-weaving

#### Stash Integration
- **Checkbox selection** - Stash items show checkboxes when Probe sidebar is open
- **Color-coded badges** - Small colored dots on Stash items indicate probe assignments
- **Drag-to-Probe** - Drag Stash items directly onto Probe sidebar
- **Overlay feedback** - "Add to [Probe Name]" overlay during drag

#### Backend Enhancements
- **POST /api/probe/chat** - New endpoint for probe conversations
- **PROBE_SYSTEM_PROMPT** - Synthesis-focused system prompt for insight weaving
- **Context builder** - Structures Stash items into coherent prompt sections

#### State Management
- **useProbe Hook** (`src/hooks/useProbe.ts`)
  - Probe CRUD operations (create, delete, rename)
  - Message management (add, update, clear)
  - Stash item selection (add, remove, toggle)
  - Prompt synthesis logic
  - localStorage persistence with debouncing

- **ProbeContext** (`src/context/ProbeContext.tsx`)
  - Global probe state access
  - Provider pattern for dependency injection

#### Type Definitions
- **Probe** - Core probe interface with id, name, color, messages, selectedStashItemIds
- **ProbeMessage** - Message type with id, role, content, timestamp, sourceStashItemIds
- **ProbeColor** - Union type for the 5 available colors
- Utility functions for ID generation, validation, color management

#### Layout Updates
- **Symmetrical design** - Stash (left) and Probe (right) sidebars
- **CSS variables** - `--probe-width-expanded`, `--probe-width-collapsed`
- **Layout classes** - `probe-open`, `probe-collapsed` for margin adjustments
- **Dual sidebar support** - Main content adjusts for both sidebars

### Fixed

- **Theme toggle and Note button** now visible in Chat view
- **Concept index validation** - Misaligned indices from LLM auto-corrected
- **Popup resize position bug** - Popups stay in place during resize
- **First chat message highlight placement** - Uses "closest occurrence" algorithm
- **Markdown with highlights** - New component preserves markdown while placing highlights

---

## [0.5.0] - 2026-02-01

### Added

#### The Stash - Intellectual Collection Feature
A dedicated sidebar for collecting and organizing excerpts, highlights, and concepts encountered during exploration.

- **StashSidebar Component** (`src/components/StashSidebar/`)
  - Collapsible left panel (320px expanded, 48px collapsed)
  - Smooth slide animation for open/close
  - Fixed position, always accessible
  - Item count badge when collapsed
  - Drag-and-drop zone for adding items

- **StashItem Component** (`src/components/StashItem/`)
  - Renders individual stashed content
  - Type indicator with icon and color accent
  - Truncated preview with expand on click
  - Timestamp display
  - Delete button

- **StashButton Component** (`src/components/StashButton/`)
  - Reusable add-to-stash button
  - Star icon (☆/★) with visual feedback
  - Size variants (small, medium, large)
  - "Already stashed" state

#### Stash Content Types
- **Highlights** - Extracted or user-created concept highlights
- **Explanations** - Concept explanations from popups
- **Questions** - Questions from the exploration tree
- **Chat Messages** - Messages from chat conversations
- **Notes** - User-written custom notes

#### Stash Features
- **Browser localStorage persistence** - Data persists across sessions
- **Filtering by type** - Quick filter tabs for each content type
- **Search functionality** - Search across all stashed content
- **JSON export** - Download stash as JSON file
- **Clear all** - Remove all items with confirmation
- **Note creation** - Add custom notes with optional titles
- **Duplicate prevention** - Won't stash the same item twice

#### Integration Points
- **ConceptPopup** - Stash button in popup header to save explanations
- **QuestionNode** - Stash button in action buttons to save questions
- **ConceptHighlighter** - Remove button on highlights
- **ChatView** - Stash button on messages (hover reveal)

#### Drag-and-Drop Support
- Drag questions, messages, or popup content to the stash
- Visual feedback during drag-over state
- JSON data transfer format

#### State Management
- **useStash Hook** (`src/hooks/useStash.ts`)
  - CRUD operations (add, remove, update, clear)
  - localStorage persistence with debouncing
  - Filtering and search
  - JSON export/import
  - Duplicate detection
  
- **StashContext** (`src/context/StashContext.tsx`)
  - Global stash access via React Context
  - StashProvider wrapper component

#### Design System Updates
- **Stash tokens** added to `tokens.css`
  - Width variables for expanded/collapsed states
  - Type-specific accent colors
- **App layout** updated in `global.css`
  - New `.app-layout` flexbox container
  - Margin adjustment when sidebar is open/collapsed

#### Tests
- `useStash.test.tsx` - Comprehensive hook tests (CRUD, filtering, search, persistence)
- `StashButton.test.tsx` - Component rendering and interaction tests
- `stash.test.ts` - Type utility function tests

---

## [0.4.0] - 2026-02-01

### Added

#### Popup Content Highlighting
- **"✦" Extract Button** in popup header
  - Triggers AI concept extraction for popup content (summary + context)
  - Shows loading animation during extraction
  - Changes to "extracted" state after successful extraction
- **Highlighted concepts in popup text**
  - Both summary and context sections support highlighting
  - Clicking highlighted concept opens new popup
  - Uses same ConceptHighlighter component for consistency
- **Manual text selection in popups**
  - Select text in popup content to create instant highlights
  - No intermediate confirmation step
  - Works the same as in question nodes

#### Smart Popup Positioning
- **Non-overlapping popup placement**
  - New popups automatically position to avoid existing ones
  - Tries multiple strategies: right, below, left, cascade
  - Minimized popups excluded from overlap detection
- **Minimized popup stacking**
  - Minimized popups stack in lower-right corner
  - Proper spacing to prevent occlusion
  - Smooth animation transitions

#### UX Improvements
- **Auto-highlight on text selection** - Manual highlights created instantly
- **Duplicate popup prevention** - Won't open same concept twice
- **Related concept click** - Clicking RELATED items opens new popup
- **Improved resize handles** - Larger hit areas, extend beyond popup edges

---

## [0.3.0] - 2026-01-31

### Added

#### Intelligent Concept Extraction
- **Concept Types** (`src/types/concept.ts`)
  - `ExtractedConcept` interface with text, normalized name, category, and position
  - `ConceptCategory` type: science, philosophy, psychology, technology, abstract
  - `ConceptExplanation` interface with summary, context, and related concepts
  - Utility functions for concept ID generation and validation

- **Backend Concept Endpoints** (`server/src/routes.ts`)
  - `POST /api/concepts/extract` - Extract concepts from question text
  - `POST /api/concepts/explain` - Get LLM-generated explanation for a concept
  
- **Concept Extraction Function** (`server/src/inference.ts`)
  - Uses W&B Inference for LLM-based concept identification
  - Returns concept positions for accurate text highlighting
  - Validates and filters overlapping/invalid concepts
  - Full Weave tracing for observability

- **Concept Explanation Function** (`server/src/inference.ts`)
  - Generates contextual explanations tied to the specific question
  - Returns related concepts for future exploration
  - Full Weave tracing for observability

#### Frontend Concept Components
- **ConceptHighlighter Component** (`src/components/ConceptHighlighter/`)
  - Renders text with highlighted concept spans
  - Category-based color coding (5 muted colors)
  - Hover, click, and keyboard interaction handlers
  - Accessible with proper ARIA attributes

- **ConceptPopup Component** (`src/components/ConceptPopup/`)
  - Gwern-style popup for concept explanations
  - **Multiple popups** - open popups for multiple concepts simultaneously
  - **Draggable** - move popup by dragging header
  - **Resizable** - resize by dragging edges/corners with visual indicators
  - **Minimizable with stacking** - collapse popup to header-only, minimized popups stack in lower-right corner (Gwern-style), expand to restore original position
  - **Persistent** - stays open until user clicks close button (no auto-dismiss)
  - Intelligent viewport positioning for initial display
  - Loading and error states
  - Related concepts for further exploration
  - Remove highlight button for user control

#### Concept Hooks
- **useConceptExtraction Hook** (`src/hooks/useConceptExtraction.ts`)
  - Manages concept extraction API calls
  - In-memory caching per question text
  - Loading/error state management
  - Request deduplication

- **useConceptExplanation Hook** (`src/hooks/useConceptExplanation.ts`)
  - Manages concept explanation API calls
  - localStorage caching with 24-hour expiration
  - Loading/error state management

#### Design System Updates
- **Concept Highlight Colors** (`src/styles/tokens.css`)
  - 5 muted category-specific colors (science, philosophy, psychology, technology, abstract)
  - Light and dark mode variants
  - Low chroma values to maintain monochromatic aesthetic

#### Integration
- **QuestionNode Integration**
  - Concept highlighting in question text
  - Popup display on hover/click
  - Full prop forwarding for parent control
  - **Auto-extraction on selection** - Concepts are automatically extracted when a node is selected

- **ChatView Integration**
  - Concept highlighting in question header
  - Popup display on hover/click

### Tests
- `ConceptHighlighter.test.tsx` - Component rendering and interaction tests
- `ConceptPopup.test.tsx` - Popup rendering, dragging, resizing, and interaction tests
- `concepts.test.ts` - Backend extraction/explanation function tests

---

## [0.2.0] - 2026-01-31

### Added

#### W&B Weave Integration
- **Backend Server** (`server/`)
  - Express.js server with TypeScript
  - W&B Weave initialization for tracing
  - Full observability of all LLM calls
  - Traces viewable at https://wandb.ai/your-username/fractal

#### W&B Inference Integration
- **AI Question Generation** (`server/src/inference.ts`)
  - Uses W&B Inference API (OpenAI-compatible)
  - Default model: Llama 3.1 8B Instruct
  - Generates 3-5 related questions per input
  - Token usage tracking

#### API Layer
- **Backend Routes** (`server/src/routes.ts`)
  - `GET /health` - Health check endpoint
  - `POST /api/generate` - Generate related questions
  - `GET /api/models` - List available models

- **Frontend API Client** (`src/api/client.ts`)
  - `generateQuestions()` - Call AI to generate related questions
  - `checkHealth()` - Verify backend availability
  - `isApiAvailable()` - Quick availability check

#### New Hooks
- **useAIQuestions Hook** (`src/hooks/useAIQuestions.ts`)
  - `generate(question)` - Generate related questions
  - `isLoading` - Loading state
  - `error` - Error handling
  - `isAvailable` - API availability status

#### UI Enhancements
- **AI Generate Button** on each QuestionNode
  - Click ✦ to generate AI suggestions
  - Spinning animation during generation
  - Generated questions auto-added as children

#### Testing Infrastructure (from v0.1.0-rc)
- **Comprehensive Testing Infrastructure**
  - Vitest configuration with jsdom environment for React testing
  - Test setup with localStorage and matchMedia mocks
  - Custom render utilities with userEvent integration
  - Detailed logging for LLM agent analysis
  
- **Unit Tests** (`src/types/question.test.ts`)
  - 34 tests covering all utility functions
  
- **Hook Tests** 
  - `useQuestionTree.test.tsx` - 24 tests for tree state management
  - `useTheme.test.tsx` - 14 tests for theme switching and persistence
  
- **Component Tests**
  - `QuestionInput.test.tsx` - 18 tests for input behavior
  - `QuestionNode.test.tsx` - 22 tests for node display and interaction
  
- **Integration Tests** (`App.test.tsx`)
  - 24 tests covering complete user journeys

### Fixed
- Fixed ESM import error for TypeScript interfaces in `useQuestionTree.ts`

### Technical Decisions

#### Why W&B Weave?
- Automatic tracing of all LLM calls
- Token usage and cost tracking
- Latency monitoring
- Input/output logging for debugging
- Centralized observability dashboard

#### Why W&B Inference?
- Access to open-source models (Llama, DeepSeek, Qwen)
- OpenAI-compatible API for easy migration
- Integrated with Weave for automatic tracing
- No need for separate LLM provider accounts

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

[Unreleased]: https://github.com/setrf/fractal/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/setrf/fractal/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/setrf/fractal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/setrf/fractal/releases/tag/v0.1.0
