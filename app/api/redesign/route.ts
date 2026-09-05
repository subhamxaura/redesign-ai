import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import {
  applyAnonCookie,
  getAnonIdFromCookieHeader,
  getFreeUsage,
  isValidAnonId,
  limitReachedResponse,
  newAnonId,
  refundFreeUse,
  reserveFreeUse,
} from "@/app/lib/freeUsage";
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
  // Legacy single-shot endpoint: one completed call = exactly ONE free use.
  // Shares the centralized gate with /api/generate so a single user action
  // is never double-counted.
  let anonId: string | null = null;
  let reserved = false;
  const setAnonCookie = (res: NextResponse) => {
    if (anonId) applyAnonCookie(res, anonId);
  };

  try {
    const session = await getServerSession(authOptions);
    const isAuthed = !!session?.user?.email;

    if (!isAuthed) {
      const fromCookie = getAnonIdFromCookieHeader(request.headers.get("cookie"));
      anonId = isValidAnonId(fromCookie) ? fromCookie : newAnonId();

      const current = await getFreeUsage(anonId);
      if (current.remaining <= 0) {
        const res = NextResponse.json(limitReachedResponse(current.usage), { status: 403 });
        setAnonCookie(res);
        return res;
      }
    }

    const formData = await request.formData();
    const image = validateImageUpload(formData.get("image"));

    if (!image.ok) {
      return NextResponse.json(
        { error: image.error },
        { status: image.status }
      );
    }

    let usageAfter: number | null = null;
    if (!isAuthed && anonId) {
      const reservation = await reserveFreeUse(anonId);
      if (!reservation.allowed) {
        const res = NextResponse.json(limitReachedResponse(reservation.usage), {
          status: 403,
        });
        setAnonCookie(res);
        return res;
      }
      reserved = true;
      usageAfter = reservation.usage;
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
      if (anonId && reserved) await refundFreeUse(anonId);
      const res = NextResponse.json(
        { error: "Gemini returned an empty redesign." },
        { status: 500 }
      );
      setAnonCookie(res);
      return res;
    }

    const res = NextResponse.json({
      success: true,
      redesign: parseRedesignSpecJson(rawText),
      ...(usageAfter != null
        ? {
            usage: usageAfter,
            remaining: Math.max(0, 3 - usageAfter),
            limit: 3,
          }
        : { authenticated: true }),
    });
    setAnonCookie(res);
    return res;
  } catch (error: unknown) {
    console.error("Redesign generation error:", error);
    if (anonId && reserved) await refundFreeUse(anonId).catch(() => {});

    const res = NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to generate redesign."),
      },
      { status: 500 }
    );
    setAnonCookie(res);
    return res;
  }
}
