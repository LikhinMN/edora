import { describe, expect, it } from "vitest";
import { parseSupervisorDecision } from "./supervisor";

describe("parseSupervisorDecision", () => {
  it("parses strict JSON output", () => {
    expect(parseSupervisorDecision('{"route":"retriever"}')).toBe("retriever");
    expect(parseSupervisorDecision('{"intent":"websearch"}')).toBe("websearch");
    expect(parseSupervisorDecision('{"decision":"both"}')).toBe("both");
  });

  it("parses plain text outputs", () => {
    expect(parseSupervisorDecision("answer")).toBe("answer");
    expect(parseSupervisorDecision("Use retriever for this.")).toBe("retriever");
  });

  it("handles synonyms", () => {
    expect(parseSupervisorDecision("Use RAG routing")).toBe("retriever");
    expect(parseSupervisorDecision("internet lookup needed")).toBe("websearch");
    expect(parseSupervisorDecision("hybrid route")).toBe("both");
  });

  it("returns null for unparseable output", () => {
    expect(parseSupervisorDecision("maybe")).toBeNull();
    expect(parseSupervisorDecision("   ")).toBeNull();
  });
});

