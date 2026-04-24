import { describe, expect, it } from "vitest";
import {
  buildExplainerPrompt,
  combineEvidence,
  getTeachingGradeLevel,
  normalizeResponseContent,
} from "#/lib/agents/explainer";
import type { EdoraState } from "#/lib/types";

const baseState: EdoraState = {
  question: "Why does rust happen?",
  subject: "Science",
  gradeLevel: 10,
  retrievedDocs: [],
  webResults: [],
  answer: "",
  quiz: null,
  chatHistory: [],
  sessionId: "session-1",
};

describe("combineEvidence", () => {
  it("combines retrieved and web context with labels", () => {
    const context = combineEvidence(
      ["Iron reacts with oxygen"],
      ["Rusting speeds up with moisture"],
    );

    expect(context).toContain("[Retrieved 1] Iron reacts with oxygen");
    expect(context).toContain("[Web 1] Rusting speeds up with moisture");
  });

  it("drops empty values", () => {
    const context = combineEvidence(["  ", "A"], ["", "B"]);
    expect(context).toContain("[Retrieved 1] A");
    expect(context).toContain("[Web 1] B");
    expect(context).not.toContain("[Retrieved 2]");
  });
});

describe("buildExplainerPrompt", () => {
  it("includes student-focused instructions and question", () => {
    const prompt = buildExplainerPrompt(baseState, "[Retrieved 1] Sample context");

    expect(prompt).toContain("Class 10 and below students");
    expect(prompt).toContain("Teach at about a Class 10 level");
    expect(prompt).toContain("simple language");
    expect(prompt).toContain("Student question: Why does rust happen?");
    expect(prompt).toContain("[Retrieved 1] Sample context");
  });
});

describe("getTeachingGradeLevel", () => {
  it("caps the teaching level at class 10", () => {
    expect(getTeachingGradeLevel(12)).toBe(10);
    expect(getTeachingGradeLevel(10)).toBe(10);
    expect(getTeachingGradeLevel(7)).toBe(7);
  });
});

describe("normalizeResponseContent", () => {
  it("normalizes string content", () => {
    expect(normalizeResponseContent("  hello  ")).toBe("hello");
  });

  it("normalizes array content", () => {
    const value = normalizeResponseContent([
      { text: "Line 1" },
      "Line 2",
      { text: "Line 3" },
    ]);

    expect(value).toContain("Line 1");
    expect(value).toContain("Line 2");
    expect(value).toContain("Line 3");
  });
});
