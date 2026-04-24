import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

type Registry = Map<string, MemoryVectorStore>;

declare global {
  // eslint-disable-next-line no-var
  var __edoraSessionVectorStores: Registry | undefined;
}

const registry: Registry =
  globalThis.__edoraSessionVectorStores ??
  (globalThis.__edoraSessionVectorStores = new Map<string, MemoryVectorStore>());

export function registerSessionVectorStore(
  sessionId: string,
  vectorStore: MemoryVectorStore,
): void {
  registry.set(sessionId, vectorStore);
}

export function getSessionVectorStore(
  sessionId: string,
): MemoryVectorStore | undefined {
  return registry.get(sessionId);
}

export function removeSessionVectorStore(sessionId: string): boolean {
  return registry.delete(sessionId);
}


