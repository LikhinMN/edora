import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        const result = streamText({
            model: google("gemini-2.5-flash"),
            prompt,
        });
        return result.toUIMessageStreamResponse();
    } catch (error) {
        console.error("Error streaming text:", error);
        return new Response("Failed to stream text", { status: 500 });
    }
}