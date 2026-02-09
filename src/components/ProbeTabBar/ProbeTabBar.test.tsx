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

  it('wraps keyboard navigation from first tab to last with ArrowLeft', async () => {
    const { user } = render(<ProbeTabBar />)

    const firstTab = screen.getByRole('tab', { name: /probe 1/i })
    const secondTab = screen.getByRole('tab', { name: /probe 2/i })

    firstTab.focus()
    await user.keyboard('{ArrowLeft}')
    expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renames probe on double click + Enter', async () => {
    const { user } = render(<ProbeTabBar />)
    const firstTab = screen.getByRole('tab', { name: /probe 1/i })

    await user.dblClick(firstTab)
    const input = screen.getByDisplayValue('Probe 1')
    await user.clear(input)
    await user.type(input, 'Discovery Probe{Enter}')

    expect(screen.getByRole('tab', { name: /discovery\s*probe/i })).toBeInTheDocument()
  })

  it('cancels rename on Escape', async () => {
    const { user } = render(<ProbeTabBar />)
    const firstTab = screen.getByRole('tab', { name: /probe 1/i })

    await user.dblClick(firstTab)
    const input = screen.getByDisplayValue('Probe 1')
    await user.clear(input)
    await user.type(input, 'Temp Name{Escape}')

    expect(screen.getByRole('tab', { name: /probe 1/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /temp name/i })).not.toBeInTheDocument()
  })

  it('does not rename when submitted value is blank', async () => {
    const { user } = render(<ProbeTabBar />)
    const firstTab = screen.getByRole('tab', { name: /probe 1/i })

    await user.dblClick(firstTab)
    const input = screen.getByDisplayValue('Probe 1')
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(screen.getByRole('tab', { name: /probe 1/i })).toBeInTheDocument()
  })

  it('deletes a probe from delete button', async () => {
    const { user } = render(<ProbeTabBar />)

    await user.click(screen.getByRole('button', { name: /delete probe 2/i }))

    expect(screen.queryByRole('tab', { name: /probe 2/i })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /probe 1/i })).toBeInTheDocument()
  })

  it('opens and closes context menu via right click and outside click', async () => {
    const { user } = render(<ProbeTabBar />)
    const firstTab = screen.getByRole('tab', { name: /probe 1/i })

    await user.pointer([{ keys: '[MouseRight]', target: firstTab }])
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
  })

  it('toggles context menu for same tab and supports menu actions', async () => {
    const { user } = render(<ProbeTabBar />)
    const firstTab = screen.getByRole('tab', { name: /probe 1/i })

    await user.pointer([{ keys: '[MouseRight]', target: firstTab }])
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()

    // Right click same tab again closes the menu
    await user.pointer([{ keys: '[MouseRight]', target: firstTab }])
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()

    // Open again and rename from context menu
    await user.pointer([{ keys: '[MouseRight]', target: firstTab }])
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByDisplayValue('Probe 1')
    await user.clear(input)
    await user.type(input, 'Context Rename{Enter}')
    expect(screen.getByRole('tab', { name: /context\s*rename/i })).toBeInTheDocument()

    // Open menu and delete via context action
    const renamedTab = screen.getByRole('tab', { name: /context\s*rename/i })
    await user.pointer([{ keys: '[MouseRight]', target: renamedTab }])
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('tab', { name: /context\s*rename/i })).not.toBeInTheDocument()
  })
})
