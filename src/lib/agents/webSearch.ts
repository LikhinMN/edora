import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import type { EdoraState } from "../types";

const DEFAULT_WEB_RESULT_COUNT = 5;

type DuckDuckGoResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

function normalizeResult(result: DuckDuckGoResult): string {
  const parts = [result.title, result.snippet, result.link].filter(Boolean);
  return parts.join("\n").trim();
}

function parseDuckDuckGoResults(output: string): string[] {
  try {
    const parsed = JSON.parse(output) as DuckDuckGoResult[];
    return parsed.map(normalizeResult).filter(Boolean);
  } catch {
    return output
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

export async function webSearch(state: EdoraState): Promise<EdoraState> {
  const question = state.question.trim();
  if (!question) {
    return {
      ...state,
      webResults: [],
    };
  }

  const tool = new DuckDuckGoSearch({ maxResults: DEFAULT_WEB_RESULT_COUNT });
  const result = await tool.invoke(question);

  const webResults = parseDuckDuckGoResults(String(result));

  return {
    ...state,
    webResults: webResults.slice(0, DEFAULT_WEB_RESULT_COUNT),
  };
}

export const webSearchNode = webSearch;
void webSearchNode;

