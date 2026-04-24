import type { EdoraState } from "../types";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

declare global {
  var __edoraSessionVectorStores:
    | Map<string, MemoryVectorStore>
    | undefined;
}

function getSessionVectorStore(sessionId: string): MemoryVectorStore | undefined {
  return globalThis.__edoraSessionVectorStores?.get(sessionId);
}

const DEFAULT_RETRIEVAL_K = 5;

function stringifyDoc(pageContent: string): string {
  return pageContent.trim();
}

export async function retriever(state: EdoraState): Promise<EdoraState> {
  const { question, sessionId } = state;

  if (!question.trim() || !sessionId.trim()) {
    return {
      ...state,
      retrievedDocs: [],
    };
  }

  const vectorStore = getSessionVectorStore(sessionId);
  if (!vectorStore) {
    return {
      ...state,
      retrievedDocs: [],
    };
  }

  const docs = (await vectorStore.similaritySearch(
    question,
    DEFAULT_RETRIEVAL_K,
  )) as Array<{ pageContent: string }>;

  return {
    ...state,
    retrievedDocs: docs.map((doc: { pageContent: string }) =>
      stringifyDoc(doc.pageContent),
    ),
  };
}

export const retrieverNode = retriever;
void retrieverNode;


