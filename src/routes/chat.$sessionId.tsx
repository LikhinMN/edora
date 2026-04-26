import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
}

function SessionChatPage() {
  const { sessionId } = Route.useParams()
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatEntry[]>([])

  const hasMessages = history.length > 0
  const sessionLabel = useMemo(() => `Session: ${sessionId}`, [sessionId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isSending) {
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          sessionId,
        }),
      })
      const payload = (await response.json()) as ChatResponse

      if (!response.ok || typeof payload.answer !== 'string') {
        setError(payload.error ?? 'Could not get an answer. Please try again.')
        return
      }

      const answer = payload.answer

      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          question: trimmedQuestion,
          answer,
          quiz: payload.quiz ?? null,
        },
      ])
      setQuestion('')
    } catch {
      setError('Could not reach Edora right now. Please try again.')
    } finally {
      setIsSending(false)
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
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{entry.answer}</p>
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
