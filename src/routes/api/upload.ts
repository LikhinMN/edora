import { createFileRoute } from "@tanstack/react-router";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((value, index) => bytes[index] === value);
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ingestPdf } = await import("#/lib/rag/ingest");
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("multipart/form-data")) {
          return badRequest("Content-Type must be multipart/form-data");
        }

        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
          return badRequest("Form field 'file' is required");
        }

        if (file.type && file.type !== "application/pdf") {
          return badRequest("Uploaded file must be a PDF");
        }

        const pdfBytes = new Uint8Array(await file.arrayBuffer());
        if (!hasPdfSignature(pdfBytes)) {
          return badRequest("Uploaded file is not a valid PDF");
        }

        const sessionId = crypto.randomUUID();
        await ingestPdf(pdfBytes, sessionId);

        return Response.json({ sessionId });
      },
    },
  },
});
