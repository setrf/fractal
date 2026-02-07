import { useMemo } from 'react'
import type { OnboardingStep } from '../components/Onboarding'

export interface OnboardingStepConfig extends OnboardingStep {
  canProceed?: () => boolean
  onEnter?: () => void
  autoAdvance?: boolean
}

interface UseOnboardingStepsInput {
  hasRootNode: boolean
  rootChildCount: number
  rootConceptCount: number
  hasLastMeta: boolean
  hasPopup: boolean
  stashCount: number
  stashOpen: boolean
  probeCount: number
  activeProbeSelectedCount: number
  activeProbeMessageCount: number
  isGraphView: boolean
  setStashOpen: (open: boolean) => void
  setProbeOpen: (open: boolean) => void
}

/**
 * Build the guided onboarding flow from current app state.
 * Keeps step wiring out of App.tsx so view orchestration stays focused.
 */
export function useOnboardingSteps({
  hasRootNode,
  rootChildCount,
  rootConceptCount,
  hasLastMeta,
  hasPopup,
  stashCount,
  stashOpen,
  probeCount,
  activeProbeSelectedCount,
  activeProbeMessageCount,
  isGraphView,
  setStashOpen,
  setProbeOpen,
}: UseOnboardingStepsInput): OnboardingStepConfig[] {
  return useMemo<OnboardingStepConfig[]>(
    () => [
      {
        id: 'welcome',
        title: 'Welcome to Fractal',
        body:
          'Fractal helps you discover better questions, not just answers.\n' +
          'This tour walks through the core flow used in the demo and judging.',
      },
      {
        id: 'seed-question',
        title: 'Start with a seed question',
        body:
          'Type a question you are genuinely curious about, then press Enter.\n' +
          'We will build the exploration tree from it.',
        selector: '[data-onboarding="question-input"]',
        canProceed: () => hasRootNode,
        autoAdvance: true,
      },
      {
        id: 'deep-dive',
        title: 'Generate branches with AI',
        body:
          'Click Deep dive to generate related questions.\n' +
          'This uses W&B Inference with Weave tracing.',
        selector: '[data-onboarding="deep-dive"]',
        canProceed: () => rootChildCount > 0,
        autoAdvance: true,
      },
      {
        id: 'weave-score',
        title: 'Weave quality score',
        body:
          'Each generation is scored by an LLM judge for depth and diversity.\n' +
          'The score feeds the self-improvement loop.',
        selector: '[data-onboarding="weave-score"]',
        canProceed: () => hasLastMeta,
      },
      {
        id: 'concept-highlights',
        title: 'Concept highlights',
        body:
          'Concepts are extracted from your questions and highlighted inline.\n' +
          'Hover or click to explore them.',
        selector: '[data-onboarding="question-text"]',
        canProceed: () => rootConceptCount > 0,
      },
      {
        id: 'concept-popups',
        title: 'Popups and related concepts',
        body:
          'Open a concept popup to read the summary and context.\n' +
          'Use related concepts to branch your exploration.',
        selector: '[data-onboarding="concept-popup"]',
        canProceed: () => hasPopup,
      },
      {
        id: 'stash-item',
        title: 'Stash important artifacts',
        body:
          'Stash questions, highlights, or explanations for later synthesis.\n' +
          'Try stashing at least one item.',
        selector: '[data-onboarding="stash-button"]',
        canProceed: () => stashCount > 0,
      },
      {
        id: 'stash-sidebar',
        title: 'Browse your Stash',
        body:
          'The Stash collects everything you want to keep.\n' +
          'Filter, search, and open items from here.',
        selector: '[data-onboarding="stash-sidebar"]',
        canProceed: () => stashOpen,
        onEnter: () => setStashOpen(true),
      },
      {
        id: 'probe-create',
        title: 'Create a Probe',
        body:
          'Probes synthesize your Stash into focused conversations.\n' +
          'Create a probe to begin.',
        selector: '[data-onboarding="probe-create"]',
        canProceed: () => probeCount > 0,
        onEnter: () => setProbeOpen(true),
      },
      {
        id: 'probe-select',
        title: 'Select Stash context',
        body:
          'Use the checkbox to add Stash items into the active probe.\n' +
          'Select at least one item to continue.',
        selector: '[data-onboarding="stash-checkbox"]',
        canProceed: () => activeProbeSelectedCount > 0,
        onEnter: () => setStashOpen(true),
      },
      {
        id: 'probe-synthesize',
        title: 'Synthesize and send',
        body:
          'Click Synthesize to build a structured prompt, then send.\n' +
          'You are now running a context-rich LLM query.',
        selector: '[data-onboarding="probe-synthesize"]',
        canProceed: () => activeProbeMessageCount > 0,
        onEnter: () => setProbeOpen(true),
      },
      {
        id: 'model-selection',
        title: 'Model selection',
        body:
          'Swap the model used for generation, chat, and evaluation.\n' +
          'This lets you compare outputs during the demo.',
        selector: '[data-onboarding="model-selector"]',
      },
      {
        id: 'graph-view',
        title: '3D knowledge graph',
        body:
          'Switch to Graph view to visualize questions, concepts, stash items, and probes.\n' +
          'This is the narrative map for the demo.',
        selector: '[data-onboarding="view-toggle"]',
        canProceed: () => isGraphView,
      },
      {
        id: 'finish',
        title: 'You are ready to demo',
        body:
          'You have walked the full Fractal loop.\n' +
          'Restart this tour anytime from the top-left controls.',
      },
    ],
    [
      hasRootNode,
      rootChildCount,
      rootConceptCount,
      hasLastMeta,
      hasPopup,
      stashCount,
      stashOpen,
      probeCount,
      activeProbeSelectedCount,
      activeProbeMessageCount,
      isGraphView,
      setStashOpen,
      setProbeOpen,
    ]
  )
}
