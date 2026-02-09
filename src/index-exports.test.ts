import { describe, it, expect } from 'vitest'

import * as api from './api/index'
import * as ChatView from './components/ChatView/index'
import * as ConceptHighlighter from './components/ConceptHighlighter/index'
import * as ConceptPopup from './components/ConceptPopup/index'
import * as EvalPanel from './components/EvalPanel/index'
import * as GraphControls from './components/GraphControls/index'
import * as GraphNodePopup from './components/GraphNodePopup/index'
import * as GraphView from './components/GraphView/index'
import * as MarkdownWithHighlights from './components/MarkdownWithHighlights/index'
import * as ModelSelector from './components/ModelSelector/index'
import * as NotePopup from './components/NotePopup/index'
import * as Onboarding from './components/Onboarding/index'
import * as ProbeChat from './components/ProbeChat/index'
import * as ProbeSidebar from './components/ProbeSidebar/index'
import * as ProbeTabBar from './components/ProbeTabBar/index'
import * as QuestionInput from './components/QuestionInput/index'
import * as QuestionNode from './components/QuestionNode/index'
import * as QuestionTree from './components/QuestionTree/index'
import * as ReplayTimeline from './components/ReplayTimeline/index'
import * as StashButton from './components/StashButton/index'
import * as StashItem from './components/StashItem/index'
import * as StashSidebar from './components/StashSidebar/index'
import * as ThemeToggle from './components/ThemeToggle/index'
import * as ViewModeToggle from './components/ViewModeToggle/index'

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
