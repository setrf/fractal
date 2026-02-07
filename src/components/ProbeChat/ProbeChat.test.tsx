import { describe, expect, it } from 'vitest'
import { extractProbeDirection } from './ProbeChat'

describe('extractProbeDirection', () => {
  it('returns freeform input unchanged', () => {
    expect(extractProbeDirection('Find contradictions in these ideas.')).toBe(
      'Find contradictions in these ideas.'
    )
  })

  it('extracts only direction from synthesized input', () => {
    const synthesized = [
      '## Context from your exploration:',
      '',
      '### Key Concepts',
      '- **Cognitive load**',
      '',
      '---',
      '',
      '## Your Direction:',
      'Build a concise synthesis with tradeoffs.',
    ].join('\n')

    expect(extractProbeDirection(synthesized)).toBe(
      'Build a concise synthesis with tradeoffs.'
    )
  })

  it('drops synthesized placeholder direction', () => {
    const synthesized = [
      '## Context from your exploration:',
      '...',
      '## Your Direction:',
      '[Enter your question or direction here]',
    ].join('\n')

    expect(extractProbeDirection(synthesized)).toBe('')
  })
})
