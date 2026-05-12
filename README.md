# Edora

Edora is a study assistant for Class 10 students. Upload a PDF, ask questions, and get streaming explanations with a short quiz to reinforce learning. It combines local document retrieval with optional web search, wrapped in a premium classroom-inspired UI.

## Features

- PDF upload to start a session and power retrieval-augmented answers
- Streaming chat responses with Markdown + LaTeX rendering
- Auto-generated 3-question quizzes after each answer
- Web search fallback (DuckDuckGo) when the question needs external context
- Session history stored locally in the browser
- Light/dark theme toggle and a defined design system

## Tech stack

- React 19 + TanStack Start/Router
- Vite + Tailwind CSS
- LangChain + LangGraph for orchestration
- Ollama for LLM + embeddings
- Vitest + Testing Library for tests

## Getting started

### Prerequisites

- Node.js and npm
- [Ollama](https://ollama.com/) running locally

Pull the required models:

```bash
ollama pull gemma4:e4b
ollama pull qwen3-embedding:0.6b
```

### Install

```bash
npm install
```

If npm reports peer dependency conflicts, retry with:

```bash
npm install --legacy-peer-deps
```

### Run locally

```bash
npm run dev
```

The app will be available at http://localhost:3000.

### Build and preview

```bash
npm run build
npm run preview
```

### Test and lint

```bash
npm run test
npm run lint
```

## Usage

1. Start the dev server.
2. Upload a PDF to create a session.
3. Ask a question about the PDF or a general topic.
4. Review the explanation and quiz to check understanding.

## Project structure

```
src/
  lib/
    agents/       # LLM agents (supervisor, explainer, quizzer, web search)
    rag/          # PDF ingestion + vector store registry
    graph.ts      # LangGraph orchestration
  routes/
    api/          # Upload + chat endpoints
    chat.$sessionId.tsx
    index.tsx
  styles.css
```

## Design system

See [DESIGN.md](./DESIGN.md) for the visual language, color system, and layout guidance.
