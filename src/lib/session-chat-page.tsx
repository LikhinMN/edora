import { Clock3, Loader2, Moon, Paperclip, Plus, Send, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { QuizQuestion } from './types'

type UploadResponse = {
  sessionId?: string
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

type ChatStreamChunk =
  | { type: 'token'; token: string }
  | { type: 'done'; answer: string; quiz: QuizQuestion[] | null }
  | { type: 'error'; error: string }

type ChatSessionRecord = {
  sessionId: string
  firstQuestion: string
  timestamp: number
}

type ChatSessionPageProps = {
  initialSessionId?: string | null
}

type ThemeMode = 'light' | 'dark'

const SESSION_INDEX_KEY = 'edora.chat.sessions.v1'
const SESSION_TRANSCRIPT_PREFIX = 'edora.chat.transcript.v1:'
const THEME_KEY = 'edora.theme.v1'

function parseChatStreamChunkLine(line: string): ChatStreamChunk | null {
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

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getInitialTheme(): ThemeMode {
  if (!canUseLocalStorage()) {
    return 'light'
  }

  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota / serialization issues for MVP.
  }
}

function readSessionIndex(): ChatSessionRecord[] {
  const sessions = readJson<ChatSessionRecord[]>(SESSION_INDEX_KEY, [])
  return sessions
    .filter(
      (session) =>
        typeof session.sessionId === 'string' &&
        typeof session.firstQuestion === 'string' &&
        typeof session.timestamp === 'number',
    )
    .sort((a, b) => b.timestamp - a.timestamp)
}

function writeSessionIndex(sessions: ChatSessionRecord[]) {
  writeJson(SESSION_INDEX_KEY, sessions)
}

function readTranscript(sessionId: string): ChatEntry[] {
  return readJson<ChatEntry[]>(`${SESSION_TRANSCRIPT_PREFIX}${sessionId}`, [])
}

function writeTranscript(sessionId: string, history: ChatEntry[]) {
  writeJson(`${SESSION_TRANSCRIPT_PREFIX}${sessionId}`, history)
}

function formatSessionTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function makeNewSessionMeta(sessionId: string, firstQuestion: string): ChatSessionRecord {
  return {
    sessionId,
    firstQuestion,
    timestamp: Date.now(),
  }
}

export function ChatSessionPage({ initialSessionId = null }: ChatSessionPageProps) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([])
  const activeRequestRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasMessages = history.length > 0
  const hasSession = Boolean(sessionId)
  const sessionLabel = useMemo(() => {
    if (!sessionId) {
      return 'Upload a PDF to start a session'
    }

    return `Session: ${sessionId}`
  }, [sessionId])

  useEffect(() => {
    setSessions(readSessionIndex())
  }, [])

  useEffect(() => {
    setSessionId(initialSessionId)
  }, [initialSessionId])

  useEffect(() => {
    if (!canUseLocalStorage()) {
      return
    }

    window.localStorage.setItem(THEME_KEY, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (!sessionId) {
      setHistory([])
      return
    }

    setHistory(readTranscript(sessionId))
  }, [sessionId])

  useEffect(
    () => () => {
      activeRequestRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!sessionId) {
      return
    }

    writeTranscript(sessionId, history)
  }, [history, sessionId])

  useEffect(() => {
    writeSessionIndex(sessions)
  }, [sessions])

  const updateHistoryEntry = (entryId: string, updater: (entry: ChatEntry) => ChatEntry) => {
    setHistory((prev) => prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)))
  }

  const upsertSessionMeta = (nextSessionId: string, firstQuestion: string) => {
    setSessions((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.sessionId === nextSessionId)
      if (existingIndex === -1) {
        return [makeNewSessionMeta(nextSessionId, firstQuestion), ...prev]
      }

      const next = [...prev]
      const existing = next[existingIndex]
      next[existingIndex] = {
        ...existing,
        firstQuestion: existing.firstQuestion || firstQuestion,
        timestamp: existing.timestamp || Date.now(),
      }

      return next.sort((a, b) => b.timestamp - a.timestamp)
    })
  }

  const clearActiveChat = () => {
    activeRequestRef.current?.abort()
    setSessionId(null)
    setQuestion('')
    setHistory([])
    setError(null)
    setUploadError(null)
    void navigate({ to: '/' })
  }

  const openSession = (nextSessionId: string) => {
    activeRequestRef.current?.abort()
    setSessionId(nextSessionId)
    setQuestion('')
    setError(null)
    setUploadError(null)
    setHistory(readTranscript(nextSessionId))
    void navigate({ to: '/chat/$sessionId', params: { sessionId: nextSessionId } })
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.set('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json().catch(() => null)) as UploadResponse | null

      if (!response.ok || !payload?.sessionId) {
        setUploadError(payload?.error ?? 'Upload failed. Please try again.')
        return
      }

      setSessionId(payload.sessionId)
      setQuestion('')
      setError(null)
      setHistory([])
      activeRequestRef.current?.abort()
      setUploadError(null)
      void navigate({ to: '/chat/$sessionId', params: { sessionId: payload.sessionId } })
    } catch {
      setUploadError('Upload failed. Please check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please choose a PDF file.')
      return
    }

    await handleUpload(file)
  }

  const handleSessionSelect = (nextSessionId: string) => {
    openSession(nextSessionId)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isSending || isUploading || !sessionId) {
      return
    }

    if (history.length === 0) {
      upsertSessionMeta(sessionId, trimmedQuestion)
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
        const payload = (await response.json().catch(() => null)) as UploadResponse | null
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

  const newChatLabel = hasSession ? 'New chat' : 'Start fresh'
  const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 bg-slate-100 px-6 py-8 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Edora</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Chat history</h2>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{themeLabel}</span>
            </button>

            <button
              type="button"
              onClick={clearActiveChat}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {newChatLabel}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Your past chats will appear here after you ask a question.
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = session.sessionId === sessionId
              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => handleSessionSelect(session.sessionId)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {session.firstQuestion || 'Untitled chat'}
                    </p>
                    <Clock3 className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatSessionTimestamp(session.timestamp)}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Edora
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Learning chat</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sessionLabel}</p>
            </div>
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <p>{hasSession ? 'PDF uploaded' : 'Upload a PDF to enable chat'}</p>
              {isUploading ? <p className="font-medium text-indigo-600 dark:text-indigo-400">Uploading…</p> : null}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Conversation</h2>

          <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-2">
            {!hasMessages ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Upload a PDF, then ask your first question about it.
              </p>
            ) : null}

            {history.map((entry) => (
              <article
                key={entry.id}
                className="space-y-3 rounded-xl border border-slate-200 p-4 transition-colors dark:border-slate-800"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    You
                  </p>
                  <p className="mt-1 text-slate-900 dark:text-slate-100">{entry.question}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    Edora
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {entry.answer || (entry.isStreaming ? 'Thinking…' : '')}
                    {entry.isStreaming ? '▍' : ''}
                  </p>
                  {entry.error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{entry.error}</p> : null}
                </div>

                {entry.quiz && entry.quiz.length > 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 transition-colors dark:bg-slate-800/60">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick quiz</p>
                    <div className="mt-3 space-y-4">
                      {entry.quiz.map((quizItem, quizIndex) => (
                        <div key={`${entry.id}-quiz-${quizIndex}`} className="space-y-2">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {quizIndex + 1}. {quizItem.question}
                          </p>
                          <ol className="list-decimal space-y-1 pl-6 text-sm text-slate-700 dark:text-slate-300">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ask a question</h2>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-end gap-2 rounded-xl border border-slate-300 p-3 transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-700 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-900/50">
              <button
                type="button"
                onClick={handleUploadButtonClick}
                disabled={isUploading}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Upload PDF"
                title={hasSession ? 'Upload a new PDF' : 'Upload a PDF'}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>

              <textarea
                id="question-input"
                value={question}
                onChange={(event) => setQuestion(event.currentTarget.value)}
                rows={3}
                placeholder={
                  hasSession ? 'Ask a question about the uploaded PDF…' : 'Upload a PDF to unlock chat'
                }
                disabled={!hasSession || isUploading || isSending}
                className="min-h-12 flex-1 resize-none border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500"
              />

              <button
                type="submit"
                disabled={!hasSession || isUploading || isSending || !question.trim()}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:bg-indigo-800"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">{isSending ? 'Sending…' : 'Send'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className={hasSession ? 'text-slate-500 dark:text-slate-400' : 'text-indigo-600 dark:text-indigo-400'}>
                {hasSession
                  ? 'Chat is ready. You can upload a different PDF anytime.'
                  : 'Choose a PDF to start chatting.'}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {isUploading
                  ? 'Uploading PDF…'
                  : isSending
                    ? 'Streaming answer…'
                    : uploadError
                      ? uploadError
                      : error ?? ''}
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

export {}



