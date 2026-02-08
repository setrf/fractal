const SYNTHESIZED_DIRECTION_HEADER = '## Your Direction:'
const SYNTHESIZED_DIRECTION_PLACEHOLDER = '[Enter your question or direction here]'

/**
 * Extract a user direction from Probe input.
 * If the input is a synthesized prompt template, keep only the direction section
 * so context is injected once on the server (from selected stash items).
 */
export function extractProbeDirection(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const headerIndex = trimmed.indexOf(SYNTHESIZED_DIRECTION_HEADER)
  if (headerIndex === -1) {
    return trimmed
  }

  const direction = trimmed
    .slice(headerIndex + SYNTHESIZED_DIRECTION_HEADER.length)
    .trim()

  if (!direction || direction === SYNTHESIZED_DIRECTION_PLACEHOLDER) {
    return ''
  }

  return direction
}

export function isSynthesizedProbeInput(input: string): boolean {
  return input.includes(SYNTHESIZED_DIRECTION_HEADER)
}
