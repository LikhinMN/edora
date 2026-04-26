import {
  BookOpenCheck,
  BrainCircuit,
  CircleHelp,
  FileText,
  Loader2,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
} from 'lucide-react'
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
  createdAt?: number
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
  if (typeof window === 'undefined') {
    return 'light'
  }

  if (canUseLocalStorage()) {
    try {
      const stored = window.localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') {
        return stored
      }
    } catch {
      // Ignore storage access issues and use media preference fallback.
    }
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

function formatMessageTimestamp(timestamp?: number): string {
  if (typeof timestamp !== 'number') {
    return ''
  }

  return new Date(timestamp).toLocaleTimeString([], {
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
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')
  const [quizSelections, setQuizSelections] = useState<Record<string, number>>({})
  const activeRequestRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null)

  const hasMessages = history.length > 0
  const hasSession = Boolean(sessionId)
  const hasConversation = hasSession && hasMessages
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
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme

    if (!canUseLocalStorage()) {
      return
    }

    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Ignore storage access issues; theme still applies in-memory.
    }
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

  const filteredSessions = useMemo(() => {
    const query = sessionSearchQuery.trim().toLowerCase()
    if (!query) {
      return sessions
    }

    return sessions.filter((session) => session.firstQuestion.toLowerCase().includes(query))
  }, [sessionSearchQuery, sessions])

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
    setQuizSelections({})
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
    setQuizSelections({})
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
      setQuizSelections({})
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
          createdAt: Date.now(),
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
  const quickStarts = [
    {
      title: 'Explain a concept',
      subtitle: 'Break it down with examples from my PDF.',
      prompt: 'Explain the most important concept in this chapter with a simple example.',
      icon: BrainCircuit,
    },
    {
      title: 'Revision summary',
      subtitle: 'Turn this chapter into a concise recap.',
      prompt: 'Create a concise revision summary from this PDF with key formulas and definitions.',
      icon: FileText,
    },
    {
      title: 'Practice quiz',
      subtitle: 'Generate a short test and explain answers.',
      prompt: 'Generate a 5-question quiz from this PDF and explain each correct answer.',
      icon: BookOpenCheck,
    },
  ]

  return (
    <main className="min-h-screen bg-[var(--main-bg)] text-[var(--text-primary)] transition-colors">
      <aside className="flex max-h-[42vh] flex-col border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 py-5 text-[var(--sidebar-text)] transition-colors md:fixed md:inset-y-0 md:left-0 md:max-h-none md:w-[240px] md:border-b-0 md:border-r">
        <div>
          <h2 className="font-['Instrument_Serif',serif] text-[18px] font-medium tracking-[0.02em]">Edora</h2>
          <p className="mt-1 text-[0.75rem] tracking-[0.06em] text-[var(--sidebar-muted)]">Study Chat</p>
          <button
            type="button"
            onClick={clearActiveChat}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(108,99,255,0.28)] transition duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            {newChatLabel}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel-bg)] px-3 py-2 transition-colors">
          <Search className="h-4 w-4 text-[var(--sidebar-muted)]" />
          <input
            value={sessionSearchQuery}
            onChange={(event) => setSessionSearchQuery(event.currentTarget.value)}
            placeholder="Search sessions"
            className="w-full bg-transparent text-[0.8125rem] text-[var(--sidebar-text)] placeholder:text-[var(--sidebar-muted)] focus:outline-none"
          />
        </div>

        <p className="mt-5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">Recent</p>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
          {filteredSessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--sidebar-empty-border)] px-3 py-2 text-[0.8125rem] text-[var(--sidebar-muted)]">
              No sessions yet.
            </p>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.sessionId === sessionId
              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => handleSessionSelect(session.sessionId)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition duration-150 ${
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]'
                  }`}
                >
                  <p className="truncate text-[0.8125rem] font-medium">{session.firstQuestion || 'Untitled session'}</p>
                  <p className="mt-1 text-[0.75rem] text-[var(--sidebar-muted)]">
                    {formatSessionTimestamp(session.timestamp)}
                  </p>
                </button>
              )
            })
          )}
        </div>

        <div className="mt-4 border-t border-[var(--sidebar-divider)] pt-3 text-[0.8125rem] text-[var(--sidebar-muted)]">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-[var(--sidebar-hover-bg)]"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {themeLabel}
          </button>
          <div className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2">
            <Settings className="h-4 w-4" />
            Settings
          </div>
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <CircleHelp className="h-4 w-4" />
            Help
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-[240px]">
        <header className="border-b border-[var(--border)] bg-[var(--main-bg)]/95 px-6 py-5 backdrop-blur-md">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Session</p>
          <h1 className="mt-1 font-['Instrument_Serif',serif] text-[1.5rem] font-medium leading-tight">{sessionLabel}</h1>
        </header>

        <section className="flex-1 overflow-y-auto px-6 py-8">
          {!hasConversation ? (
            <div className="mx-auto flex min-h-[56vh] w-full max-w-3xl flex-col items-center justify-center text-center">
              <h2
                className="animate-[fade-up_400ms_ease-out_forwards] text-[2.5rem] font-medium leading-tight opacity-0 font-['Instrument_Serif',serif]"
                style={{ animationDelay: '0ms' }}
              >
                Study smarter with Edora
              </h2>
              <p
                className="mt-3 max-w-2xl animate-[fade-up_400ms_ease-out_forwards] text-[0.9375rem] text-[var(--text-muted)] opacity-0"
                style={{ animationDelay: '100ms' }}
              >
                Upload a chapter PDF and ask focused questions, generate revision summaries, and test yourself with
                instant quizzes.
              </p>
              <div
                className="mt-7 grid w-full gap-3 sm:grid-cols-3 animate-[fade-up_400ms_ease-out_forwards] opacity-0"
                style={{ animationDelay: '200ms' }}
              >
                {quickStarts.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => {
                      setQuestion(card.prompt)
                      questionInputRef.current?.focus()
                    }}
                    className="group rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                      <card.icon className="h-4 w-4" />
                    </div>
                    <p className="text-[1.125rem] font-semibold leading-snug">{card.title}</p>
                    <p className="mt-2 text-[0.8125rem] text-[var(--text-muted)]">{card.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-8">
              {history.map((entry, index) => (
                <article
                  key={entry.id}
                  className="space-y-4 animate-[fade-up_150ms_ease-out_forwards] opacity-0"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <div className="flex items-start justify-end gap-3">
                    <div className="max-w-[80%]">
                      <div className="rounded-2xl rounded-br-md bg-[var(--accent-soft)] px-4 py-3 text-[0.9375rem] leading-relaxed text-[var(--text-primary)] shadow-[0_2px_10px_rgba(15,15,15,0.05)]">
                        {entry.question}
                      </div>
                      <p className="mt-1 text-right text-[0.8125rem] text-[var(--text-subtle)]">
                        {formatMessageTimestamp(entry.createdAt)}
                      </p>
                    </div>
                    <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--hover-bg)] text-[0.6875rem] font-semibold text-[var(--text-muted)]">
                      You
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.75rem] font-semibold text-white">
                      E
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                        {entry.answer || (entry.isStreaming ? 'Thinking…' : '')}
                        {entry.isStreaming ? '▍' : ''}
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-[var(--text-subtle)]">
                        {formatMessageTimestamp(entry.createdAt)}
                      </p>
                      {entry.error ? <p className="mt-2 text-[0.8125rem] text-[var(--error)]">{entry.error}</p> : null}
                    </div>
                  </div>

                  {entry.quiz && entry.quiz.length > 0 ? (
                    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--shadow-sm)]">
                      <p className="text-[1.125rem] font-semibold">Quick quiz</p>
                      {entry.quiz.map((quizItem, quizIndex) => {
                        const selectionKey = `${entry.id}:${quizIndex}`
                        const selectedOption = quizSelections[selectionKey]
                        const hasAnswered = typeof selectedOption === 'number'

                        return (
                          <div key={selectionKey} className="rounded-xl border border-[var(--border-subtle)] p-4">
                            <p className="text-[1.125rem] font-semibold leading-snug">{quizItem.question}</p>
                            <div className="mt-3 space-y-2">
                              {quizItem.options.map((option, optionIndex) => {
                                const isCorrect = optionIndex === quizItem.correctIndex
                                const isSelected = optionIndex === selectedOption

                                let optionClassName =
                                  'border-[var(--border)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]'
                                if (hasAnswered && isCorrect) {
                                  optionClassName =
                                    'border-[color:var(--success)/0.45] bg-[color:var(--success)/0.12] text-[color:var(--success)]'
                                } else if (hasAnswered && isSelected && !isCorrect) {
                                  optionClassName =
                                    'border-[color:var(--error)/0.45] bg-[color:var(--error)/0.1] text-[color:var(--error)]'
                                }

                                return (
                                  <button
                                    key={`${selectionKey}:${optionIndex}`}
                                    type="button"
                                    disabled={hasAnswered}
                                    onClick={() =>
                                      setQuizSelections((current) => ({
                                        ...current,
                                        [selectionKey]: optionIndex,
                                      }))
                                    }
                                    className={`w-full rounded-lg border px-3 py-2 text-left text-[0.9375rem] transition ${optionClassName}`}
                                  >
                                    {option}
                                  </button>
                                )
                              })}
                            </div>
                            {hasAnswered ? (
                              <p className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-[0.8125rem] text-[var(--text-muted)]">
                                {quizItem.explanation}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--main-bg)]/95 px-6 py-4 backdrop-blur-md">
          <form className="mx-auto w-full max-w-3xl space-y-2" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-[var(--shadow-sm)] transition duration-200 focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-md)]">
              <button
                type="button"
                onClick={handleUploadButtonClick}
                disabled={isUploading}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Upload PDF"
                title={hasSession ? 'Upload a new PDF' : 'Upload a PDF'}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>

              <textarea
                ref={questionInputRef}
                id="question-input"
                value={question}
                onChange={(event) => setQuestion(event.currentTarget.value)}
                rows={2}
                placeholder={hasSession ? 'Ask anything from your PDF…' : 'Upload a PDF to unlock chat'}
                disabled={!hasSession || isUploading || isSending}
                className="min-h-12 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[0.9375rem] placeholder:text-[var(--text-subtle)] focus:outline-none disabled:cursor-not-allowed"
              />

              <button
                type="submit"
                disabled={!hasSession || isUploading || isSending || !question.trim()}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-white shadow-[0_6px_20px_rgba(108,99,255,0.28)] transition duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? 'Sending' : 'Send'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] text-[var(--text-muted)]">
              <p>{hasSession ? 'PDF ready for chat.' : 'Choose a PDF to start.'}</p>
              <p>{isUploading ? 'Uploading…' : isSending ? 'Streaming…' : uploadError || error || ''}</p>
            </div>
          </form>
        </footer>
      </div>
    </main>
  )
}

export {}
