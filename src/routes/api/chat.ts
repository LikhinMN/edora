import { createFileRoute } from "@tanstack/react-router";
import type { EdoraState } from "#/lib/types";
import {
  encodeChatStreamChunk,
  extractAnswerAndQuizFromUpdates,
  isCustomStreamChunk,
  isUpdateStreamChunk,
} from "#/lib/chat-stream";

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
        const { graph } = await import("#/lib/graph");
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

          const stream = await graph.stream(initialState, {
            streamMode: ["custom", "updates"],
            signal: request.signal,
          });

          const encoder = new TextEncoder();

          return new Response(
            new ReadableStream<Uint8Array>({
              async start(controller) {
                let streamedAnswer = "";
                let latestAnswer = "";
                let latestQuiz: EdoraState["quiz"] = null;

                try {
                  for await (const chunk of stream) {
                    if (isCustomStreamChunk(chunk) && typeof chunk[1] === "string") {
                      const token = chunk[1];
                      if (!token) {
                        continue;
                      }

                      streamedAnswer += token;
                      controller.enqueue(
                        encoder.encode(
                          encodeChatStreamChunk({
                            type: "token",
                            token,
                          }),
                        ),
                      );
                      continue;
                    }

                    if (isUpdateStreamChunk(chunk)) {
                      const { answer, quiz } = extractAnswerAndQuizFromUpdates(chunk[1]);
                      if (answer) {
                        latestAnswer = answer;
                      }

                      if (typeof quiz !== "undefined") {
                        latestQuiz = quiz;
                      }
                    }
                  }

                  controller.enqueue(
                    encoder.encode(
                      encodeChatStreamChunk({
                        type: "done",
                        answer: streamedAnswer.trim() || latestAnswer.trim(),
                        quiz: latestQuiz,
                      }),
                    ),
                  );
                } catch {
                  if (!request.signal.aborted) {
                    controller.enqueue(
                      encoder.encode(
                        encodeChatStreamChunk({
                          type: "error",
                          error: "Failed to process chat request",
                        }),
                      ),
                    );
                  }
                } finally {
                  controller.close();
                }
              },
            }),
            {
              headers: {
                "content-type": "application/x-ndjson; charset=utf-8",
                "cache-control": "no-cache, no-transform",
              },
            },
          );
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
