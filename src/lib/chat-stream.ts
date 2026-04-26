import type { QuizQuestion } from "./types";

export type ChatStreamChunk =
  | { type: "token"; token: string }
  | { type: "done"; answer: string; quiz: QuizQuestion[] | null }
  | { type: "error"; error: string };

type StreamMessageChunk = [unknown, Record<string, unknown>];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.question === "string" &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === "string") &&
    typeof value.correctIndex === "number" &&
    typeof value.explanation === "string"
  );
}

export function isQuizQuestionArray(value: unknown): value is QuizQuestion[] {
  return Array.isArray(value) && value.every(isQuizQuestion);
}

export function encodeChatStreamChunk(chunk: ChatStreamChunk): string {
  return `${JSON.stringify(chunk)}\n`;
}

export function parseChatStreamChunkLine(line: string): ChatStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return null;
    }

    if (parsed.type === "token" && typeof parsed.token === "string") {
      return { type: "token", token: parsed.token };
    }

    if (parsed.type === "done" && typeof parsed.answer === "string") {
      return {
        type: "done",
        answer: parsed.answer,
        quiz: isQuizQuestionArray(parsed.quiz) ? parsed.quiz : null,
      };
    }

    if (parsed.type === "error" && typeof parsed.error === "string") {
      return { type: "error", error: parsed.error };
    }
  } catch {
    return null;
  }

  return null;
}

export function extractStreamText(content: unknown): string[] {
  if (typeof content === "string") {
    return content ? [content] : [];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((part) => {
    if (typeof part === "string") {
      return part ? [part] : [];
    }

    if (isRecord(part) && typeof part.text === "string" && part.text) {
      return [part.text];
    }

    return [];
  });
}

export function isExplainerMessageMetadata(metadata: unknown): boolean {
  return (
    isRecord(metadata) &&
    (metadata.langgraph_node === "explainer" || metadata.node === "explainer")
  );
}

export function isMessageStreamChunk(chunk: unknown): chunk is ["messages", StreamMessageChunk] {
  return (
    Array.isArray(chunk) &&
    chunk.length === 2 &&
    chunk[0] === "messages" &&
    Array.isArray(chunk[1]) &&
    chunk[1].length === 2
  );
}

export function isCustomStreamChunk(chunk: unknown): chunk is ["custom", unknown] {
  return Array.isArray(chunk) && chunk.length === 2 && chunk[0] === "custom";
}

export function isUpdateStreamChunk(chunk: unknown): chunk is ["updates", Record<string, unknown>] {
  return (
    Array.isArray(chunk) &&
    chunk.length === 2 &&
    chunk[0] === "updates" &&
    isRecord(chunk[1])
  );
}

export function extractAnswerAndQuizFromUpdates(updates: Record<string, unknown>): {
  answer?: string;
  quiz?: QuizQuestion[] | null;
} {
  const answerCandidate = updates.explainer;
  const quizCandidate = updates.quizzer;

  const answer =
    isRecord(answerCandidate) && typeof answerCandidate.answer === "string"
      ? answerCandidate.answer
      : undefined;

  const quiz =
    isRecord(quizCandidate) && isQuizQuestionArray(quizCandidate.quiz)
      ? quizCandidate.quiz
      : undefined;

  return { answer, quiz };
}

export {}

