import { createFileRoute } from '@tanstack/react-router'
import { ChatSessionPage } from '#/lib/session-chat-page'

export const Route = createFileRoute('/chat/$sessionId')({
  component: SessionChatPage,
})

function SessionChatPage() {
  const { sessionId } = Route.useParams()

  return <ChatSessionPage initialSessionId={sessionId} />
}
