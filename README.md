# Fractal

> A place for questions, not answers.

Fractal is an interactive interface for creative exploration of curiosity. In a world full of answer engines—Google, LLMs, ChatGPT—there's no place designed specifically for **questions**. Fractal fills that gap.

**The world is full of places to find answers. Fractal is a place to find questions.**

---

## The Journey

Fractal guides you through a four-stage intellectual journey:

1. **Seed** — Enter a proto-question or concept that sparks your curiosity
2. **Branch** — Watch as AI generates related questions, creating an exploration tree
3. **Collect** — Gather valuable tidbits (highlights, explanations, notes) in your Stash
4. **Synthesize** — Use the Probe to combine collected insights into focused inquiry

This is not about finding "the answer." It's about discovering what you're truly curious about.

---

## Table of Contents

- [The Journey](#the-journey)
- [Features](#features)
- [Design Philosophy](#design-philosophy)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Design System](#design-system)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

---

## Philosophy

The internet optimized for answers. But learning, creativity, and discovery are driven by **questions**. Fractal inverts the paradigm:

- **Questions are first-class citizens** — Not stepping stones to answers, but destinations themselves
- **Tangents are encouraged** — Every question branches into related questions
- **Collection over consumption** — Gather fragments that resonate as you explore
- **Synthesis over search** — Weave collected insights into coherent understanding
- **Exploration over resolution** — The goal isn't to find "the answer" but to discover what you're truly curious about

---

## Features

### Current (v0.6.0)

- **Central Question Input** — Terminal-style interface to enter your initial question
- **Branching Tree Visualization** — Questions branch into sub-questions in a visual tree
- **Add Related Questions** — Click any node to add child questions
- **AI-Generated Questions** — Click the ✦ button to generate related questions using AI (W&B Inference)
- **Chat View** — Lock in on a question to have a deep conversational exploration with AI
- **Intelligent Concept Extraction** — Automatic detection and highlighting of key concepts in questions
- **Gwern-style Concept Popups** — Hover or click highlighted concepts for LLM-generated explanations
- **The Stash** — Collapsible left sidebar for collecting and organizing excerpts, highlights, and concepts
  - Stash highlights, explanations, questions, chat messages, and custom notes
  - Filter by type, search across all content
  - Export as JSON, clear all
  - Drag-and-drop support (reorder within, drag to Probe)
  - Browser localStorage persistence
  - Checkbox selection for Probe integration
- **The Probe** — Collapsible right sidebar for synthesis-focused conversations
  - Multiple tabbed probes with distinct colors (up to 5)
  - Select Stash items via checkboxes or drag-and-drop
  - Auto-synthesize rich prompts from collected context
  - Fully editable prompts before sending
  - Persistent conversations in localStorage
  - Color-coded badges on Stash items show assignments
- **Expand/Collapse Branches** — Manage complexity by collapsing explored branches
- **Light/Dark Mode** — Automatic system detection with manual toggle
- **Keyboard Support** — Enter to submit, Escape to cancel
- **W&B Weave Integration** — Full observability and tracing for AI operations

### Planned

- Concept sub-trees — Expand concepts into their own exploration branches
- Streaming responses for real-time feedback
- Collaborative question exploration
- Search within your question history

---

## Design Philosophy

### Swiss Neobrutalist

Fractal's design is rooted in Swiss neobrutalism:

- **Hard edges** — No border-radius; everything is sharp and intentional
- **Bold borders** — 2-3px borders create visual weight
- **Functional over decorative** — Every element serves a purpose
- **Stark contrast** — Clear visual hierarchy through contrast, not color
- **Visible structure** — The grid and layout are celebrated, not hidden

### Monochromatic OKLCH

The color system uses **zero chromatic colors** in the core UI:

- **Grayscale only** — All interface elements use achromatic OKLCH values
- **Single accent** — Vivid red reserved exclusively for errors/destructive actions
- **Chart colors** — 5 chromatic colors reserved for data visualization only
- **Perceptually uniform** — OKLCH ensures consistent perceived brightness across the palette

### Typography

- **Monospace primary** — JetBrains Mono for the terminal aesthetic
- **Sans-serif secondary** — Inter for supporting UI text
- **Tight tracking** — Condensed letter-spacing for headings
- **Functional hierarchy** — Size and weight convey importance, not decoration

---

## Architecture

### System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Express Server │────▶│  W&B Inference  │
│   (Vite + TS)   │     │   (Node.js)     │     │  (LLM Models)   │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │   W&B Weave     │
                        │   (Tracing)     │
                        │                 │
                        └─────────────────┘
```

### Frontend Component Hierarchy

```
App (StashProvider + ProbeProvider)
├── StashSidebar             # Collapsible left sidebar for stashed items
│   └── StashItem            # Individual stashed item with probe selection
├── Main Content
│   ├── ThemeToggle          # Light/dark mode switch
│   ├── QuestionInput        # Initial question entry (shown when no root)
│   ├── QuestionTree         # Branching visualization (shown when root exists)
│   │   └── TreeBranch       # Recursive branch renderer
│   │       └── QuestionNode # Individual question with actions + AI generate
│   │           ├── StashButton         # Add question to stash
│   │           ├── ConceptHighlighter  # Highlights concepts in question text
│   │           └── ConceptPopup        # Gwern-style explanation popup
│   └── ChatView             # Deep conversational exploration of a question
│       ├── StashButton      # Add message to stash (on each message)
│       └── ConceptHighlighter  # Highlights concepts in messages
└── ProbeSidebar             # Collapsible right sidebar for synthesis
    ├── ProbeTabBar          # Tab navigation for multiple probes
    └── ProbeChat            # Chat interface for active probe
```

### Data Flow: Seed → Branch → Collect → Synthesize

```
User Question                     Stash (Collection)           Probe (Synthesis)
    │                                   │                           │
    ▼                                   │                           │
QuestionInput                           │                           │
    │                                   │                           │
    ▼                                   │                           │
QuestionTree ─── concepts ───► Highlights ─────► Selected Items ────┤
    │                               │                               │
    ▼                               ▼                               ▼
ChatView ───── excerpts ────► Messages ──────────────────► Synthesized Prompt
    │                               │                               │
    ▼                               ▼                               ▼
ConceptPopup ── explanations ► Explanations                  LLM Response
```

### Backend Architecture

```
server/
├── src/
│   ├── index.ts        # Express server entry point
│   ├── config.ts       # Environment configuration
│   ├── routes.ts       # API endpoints
│   ├── inference.ts    # W&B Inference integration
│   └── weave-client.ts # W&B Weave initialization
```

### State Management

The question tree uses a **normalized data structure** for efficient updates:

```typescript
interface QuestionTree {
  nodes: Record<string, QuestionNode>  // O(1) lookup by ID
  rootId: string | null                // Entry point
  activeId: string | null              // Currently focused node
}
```

This structure allows:
- O(1) node lookup, insertion, and updates
- Efficient re-rendering (only affected branches update)
- Easy serialization for future persistence

### Data Flow

```
User Input
    ↓
QuestionInput.onSubmit()
    ↓
useQuestionTree.addRootQuestion()
    ↓
Creates QuestionNode → Updates QuestionTree state
    ↓
React re-renders QuestionTree component
    ↓
TreeBranch recursively renders nodes
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- W&B API Key (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/setrf/fractal.git
cd fractal

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install

# Configure W&B API key
cp .env.example .env
# Edit .env and add your WANDB_API_KEY

cd ..
```

### Running the Application

You need to run both the backend server and frontend:

```bash
# Terminal 1: Start the backend server
cd server
npm run dev
# Server runs at http://localhost:3001

# Terminal 2: Start the frontend
cd fractal  # (or stay in root)
npm run dev
# Frontend runs at http://localhost:5173
```

### W&B Dashboard

Once the server is running, view your traces at:
- https://wandb.ai/your-username/fractal

### Build for Production

```bash
# Build frontend
npm run build

# Build server
cd server
npm run build

# Run production server
npm start
```

---

## Project Structure

```
fractal/
├── public/
│   └── favicon.svg           # Question mark favicon
├── src/
│   ├── api/
│   │   ├── client.ts         # API client for backend communication
│   │   └── index.ts          # API exports
│   ├── components/
│   │   ├── ChatView/         # Deep exploration chat interface
│   │   │   ├── ChatView.tsx
│   │   │   ├── ChatView.module.css
│   │   │   └── index.ts
│   │   ├── ConceptHighlighter/ # Concept highlighting component
│   │   │   ├── ConceptHighlighter.tsx
│   │   │   ├── ConceptHighlighter.module.css
│   │   │   └── index.ts
│   │   ├── ConceptPopup/     # Gwern-style explanation popup
│   │   │   ├── ConceptPopup.tsx
│   │   │   ├── ConceptPopup.module.css
│   │   │   └── index.ts
│   │   ├── QuestionInput/    # Central text entry component
│   │   │   ├── QuestionInput.tsx
│   │   │   ├── QuestionInput.module.css
│   │   │   └── index.ts
│   │   ├── QuestionNode/     # Individual question node
│   │   │   ├── QuestionNode.tsx
│   │   │   ├── QuestionNode.module.css
│   │   │   └── index.ts
│   │   ├── QuestionTree/     # Branching tree visualization
│   │   │   ├── QuestionTree.tsx
│   │   │   ├── QuestionTree.module.css
│   │   │   └── index.ts
│   │   ├── StashButton/      # Reusable add-to-stash button
│   │   │   ├── StashButton.tsx
│   │   │   ├── StashButton.module.css
│   │   │   └── index.ts
│   │   ├── StashItem/        # Individual stashed item display
│   │   │   ├── StashItem.tsx
│   │   │   ├── StashItem.module.css
│   │   │   └── index.ts
│   │   ├── StashSidebar/     # Collapsible stash sidebar
│   │   │   ├── StashSidebar.tsx
│   │   │   ├── StashSidebar.module.css
│   │   │   └── index.ts
│   │   └── ThemeToggle/      # Light/dark mode toggle
│   │       ├── ThemeToggle.tsx
│   │       ├── ThemeToggle.module.css
│   │       └── index.ts
│   ├── context/
│   │   └── StashContext.tsx  # Global stash state provider
│   ├── hooks/
│   │   ├── useAIQuestions.ts        # AI question generation hook
│   │   ├── useConceptExtraction.ts  # Concept extraction with caching
│   │   ├── useConceptExplanation.ts # Concept explanation with localStorage cache
│   │   ├── useQuestionTree.ts       # Question tree state management
│   │   ├── useStash.ts              # Stash state management with localStorage
│   │   └── useTheme.ts              # Theme state and persistence
│   ├── styles/
│   │   ├── tokens.css        # OKLCH design tokens
│   │   ├── reset.css         # CSS reset with neobrutalist base
│   │   └── global.css        # Global styles and utilities
│   ├── types/
│   │   ├── concept.ts        # Concept types (ExtractedConcept, ConceptExplanation)
│   │   ├── question.ts       # Question tree types and utilities
│   │   └── stash.ts          # Stash types (StashItem, StashItemType, utilities)
│   ├── App.tsx               # Root application component
│   └── main.tsx              # Application entry point
├── server/                   # Backend API server
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── config.ts         # Environment configuration
│   │   ├── routes.ts         # API routes
│   │   ├── inference.ts      # W&B Inference integration
│   │   └── weave-client.ts   # W&B Weave tracing
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example          # Environment template
│   └── .gitignore
├── index.html                # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md              # Version history
└── README.md                 # This file
```

---

## Design System

### Color Tokens (OKLCH)

#### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `oklch(100% 0 0)` | Main background |
| `--bg-secondary` | `oklch(97% 0 0)` | Subtle background |
| `--text-primary` | `oklch(15% 0 0)` | Main text |
| `--text-secondary` | `oklch(40% 0 0)` | Secondary text |
| `--border-primary` | `oklch(85% 0 0)` | Default borders |

#### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `oklch(12% 0 0)` | Main background |
| `--bg-secondary` | `oklch(18% 0 0)` | Subtle background |
| `--text-primary` | `oklch(92% 0 0)` | Main text |
| `--text-secondary` | `oklch(65% 0 0)` | Secondary text |
| `--border-primary` | `oklch(25% 0 0)` | Default borders |

#### Accent
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-error` | `oklch(55% 0.25 25)` | Errors, destructive actions |

#### Chart Colors (Data Viz Only)
| Token | Color | Hue |
|-------|-------|-----|
| `--chart-1` | Blue | 250 |
| `--chart-2` | Green | 150 |
| `--chart-3` | Yellow | 85 |
| `--chart-4` | Purple | 310 |
| `--chart-5` | Orange | 50 |

### Typography Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 0.75rem | Captions |
| `--text-sm` | 0.875rem | Small text, hints |
| `--text-base` | 1rem | Body text |
| `--text-lg` | 1.125rem | Large body |
| `--text-xl` | 1.25rem | Subheadings |
| `--text-2xl` | 1.5rem | Headings |
| `--text-3xl` | 2rem | Large headings |
| `--text-4xl` | 2.5rem | Display |

### Spacing Scale

Based on 0.25rem (4px) increments:
`--space-1` through `--space-24`

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:verbose` | Run tests with detailed output |

### Testing

The project uses **Vitest** with **React Testing Library** for comprehensive testing.

#### Test Structure

| File | Coverage |
|------|----------|
| `src/types/question.test.ts` | Core utilities (34 tests) |
| `src/hooks/useQuestionTree.test.tsx` | Tree state hook (24 tests) |
| `src/hooks/useTheme.test.tsx` | Theme hook (14 tests) |
| `src/components/QuestionInput/QuestionInput.test.tsx` | Input component (18 tests) |
| `src/components/QuestionNode/QuestionNode.test.tsx` | Node component (22 tests) |
| `src/App.test.tsx` | Integration tests (24 tests) |

#### Running Tests for LLM Agents

Tests are designed with detailed logging for LLM agent analysis:

```bash
# Run with verbose output (recommended for agents)
npm run test:verbose

# Output includes:
# - [TEST] logs showing exact values and state
# - Step-by-step journey logs for integration tests
# - Clear PASS/FAIL indicators for each assertion
```

#### Test Philosophy

1. **Detailed Output**: Every test logs its inputs, outputs, and assertions
2. **Complete Coverage**: Unit tests, component tests, and integration tests
3. **User-Centric**: Tests verify actual user behavior, not implementation details
4. **Self-Documenting**: Test names describe expected behavior clearly

### Code Style

- **TypeScript** — Strict mode enabled
- **CSS Modules** — Scoped styles per component
- **Functional Components** — Hooks-based React
- **Named Exports** — For better tree-shaking and refactoring

### Component Guidelines

1. Each component lives in its own folder with:
   - `ComponentName.tsx` — Component implementation
   - `ComponentName.module.css` — Scoped styles
   - `index.ts` — Public exports

2. Use CSS custom properties for all colors, spacing, and typography

3. Prefer composition over prop drilling

---

## Roadmap

### v0.5.0 — The Stash
- [x] Collapsible sidebar for collecting content
- [x] Stash highlights, explanations, questions, chat messages
- [x] Custom note creation
- [x] Filter, search, and export
- [x] Drag-and-drop support
- [x] Browser localStorage persistence

### v0.6.0 — The Probe (Current)
- [x] Collapsible right sidebar for synthesis conversations
- [x] Multiple tabbed probes with distinct colors
- [x] Stash item selection via checkboxes and drag-and-drop
- [x] Prompt synthesis from collected context
- [x] Fully editable synthesized prompts
- [x] Probe conversation persistence in localStorage
- [x] Visual integration: color badges on Stash items
- [x] Dedicated synthesis-focused LLM system prompt

### v0.7.0 — Enhanced AI
- [ ] Streaming responses for real-time feedback
- [ ] Model selection UI
- [ ] Suggest tangents based on context
- [ ] Concept sub-trees (expand concepts into exploration branches)

### v0.8.0 — Enhanced Visualization
- [ ] Zoom and pan navigation
- [ ] Mini-map for large trees
- [ ] Keyboard shortcuts for tree navigation

### v1.0.0 — Full Release
- [ ] User accounts and sync
- [ ] Collaborative exploration
- [ ] Public question tree sharing

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Fractal</strong> — Where questions lead to more questions.
</p>
