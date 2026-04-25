import { createFileRoute } from "@tanstack/react-router";
import { graph } from "#/lib/graph";
import type { EdoraState } from "#/lib/types";

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function buildInitialState(question: string, sessionId: string): EdoraState {
  return {
    question,
    subject: "",
    gradeLevel: 10,
    retrievedDocs: [],
    webResults: [],
    answer: "",
    quiz: null,
    chatHistory: [],
    sessionId,
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return badRequest("Content-Type must be application/json");
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return badRequest("Request body must be valid JSON");
        }

        if (typeof body !== "object" || body === null) {
          return badRequest("Request body must be an object");
        }

        const { question, sessionId } = body as Record<string, unknown>;

        if (typeof question !== "string" || !question.trim()) {
          return badRequest("Field 'question' is required");
        }

        if (typeof sessionId !== "string" || !sessionId.trim()) {
          return badRequest("Field 'sessionId' is required");
        }

        try {
          const initialState = buildInitialState(question.trim(), sessionId.trim());
          const finalState = (await graph.invoke(initialState)) as EdoraState;

          return Response.json({
            answer: finalState.answer,
            quiz: finalState.quiz,
          });
        } catch {
          return Response.json(
            { error: "Failed to process chat request" },
            { status: 500 },
          );
        }
      },
    },
  },
});

