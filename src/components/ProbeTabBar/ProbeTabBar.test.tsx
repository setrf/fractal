import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { ProbeTabBar } from './ProbeTabBar'
import { PROBE_STORAGE_KEY, type Probe } from '../../types/probe'

function seedProbes() {
  const now = Date.now()
  const probes: Probe[] = [
    {
      id: 'probe_1',
      name: 'Probe 1',
      color: 'blue',
      messages: [],
      selectedStashItemIds: [],
      createdAt: now - 1_000,
      updatedAt: now - 1_000,
    },
    {
      id: 'probe_2',
      name: 'Probe 2',
      color: 'green',
      messages: [],
      selectedStashItemIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ]

  localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(probes))
}

describe('ProbeTabBar keyboard support', () => {
  beforeEach(() => {
    localStorage.clear()
    seedProbes()
  })

  it('activates a tab with Enter', async () => {
    const { user } = render(<ProbeTabBar />)

    const secondTab = screen.getByRole('tab', { name: /probe 2/i })
    secondTab.focus()
    await user.keyboard('{Enter}')

    expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  it('activates a tab with Space', async () => {
    const { user } = render(<ProbeTabBar />)

    const secondTab = screen.getByRole('tab', { name: /probe 2/i })
    secondTab.focus()
    await user.keyboard(' ')

    expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  it('moves active tab with arrow keys', async () => {
    const { user } = render(<ProbeTabBar />)

    const firstTab = screen.getByRole('tab', { name: /probe 1/i })
    const secondTab = screen.getByRole('tab', { name: /probe 2/i })

    firstTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(secondTab).toHaveAttribute('aria-selected', 'true')

    secondTab.focus()
    await user.keyboard('{ArrowLeft}')
    expect(firstTab).toHaveAttribute('aria-selected', 'true')
  })
})
