import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/')({ component: Home })

type UploadResponse = {
  sessionId: string
  error?: string
}

function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!file) {
      setError('Please choose a PDF file to continue.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.set('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as UploadResponse

      if (!response.ok || !payload.sessionId) {
        setError(payload.error ?? 'Upload failed. Please try again.')
        return
      }

      window.location.assign(`/chat/${encodeURIComponent(payload.sessionId)}`)
    } catch {
      setError('Upload failed. Please check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Edora</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Learn with your own PDF</h1>
        <p className="mt-2 text-slate-600">
          Upload your study material to start an AI-powered learning session.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="pdf-file">
              PDF file
            </label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {isUploading ? 'Uploading...' : 'Upload and start learning'}
          </button>
        </form>
      </div>
    </main>
  )
}
