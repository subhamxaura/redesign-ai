import { NextResponse } from "next/server";
import {
  fileToInlineData,
  GEMINI_STRUCTURED_MODEL,
  getErrorMessage,
  getGeminiClient,
  validateImageUpload,
  withGeminiRetry,
} from "@/app/lib/gemini";
import {
  parseRedesignSpecJson,
  redesignResponseSchema,
} from "@/app/lib/redesign";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = validateImageUpload(formData.get("image"));

    if (!image.ok) {
      return NextResponse.json(
        { error: image.error },
        { status: image.status }
      );
    }

    const ai = getGeminiClient();
    const imagePart = await fileToInlineData(image.file);
    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: GEMINI_STRUCTURED_MODEL,
        contents: [
          imagePart,
          {
            text: `
You are an expert UI/UX designer and frontend developer.

Analyze the uploaded website or app screenshot and create a modern redesign specification.

Rules:
- Preserve the original website's main purpose.
- Use realistic content based on what is visible.
- Do not invent unrelated sections.
- Choose colors that match the original brand.
- Keep the result practical for a Next.js and Tailwind CSS developer.
- Return only JSON matching the requested schema.
          `,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: redesignResponseSchema,
        },
      })
    );
    const rawText = response.text?.trim();

    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty redesign." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redesign: parseRedesignSpecJson(rawText),
    });
  } catch (error: unknown) {
    console.error("Redesign generation error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to generate redesign."),
      },
      { status: 500 }
    );
  }
}
