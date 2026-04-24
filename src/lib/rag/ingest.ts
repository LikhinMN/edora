import { WebPDFLoader as PDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import { registerSessionVectorStore } from "#/lib/rag/vector-store-registry";

type PdfBuffer = ArrayBuffer | Uint8Array | Blob;

function toPdfBlob(pdfBuffer: PdfBuffer): Blob {
  if (pdfBuffer instanceof Blob) {
    return pdfBuffer;
  }

  const pdfBytes =
    pdfBuffer instanceof ArrayBuffer
      ? new Uint8Array(pdfBuffer)
      : new Uint8Array(pdfBuffer);

  return new Blob([pdfBytes], { type: "application/pdf" });
}

export async function ingestPdf(
  pdfBuffer: PdfBuffer,
  sessionId: string,
): Promise<MemoryVectorStore> {
  if (!sessionId.trim()) {
    throw new Error("sessionId is required");
  }

  const loader = new PDFLoader(toPdfBlob(pdfBuffer));
  const parsedDocuments = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunkedDocuments = await splitter.splitDocuments(
    parsedDocuments.map((document, index) => ({
      ...document,
      metadata: {
        ...document.metadata,
        sessionId,
        sourceChunkGroup: index,
      },
    })),
  );

  const embeddings = new OllamaEmbeddings({ model: "nomic-embed-text" });
  const vectorStore = new MemoryVectorStore(embeddings);

  await vectorStore.addDocuments(chunkedDocuments);
  registerSessionVectorStore(sessionId, vectorStore);

  return vectorStore;
}

