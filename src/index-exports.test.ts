import { describe, it, expect } from 'vitest'

import * as api from './api'
import * as ChatView from './components/ChatView'
import * as ConceptHighlighter from './components/ConceptHighlighter'
import * as ConceptPopup from './components/ConceptPopup'
import * as EvalPanel from './components/EvalPanel'
import * as GraphControls from './components/GraphControls'
import * as GraphNodePopup from './components/GraphNodePopup'
import * as GraphView from './components/GraphView'
import * as MarkdownWithHighlights from './components/MarkdownWithHighlights'
import * as ModelSelector from './components/ModelSelector'
import * as NotePopup from './components/NotePopup'
import * as Onboarding from './components/Onboarding'
import * as ProbeChat from './components/ProbeChat'
import * as ProbeSidebar from './components/ProbeSidebar'
import * as ProbeTabBar from './components/ProbeTabBar'
import * as QuestionInput from './components/QuestionInput'
import * as QuestionNode from './components/QuestionNode'
import * as QuestionTree from './components/QuestionTree'
import * as ReplayTimeline from './components/ReplayTimeline'
import * as StashButton from './components/StashButton'
import * as StashItem from './components/StashItem'
import * as StashSidebar from './components/StashSidebar'
import * as ThemeToggle from './components/ThemeToggle'
import * as ViewModeToggle from './components/ViewModeToggle'

describe('barrel exports', () => {
  it('exports the API client runtime surface', () => {
    expect(api.generateQuestions).toBeTypeOf('function')
    expect(api.compareQuestionGenerations).toBeTypeOf('function')
    expect(api.getEvalStats).toBeTypeOf('function')
    expect(api.sendChatMessage).toBeTypeOf('function')
    expect(api.checkHealth).toBeTypeOf('function')
    expect(api.isApiAvailable).toBeTypeOf('function')
    expect(api.listModels).toBeTypeOf('function')
    expect(api.getModelPerformance).toBeTypeOf('function')
    expect(api.extractConcepts).toBeTypeOf('function')
    expect(api.explainConcept).toBeTypeOf('function')
    expect(api.exportProbeBrief).toBeTypeOf('function')
    expect(api.suggestProbeExperiments).toBeTypeOf('function')
  })

  it('exports component entry points', () => {
    expect(ChatView.ChatView).toBeDefined()
    expect(ConceptHighlighter.ConceptHighlighter).toBeDefined()
    expect(ConceptHighlighter.validateConcepts).toBeTypeOf('function')
    expect(ConceptPopup.ConceptPopup).toBeDefined()
    expect(ConceptPopup.findNonOverlappingPosition).toBeTypeOf('function')
    expect(EvalPanel.EvalPanel).toBeDefined()
    expect(GraphControls.GraphControls).toBeDefined()
    expect(GraphNodePopup.GraphNodePopup).toBeDefined()
    expect(GraphView.GraphView).toBeDefined()
    expect(MarkdownWithHighlights.MarkdownWithHighlights).toBeDefined()
    expect(ModelSelector.ModelSelector).toBeDefined()
    expect(NotePopup.NotePopup).toBeDefined()
    expect(Onboarding.OnboardingOverlay).toBeDefined()
    expect(ProbeChat.ProbeChat).toBeDefined()
    expect(ProbeSidebar.ProbeSidebar).toBeDefined()
    expect(ProbeTabBar.ProbeTabBar).toBeDefined()
    expect(QuestionInput.QuestionInput).toBeDefined()
    expect(QuestionNode.QuestionNode).toBeDefined()
    expect(QuestionTree.QuestionTree).toBeDefined()
    expect(ReplayTimeline.ReplayTimeline).toBeDefined()
    expect(StashButton.StashButton).toBeDefined()
    expect(StashItem.StashItem).toBeDefined()
    expect(StashSidebar.StashSidebar).toBeDefined()
    expect(ThemeToggle.ThemeToggle).toBeDefined()
    expect(ViewModeToggle.ViewModeToggle).toBeDefined()
  })
})
