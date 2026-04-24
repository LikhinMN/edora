import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

type Registry = Map<string, MemoryVectorStore>;

declare global {
  var __edoraSessionVectorStores: Registry | undefined;
}

const registry: Registry =
  globalThis.__edoraSessionVectorStores ??
  (globalThis.__edoraSessionVectorStores = new Map<string, MemoryVectorStore>());

function registerSessionVectorStore(
  sessionId: string,
  vectorStore: MemoryVectorStore,
): void {
  registry.set(sessionId, vectorStore);
}

function getSessionVectorStore(
  sessionId: string,
): MemoryVectorStore | undefined {
  return registry.get(sessionId);
}

function removeSessionVectorStore(sessionId: string): boolean {
  return registry.delete(sessionId);
}

export const sessionVectorStoreRegistry = {
  registerSessionVectorStore,
  getSessionVectorStore,
  removeSessionVectorStore,
};



