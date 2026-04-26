import { ChatOllama } from "@langchain/ollama";
import type { Runtime } from "@langchain/langgraph";
import type { EdoraState } from "../types";

const DEFAULT_CONTEXT_ITEMS = 10;

const llm = new ChatOllama({ model: "gemma4:e4b", temperature: 0.2 });

export function getTeachingGradeLevel(gradeLevel: number): number {
  if (!Number.isFinite(gradeLevel)) {
    return 10;
  }

  return Math.min(10, Math.max(1, Math.floor(gradeLevel)));
}

function cleanItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function combineEvidence(
  retrievedDocs: string[],
  webResults: string[],
  maxItems = DEFAULT_CONTEXT_ITEMS,
): string {
  const retrieved = cleanItems(retrievedDocs).map((item, index) =>
    `[Retrieved ${index + 1}] ${item}`,
  );
  const web = cleanItems(webResults).map((item, index) =>
    `[Web ${index + 1}] ${item}`,
  );

  return [...retrieved, ...web].slice(0, maxItems).join("\n\n");
}

export function buildExplainerPrompt(state: EdoraState, context: string): string {
  const teachingGradeLevel = getTeachingGradeLevel(state.gradeLevel);

  return [
    "You are Edora, a helpful teacher for Class 10 and below students.",
    `Teach at about a Class ${teachingGradeLevel} level.`,
    "Explain in simple language and short sentences.",
    "Avoid heavy jargon. If a technical term is needed, define it in plain words.",
    "Use one or two easy analogies when it helps understanding.",
    "Be accurate and use only the given context when making factual claims.",
    "If context is missing, say what is missing clearly and suggest what to ask next.",
    "End with a quick 2-bullet recap.",
    "",
    `Subject: ${state.subject}`,
    `Grade level: ${state.gradeLevel}`,
    `Student question: ${state.question}`,
    "",
    "Context:",
    context || "No retrieved or web context available.",
  ].join("\n");
}

export function normalizeResponseContent(content: unknown): string {
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

export async function explainer(
  state: EdoraState,
  runtime: Runtime,
): Promise<EdoraState> {
  const question = state.question.trim();
  if (!question) {
    return {
      ...state,
      answer: "Please ask a question, and I will explain it step by step.",
    };
  }

  const context = combineEvidence(state.retrievedDocs, state.webResults);
  const prompt = buildExplainerPrompt(state, context);

  try {
    const responseStream = await llm.stream(prompt);
    let answer = "";

    for await (const chunk of responseStream) {
      const token = normalizeResponseContent((chunk as { content?: unknown }).content);
      if (!token) {
        continue;
      }

      answer += token;
      runtime.writer(token);
    }

    answer = answer.trim();

    if (answer) {
      return {
        ...state,
        answer,
      };
    }
  } catch {
    // Fall through to a safe response.
  }

  return {
    ...state,
    answer:
      "I could not generate a full explanation right now. Please try again in a moment.",
  };
}

export const explainerNode = explainer;
void explainerNode;

