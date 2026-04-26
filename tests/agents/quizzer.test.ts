import { describe, expect, it } from "vitest";
import {
  buildQuizzerPrompt,
  parseQuizOutput,
} from "#/lib/agents/quizzer";
import type { EdoraState } from "#/lib/types";

const baseState: EdoraState = {
  question: "Why does rust happen?",
  subject: "Science",
  gradeLevel: 9,
  retrievedDocs: [],
  webResults: [],
  answer:
    "Rust forms when iron reacts with oxygen and water. It is a slow chemical change.",
  quiz: null,
  chatHistory: [],
  sessionId: "session-quiz",
};

describe("buildQuizzerPrompt", () => {
  it("uses the explainer answer as the quiz context", () => {
    const prompt = buildQuizzerPrompt(baseState);

    expect(prompt).toContain("Create exactly 3 multiple-choice questions");
    expect(prompt).toContain("exactly 4 options");
    expect(prompt).toContain(baseState.answer);
  });
});

describe("parseQuizOutput", () => {
  it("parses strict JSON quiz output", () => {
    const output = JSON.stringify({
      quiz: [
        {
          question: "What is rusting?",
          options: ["A physical change", "A chemical change", "Melting", "Freezing"],
          correctIndex: 1,
          explanation: "Rusting creates a new substance.",
        },
        {
          question: "Which two things help rusting happen?",
          options: ["Light and sound", "Iron and oxygen", "Water and oxygen", "Salt and sugar"],
          correctIndex: 2,
          explanation: "Water and oxygen help iron rust.",
        },
        {
          question: "How can rusting be slowed?",
          options: ["Painting metal", "Adding water", "Heating more", "Breaking metal"],
          correctIndex: 0,
          explanation: "Paint blocks air and water.",
        },
      ],
    });

    const quiz = parseQuizOutput(output);

    expect(quiz).not.toBeNull();
    expect(quiz).toHaveLength(3);
    expect(quiz?.[0].options).toHaveLength(4);
    expect(quiz?.[0].correctIndex).toBe(1);
  });

  it("parses fenced JSON output", () => {
    const output = "```json\n{\"quiz\":[{\"question\":\"Q1\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctIndex\":0,\"explanation\":\"E1\"}]}\n```";

    const quiz = parseQuizOutput(output);
    expect(quiz).not.toBeNull();
    expect(quiz?.[0].question).toBe("Q1");
  });

  it("sanitizes malformed items", () => {
    const output = JSON.stringify({
      quiz: [
        {
          question: "Q",
          options: ["A"],
          correctIndex: 9,
          explanation: "",
        },
      ],
    });

    const quiz = parseQuizOutput(output);
    expect(quiz).not.toBeNull();
    expect(quiz?.[0].options).toHaveLength(4);
    expect(quiz?.[0].correctIndex).toBe(3);
    expect(quiz?.[0].explanation.length).toBeGreaterThan(0);
  });

  it("returns null for non-JSON output", () => {
    expect(parseQuizOutput("not json")).toBeNull();
  });
});

