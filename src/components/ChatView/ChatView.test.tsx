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

  it('shows an error message when the initial query fails', async () => {
    const onSendMessage = vi.fn().mockRejectedValue(new Error('initial failure'))

    render(
      <ChatView
        question="Why do we dream?"
        onBack={vi.fn()}
        onSendMessage={onSendMessage}
      />
    )

    expect(await screen.findByText(/Error: initial failure/i)).toBeInTheDocument()
  })

  it('shows an error message when a follow-up send fails', async () => {
    const onSendMessage = vi
      .fn()
      .mockResolvedValueOnce('Initial assistant response')
      .mockRejectedValueOnce(new Error('follow-up failure'))

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
    await user.type(input, 'Tell me more{Enter}')

    expect(await screen.findByText(/Error: follow-up failure/i)).toBeInTheDocument()
  })

  it('does not send on Shift+Enter and preserves multiline input', async () => {
    const onSendMessage = vi.fn().mockResolvedValue('Initial assistant response')
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
    ) as HTMLTextAreaElement

    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two')

    expect(onSendMessage).toHaveBeenCalledTimes(1)
    expect(input.value).toContain('\n')
  })

  it('keeps send disabled for whitespace-only input', async () => {
    const onSendMessage = vi.fn().mockResolvedValue('Initial assistant response')
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
    const sendButton = screen.getByRole('button', { name: /send message/i })

    await user.type(input, '   ')

    expect(sendButton).toBeDisabled()
    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn()
    const onSendMessage = vi.fn().mockResolvedValue('Initial assistant response')
    const { user } = render(
      <ChatView
        question="Why do we dream?"
        onBack={onBack}
        onSendMessage={onSendMessage}
      />
    )

    const backButton = screen.getByRole('button', { name: /back to question tree/i })
    await user.click(backButton)

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
