import { ChatOllama } from "@langchain/ollama";
import type { EdoraState, QuizQuestion } from "../types";

const QUIZ_SIZE = 3;
const OPTIONS_PER_QUESTION = 4;

const llm = new ChatOllama({ model: "gemma4:e4b", temperature: 0.1 });

function normalizeResponseContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export function buildQuizzerPrompt(state: EdoraState): string {
  const context = state.answer.trim() || "No explanation available yet.";

  return [
    "You are Edora and you create short quizzes for Class 10 and below students.",
    "Create exactly 3 multiple-choice questions from the context.",
    "Each question must have exactly 4 options.",
    "correctIndex must be a zero-based integer from 0 to 3.",
    "Use simple language and keep explanations brief.",
    "Return only valid JSON with this exact shape:",
    '{"quiz":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}',
    "",
    `Subject: ${state.subject}`,
    `Grade level: ${state.gradeLevel}`,
    `Student question: ${state.question}`,
    "",
    "Context:",
    context,
  ].join("\n");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function clampCorrectIndex(value: unknown): number {
  const num = typeof value === "number" ? Math.floor(value) : 0;

  if (num < 0) {
    return 0;
  }

  if (num >= OPTIONS_PER_QUESTION) {
    return OPTIONS_PER_QUESTION - 1;
  }

  return num;
}

function sanitizeQuizQuestion(value: unknown, index: number): QuizQuestion {
  const fallback: QuizQuestion = {
    question: `Question ${index + 1}`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: 0,
    explanation: "This is the best option based on the lesson.",
  };

  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  const question =
    typeof record.question === "string" && record.question.trim()
      ? record.question.trim()
      : fallback.question;

  const options = toStringArray(record.options).slice(0, OPTIONS_PER_QUESTION);
  while (options.length < OPTIONS_PER_QUESTION) {
    options.push(fallback.options[options.length]);
  }

  const explanation =
    typeof record.explanation === "string" && record.explanation.trim()
      ? record.explanation.trim()
      : fallback.explanation;

  return {
    question,
    options,
    correctIndex: clampCorrectIndex(record.correctIndex),
    explanation,
  };
}

function extractQuizArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.quiz)) {
    return record.quiz;
  }

  if (Array.isArray(record.questions)) {
    return record.questions;
  }

  return [];
}

function extractJsonBlock(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return raw;
}

export function parseQuizOutput(rawOutput: string): QuizQuestion[] | null {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return null;
  }

  const jsonCandidate = extractJsonBlock(trimmed);

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    const source = extractQuizArray(parsed);

    if (source.length === 0) {
      return null;
    }

    return source
      .slice(0, QUIZ_SIZE)
      .map((item, index) => sanitizeQuizQuestion(item, index));
  } catch {
    return null;
  }
}

function fallbackQuiz(answer: string, question: string): QuizQuestion[] {
  const topic = answer.trim() || question.trim() || "the topic";

  return [
    {
      question: `Which statement best matches what we learned about ${topic.slice(0, 60)}?`,
      options: [
        "It summarizes the main idea correctly",
        "It is unrelated to the lesson",
        "It directly contradicts the explanation",
        "It only gives an opinion with no concept",
      ],
      correctIndex: 0,
      explanation: "Option A matches the key idea from the explanation.",
    },
    {
      question: "Which option is the clearest next step to understand the topic better?",
      options: [
        "Review the main definition and one example",
        "Memorize random facts without context",
        "Ignore the explanation and guess",
        "Skip practice and move to a new topic",
      ],
      correctIndex: 0,
      explanation: "Starting with definition + example builds strong understanding.",
    },
    {
      question: "Why is the correct answer the best choice?",
      options: [
        "It is supported by the explained concept",
        "It sounds longer than other options",
        "It uses difficult vocabulary",
        "It avoids the topic details",
      ],
      correctIndex: 0,
      explanation: "The best answer is the one that matches the explained concept.",
    },
  ];
}

function ensureQuizShape(quiz: QuizQuestion[]): QuizQuestion[] {
  const sanitized = quiz
    .slice(0, QUIZ_SIZE)
    .map((item, index) => sanitizeQuizQuestion(item, index));

  while (sanitized.length < QUIZ_SIZE) {
    sanitized.push(sanitizeQuizQuestion(null, sanitized.length));
  }

  return sanitized;
}

export async function quizzer(state: EdoraState): Promise<EdoraState> {
  const prompt = buildQuizzerPrompt(state);

  try {
    const response = await llm.invoke(prompt);
    const parsed = parseQuizOutput(normalizeResponseContent(response.content));

    if (parsed && parsed.length > 0) {
      return {
        ...state,
        quiz: ensureQuizShape(parsed),
      };
    }
  } catch {
    // Fall through to deterministic fallback quiz.
  }

  return {
    ...state,
    quiz: fallbackQuiz(state.answer, state.question),
  };
}

export const quizzerNode = quizzer;
void quizzerNode;

