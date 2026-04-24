import { ChatOllama } from "@langchain/ollama";
import type { EdoraState } from "../types";

export type SupervisorRoute = "retriever" | "websearch" | "both" | "answer";

const SUPERVISOR_ROUTES: SupervisorRoute[] = [
  "retriever",
  "websearch",
  "both",
  "answer",
];

const ROUTE_SYNONYMS: Record<string, SupervisorRoute> = {
  retriever: "retriever",
  retrieval: "retriever",
  rag: "retriever",
  websearch: "websearch",
  web_search: "websearch",
  web: "websearch",
  search: "websearch",
  internet: "websearch",
  both: "both",
  hybrid: "both",
  answer: "answer",
  direct: "answer",
};

const llm = new ChatOllama({ model: "llama3.2:3b", temperature: 0 });

function isSupervisorRoute(value: string): value is SupervisorRoute {
  return SUPERVISOR_ROUTES.includes(value as SupervisorRoute);
}

function pickRouteFromText(text: string): SupervisorRoute | null {
  const lower = text.toLowerCase();

  const exactMatch = lower.match(/\b(retriever|websearch|both|answer)\b/);
  if (exactMatch?.[1] && isSupervisorRoute(exactMatch[1])) {
    return exactMatch[1];
  }

  for (const [token, route] of Object.entries(ROUTE_SYNONYMS)) {
    if (lower.includes(token)) {
      return route;
    }
  }

  return null;
}

function heuristicRoute(question: string): SupervisorRoute {
  const lower = question.toLowerCase();

  const needsWeb = /\b(latest|current|today|recent|news|update|202[0-9])\b/.test(
    lower,
  );
  const needsRetrieval =
    /\b(pdf|document|upload|uploaded|chapter|notes|textbook|slide)\b/.test(
      lower,
    );

  if (needsWeb && needsRetrieval) {
    return "both";
  }

  if (needsRetrieval) {
    return "retriever";
  }

  if (needsWeb) {
    return "websearch";
  }

  return "answer";
}

export function parseSupervisorDecision(rawOutput: string): SupervisorRoute | null {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | { route?: string; intent?: string; decision?: string }
      | string;

    if (typeof parsed === "string") {
      const parsedFromString = pickRouteFromText(parsed);
      if (parsedFromString) {
        return parsedFromString;
      }
    } else {
      const candidate = parsed.route ?? parsed.intent ?? parsed.decision ?? "";
      const parsedFromObject = pickRouteFromText(candidate);
      if (parsedFromObject) {
        return parsedFromObject;
      }
    }
  } catch {
    // Fall through to plain-text parsing.
  }

  return pickRouteFromText(trimmed);
}

function contentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .join("\n");
  }

  return "";
}

export async function supervisor(state: EdoraState): Promise<SupervisorRoute> {
  const question = state.question.trim();
  if (!question) {
    return "answer";
  }

  const prompt = [
    "You are a routing supervisor for an educational assistant.",
    "Classify the user question into exactly one route:",
    "- retriever: question depends on uploaded PDF/course material",
    "- websearch: question requires current/external web information",
    "- both: needs uploaded material and web context",
    "- answer: can be answered directly without retrieval or web search",
    "Return only JSON: {\"route\":\"retriever|websearch|both|answer\"}",
    `Question: ${question}`,
    `Subject: ${state.subject}`,
    `Grade level: ${state.gradeLevel}`,
  ].join("\n");

  try {
    const response = await llm.invoke(prompt);
    const parsed = parseSupervisorDecision(contentToString(response.content));
    if (parsed) {
      return parsed;
    }
  } catch {
    // Fall back to heuristics when LLM is unavailable.
  }

  return heuristicRoute(question);
}

export const supervisorNode = supervisor;
void supervisorNode;

