import { createFileRoute } from '@tanstack/react-router'
import { ChatSessionPage } from '../lib/session-chat-page.tsx'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <ChatSessionPage />
}
