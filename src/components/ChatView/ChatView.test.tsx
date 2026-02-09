import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { ChatView } from './ChatView'

describe('ChatView', () => {
  it('sends an initial exploration query on mount', async () => {
    const onSendMessage = vi.fn().mockResolvedValue('Initial assistant response')

    render(
      <ChatView
        question="Why do we dream?"
        onBack={vi.fn()}
        onSendMessage={onSendMessage}
      />
    )

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledTimes(1)
      expect(onSendMessage).toHaveBeenCalledWith([
        { role: 'user', content: 'Help me explore and understand this question.' },
      ])
    })

    expect(await screen.findByText('Initial assistant response')).toBeInTheDocument()
  })

  it('sends user follow-up messages and appends assistant responses', async () => {
    const onSendMessage = vi
      .fn()
      .mockResolvedValueOnce('Initial assistant response')
      .mockResolvedValueOnce('Follow-up response')

    const { user } = render(
      <ChatView
        question="Why do we dream?"
        onBack={vi.fn()}
        onSendMessage={onSendMessage}
      />
    )

    await screen.findByText('Initial assistant response')

    const input = screen.getByPlaceholderText(
      /type your message... \(enter to send, shift\+enter for new line\)/i
    )
    await user.type(input, 'Tell me more about memory consolidation{Enter}')

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledTimes(2)
      expect(onSendMessage.mock.calls[1][0]).toEqual([
        { role: 'user', content: 'Help me explore and understand this question.' },
        { role: 'assistant', content: 'Initial assistant response' },
        { role: 'user', content: 'Tell me more about memory consolidation' },
      ])
    })

    expect(await screen.findByText('Follow-up response')).toBeInTheDocument()
  })
})
