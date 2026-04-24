export interface EdoraState {
  question: string
  subject: string
  gradeLevel: number
  retrievedDocs: string[]
  webResults: string[]
  answer: string
  quiz: QuizQuestion[] | null
  chatHistory: Message[]
  sessionId: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}
