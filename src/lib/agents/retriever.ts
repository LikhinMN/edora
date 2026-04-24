import type { EdoraState } from "../types";
import { sessionVectorStoreRegistry } from "../rag/vector-store-registry";

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

  const vectorStore = sessionVectorStoreRegistry.getSessionVectorStore(sessionId);
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


