import { NextResponse } from "next/server";
import {
  GEMINI_MODEL,
  getErrorMessage,
  getGeminiClient,
  withGeminiRetry,
} from "@/app/lib/gemini";

export const runtime = "nodejs";

type ChatRequest = {
  message?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as ChatRequest | null;
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message must be 2000 characters or fewer." },
        { status: 400 }
      );
    }

    const ai = getGeminiClient();
    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            text: `
You are ReDesignAI Assistant, a concise UI/UX and frontend helper.
Give practical advice for website redesign, accessibility, layout, copy, and implementation.

User message:
${message}
          `,
          },
        ],
      })
    );
    const reply = response.text?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: "Gemini returned an empty reply." },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Gemini chat error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error, "Gemini API request failed."),
      },
      { status: 500 }
    );
  }
}
