import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  categoryLabels,
  generateConceptId,
  getCategoryColorVar,
  sortConceptsByPosition,
  validateNoOverlap,
  type ExtractedConcept,
} from './concept'

const createConcept = (overrides: Partial<ExtractedConcept> = {}): ExtractedConcept => ({
  id: 'c_test',
  text: 'concept',
  normalizedName: 'concept',
  category: 'abstract',
  startIndex: 0,
  endIndex: 7,
  ...overrides,
})

describe('concept utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generateConceptId creates prefixed unique-looking identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

    const id = generateConceptId()

    expect(id).toMatch(/^c_1700000000000_[a-z0-9]+$/)
  })

  it('getCategoryColorVar maps categories to CSS custom properties', () => {
    expect(getCategoryColorVar('science')).toBe('--concept-science')
    expect(getCategoryColorVar('philosophy')).toBe('--concept-philosophy')
    expect(getCategoryColorVar('psychology')).toBe('--concept-psychology')
    expect(getCategoryColorVar('technology')).toBe('--concept-technology')
    expect(getCategoryColorVar('abstract')).toBe('--concept-abstract')
  })

  it('categoryLabels provides expected human-readable labels', () => {
    expect(categoryLabels).toEqual({
      science: 'Science',
      philosophy: 'Philosophy',
      psychology: 'Psychology',
      technology: 'Technology',
      abstract: 'General Concept',
    })
  })

  it('sortConceptsByPosition returns a new array sorted by start index', () => {
    const input = [
      createConcept({ id: 'c3', startIndex: 20, endIndex: 25 }),
      createConcept({ id: 'c1', startIndex: 1, endIndex: 5 }),
      createConcept({ id: 'c2', startIndex: 10, endIndex: 15 }),
    ]

    const sorted = sortConceptsByPosition(input)

    expect(sorted.map(c => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(sorted).not.toBe(input)
    expect(input.map(c => c.id)).toEqual(['c3', 'c1', 'c2'])
  })

  it('validateNoOverlap returns true for non-overlapping concepts', () => {
    const concepts = [
      createConcept({ id: 'a', startIndex: 10, endIndex: 15 }),
      createConcept({ id: 'b', startIndex: 0, endIndex: 5 }),
      createConcept({ id: 'c', startIndex: 16, endIndex: 20 }),
    ]

    expect(validateNoOverlap(concepts)).toBe(true)
  })

  it('validateNoOverlap returns false when concepts overlap', () => {
    const concepts = [
      createConcept({ id: 'a', startIndex: 0, endIndex: 10 }),
      createConcept({ id: 'b', startIndex: 8, endIndex: 12 }),
    ]

    expect(validateNoOverlap(concepts)).toBe(false)
  })

  it('validateNoOverlap handles empty and single-item inputs', () => {
    expect(validateNoOverlap([])).toBe(true)
    expect(validateNoOverlap([createConcept({ startIndex: 5, endIndex: 8 })])).toBe(true)
  })
})
