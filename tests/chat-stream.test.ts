import { describe, expect, it } from "vitest";
import {
  encodeChatStreamChunk,
  extractAnswerAndQuizFromUpdates,
  extractStreamText,
  isExplainerMessageMetadata,
  parseChatStreamChunkLine,
} from "#/lib/chat-stream";

describe("chat stream helpers", () => {
  it("encodes and parses token chunks", () => {
    const line = encodeChatStreamChunk({ type: "token", token: "Hello" }).trim();

    expect(parseChatStreamChunkLine(line)).toEqual({ type: "token", token: "Hello" });
  });

  it("encodes and parses done chunks", () => {
    const line = encodeChatStreamChunk({
      type: "done",
      answer: "Final answer",
      quiz: [
        {
          question: "Q1",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because A",
        },
      ],
    }).trim();

    expect(parseChatStreamChunkLine(line)).toEqual({
      type: "done",
      answer: "Final answer",
      quiz: [
        {
          question: "Q1",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because A",
        },
      ],
    });
  });

  it("returns null for malformed lines", () => {
    expect(parseChatStreamChunkLine("not json")).toBeNull();
    expect(parseChatStreamChunkLine('{"type":"token"}')).toBeNull();
  });

  it("extracts text content from streamed messages", () => {
    expect(
      extractStreamText([
        "Hello",
        { text: "world" },
        { ignored: true },
      ]),
    ).toEqual(["Hello", "world"]);
  });

  it("detects explainer metadata", () => {
    expect(isExplainerMessageMetadata({ langgraph_node: "explainer" })).toBe(true);
    expect(isExplainerMessageMetadata({ node: "explainer" })).toBe(true);
    expect(isExplainerMessageMetadata({ langgraph_node: "quizzer" })).toBe(false);
  });

  it("extracts answer and quiz updates", () => {
    expect(
      extractAnswerAndQuizFromUpdates({
        explainer: { answer: "Streamed answer" },
        quizzer: {
          quiz: [
            {
              question: "Q1",
              options: ["A", "B", "C", "D"],
              correctIndex: 0,
              explanation: "A is correct",
            },
          ],
        },
      }),
    ).toEqual({
      answer: "Streamed answer",
      quiz: [
        {
          question: "Q1",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "A is correct",
        },
      ],
    });
  });
});

