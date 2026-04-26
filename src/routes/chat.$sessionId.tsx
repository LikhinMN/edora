import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { QuizQuestion } from '#/lib/types'

export const Route = createFileRoute('/chat/$sessionId')({
  component: SessionChatPage,
})

type ChatResponse = {
  answer?: string
  quiz?: QuizQuestion[] | null
  error?: string
}

type ChatEntry = {
  id: string
  question: string
  answer: string
  quiz: QuizQuestion[] | null
  isStreaming: boolean
  error: string | null
}

type StreamChunk =
  | { type: 'token'; token: string }
  | { type: 'done'; answer: string; quiz: QuizQuestion[] | null }
  | { type: 'error'; error: string }

function parseChatStreamChunkLine(line: string): StreamChunk | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const record = parsed as Record<string, unknown>

    if (record.type === 'token' && typeof record.token === 'string') {
      return { type: 'token', token: record.token }
    }

    if (record.type === 'done' && typeof record.answer === 'string') {
      return {
        type: 'done',
        answer: record.answer,
        quiz: Array.isArray(record.quiz) ? (record.quiz as QuizQuestion[]) : null,
      }
    }

    if (record.type === 'error' && typeof record.error === 'string') {
      return { type: 'error', error: record.error }
    }
  } catch {
    return null
  }

  return null
}

function SessionChatPage() {
  const { sessionId } = Route.useParams()
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatEntry[]>([])
  const activeRequestRef = useRef<AbortController | null>(null)

  const hasMessages = history.length > 0
  const sessionLabel = useMemo(() => `Session: ${sessionId}`, [sessionId])

  useEffect(
    () => () => {
      activeRequestRef.current?.abort()
    },
    [],
  )

  const updateHistoryEntry = (entryId: string, updater: (entry: ChatEntry) => ChatEntry) => {
    setHistory((prev) => prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isSending) {
      return
    }

    activeRequestRef.current?.abort()
    const controller = new AbortController()
    activeRequestRef.current = controller
    const entryId = crypto.randomUUID()

    setIsSending(true)
    setError(null)
    setHistory((prev) => [
      ...prev,
      {
        id: entryId,
        question: trimmedQuestion,
        answer: '',
        quiz: null,
        isStreaming: true,
        error: null,
      },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          question: trimmedQuestion,
          sessionId,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ChatResponse | null
        const message = payload?.error ?? 'Could not get an answer. Please try again.'
        setError(message)
        updateHistoryEntry(entryId, (entry) => ({
          ...entry,
          isStreaming: false,
          error: message,
        }))
        return
      }

      if (!response.body) {
        setError('Could not read the streaming response.')
        updateHistoryEntry(entryId, (entry) => ({
          ...entry,
          isStreaming: false,
          error: 'Could not read the streaming response.',
        }))
        return
      }

      setQuestion('')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let didReceiveDone = false
      let streamError: string | null = null

      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })

          for (;;) {
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex === -1) {
              break
            }

            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)
            const chunk = parseChatStreamChunkLine(line)

            if (!chunk) {
              continue
            }

            if (chunk.type === 'token') {
              updateHistoryEntry(entryId, (entry) => ({
                ...entry,
                answer: `${entry.answer}${chunk.token}`,
              }))
              continue
            }

            if (chunk.type === 'done') {
              didReceiveDone = true
              updateHistoryEntry(entryId, (entry) => ({
                ...entry,
                answer: chunk.answer,
                quiz: chunk.quiz,
                isStreaming: false,
              }))
              continue
            }

            streamError = chunk.error
            break
          }

          if (streamError) {
            break
          }
        }

        if (!streamError) {
          buffer += decoder.decode()

          for (;;) {
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex === -1) {
              break
            }

            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)
            const chunk = parseChatStreamChunkLine(line)

            if (!chunk) {
              continue
            }

            if (chunk.type === 'token') {
              updateHistoryEntry(entryId, (entry) => ({
                ...entry,
                answer: `${entry.answer}${chunk.token}`,
              }))
              continue
            }

            if (chunk.type === 'done') {
              didReceiveDone = true
              updateHistoryEntry(entryId, (entry) => ({
                ...entry,
                answer: chunk.answer,
                quiz: chunk.quiz,
                isStreaming: false,
              }))
              continue
            }

            streamError = chunk.error
            break
          }
        }

        if (!streamError) {
          const finalChunk = parseChatStreamChunkLine(buffer)

          if (finalChunk?.type === 'token') {
            updateHistoryEntry(entryId, (entry) => ({
              ...entry,
              answer: `${entry.answer}${finalChunk.token}`,
            }))
          } else if (finalChunk?.type === 'done') {
            didReceiveDone = true
            updateHistoryEntry(entryId, (entry) => ({
              ...entry,
              answer: finalChunk.answer,
              quiz: finalChunk.quiz,
              isStreaming: false,
            }))
          } else if (finalChunk?.type === 'error') {
            streamError = finalChunk.error
          }
        }

        if (streamError) {
          setError(streamError)
          updateHistoryEntry(entryId, (entry) => ({
            ...entry,
            isStreaming: false,
            error: streamError,
          }))
          return
        }

        if (!didReceiveDone) {
          updateHistoryEntry(entryId, (entry) => ({
            ...entry,
            isStreaming: false,
          }))
        }
      } finally {
        reader.releaseLock()
      }
    } catch (caughtError) {
      if (
        controller.signal.aborted ||
        (caughtError instanceof DOMException && caughtError.name === 'AbortError')
      ) {
        return
      }

      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not reach Edora right now. Please try again.'

      setError(message)
      updateHistoryEntry(entryId, (entry) => ({
        ...entry,
        isStreaming: false,
        error: message,
      }))
    } finally {
      setIsSending(false)
      activeRequestRef.current = null
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Edora</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Learning chat</h1>
            <p className="mt-1 text-sm text-slate-500">{sessionLabel}</p>
          </div>
          <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Upload another PDF
          </Link>
        </div>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Conversation</h2>
        <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-2">
          {!hasMessages ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Ask your first question about the uploaded PDF.
            </p>
          ) : null}
          {history.map((entry) => (
            <article key={entry.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">You</p>
                <p className="mt-1 text-slate-900">{entry.question}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Edora</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {entry.answer || (entry.isStreaming ? 'Thinking…' : '')}
                  {entry.isStreaming ? '▍' : ''}
                </p>
                {entry.error ? <p className="mt-2 text-sm text-red-600">{entry.error}</p> : null}
              </div>
              {entry.quiz && entry.quiz.length > 0 ? (
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Quick quiz</p>
                  <div className="mt-3 space-y-4">
                    {entry.quiz.map((quizItem, quizIndex) => (
                      <div key={`${entry.id}-quiz-${quizIndex}`} className="space-y-2">
                        <p className="font-medium text-slate-800">
                          {quizIndex + 1}. {quizItem.question}
                        </p>
                        <ol className="list-decimal space-y-1 pl-6 text-sm text-slate-700">
                          {quizItem.options.map((option, optionIndex) => (
                            <li key={`${entry.id}-quiz-${quizIndex}-option-${optionIndex}`}>
                              {option}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Ask a question</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="question-input">
            Your question
          </label>
          <textarea
            id="question-input"
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            rows={4}
            placeholder="For example: Summarize chapter 2 and create 3 practice questions."
            className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={isSending || !question.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {isSending ? 'Sending...' : 'Send question'}
          </button>
        </form>
      </section>
    </main>
  )
}
