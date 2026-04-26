import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { Message, QuizQuestion } from "./types";
import { retriever } from "./agents/retriever";
import { webSearch } from "./agents/webSearch";
import { explainer } from "./agents/explainer";
import { quizzer } from "./agents/quizzer";
import { supervisor } from "./agents/supervisor";
import type { SupervisorRoute } from "./agents/supervisor";

const EdoraGraphState = Annotation.Root({
  question: Annotation<string>(),
  subject: Annotation<string>(),
  gradeLevel: Annotation<number>(),
  retrievedDocs: Annotation<string[]>(),
  webResults: Annotation<string[]>(),
  answer: Annotation<string>(),
  quiz: Annotation<QuizQuestion[] | null>(),
  chatHistory: Annotation<Message[]>(),
  sessionId: Annotation<string>(),
});

type GraphState = typeof EdoraGraphState.State;

function routeSupervisorDecision(route: SupervisorRoute): "retriever" | "webSearch" | ["retriever", "webSearch"] | "explainer" {
  switch (route) {
    case "retriever":
      return "retriever";
    case "websearch":
      return "webSearch";
    case "both":
      return ["retriever", "webSearch"];
    case "answer":
    default:
      return "explainer";
  }
}

const graphBuilder = new StateGraph(EdoraGraphState)
  .addNode("supervisor", async () => ({}))
  .addNode("retriever", retriever)
  .addNode("webSearch", webSearch)
  .addNode("explainer", explainer)
  .addNode("quizzer", quizzer)
  .addEdge(START, "supervisor")
  .addConditionalEdges(
    "supervisor",
    async (state: GraphState) => routeSupervisorDecision(await supervisor(state)),
  )
  .addEdge("retriever", "explainer")
  .addEdge("webSearch", "explainer")
  .addEdge("explainer", "quizzer")
  .addEdge("quizzer", END);

export const graph = graphBuilder.compile({ name: "edora" });

void graph;


