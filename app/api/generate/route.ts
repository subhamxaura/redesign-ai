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
  // One completed call to this endpoint = exactly ONE free use.
  // /api/analyze is deliberately NOT counted (analysis alone is not a redesign).
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

      // Fast pre-check BEFORE expensive Gemini work (friendly early 403).
      const current = await getFreeUsage(anonId);
      if (current.remaining <= 0) {
        const res = NextResponse.json(limitReachedResponse(current.usage), { status: 403 });
        setAnonCookie(res);
        return res;
      }
    }

    const formData = await request.formData();

    const image = validateImageUpload(formData.get("image"));
    const analysis = formData.get("analysis");

    if (!image.ok) {
      return NextResponse.json(
        { error: image.error },
        { status: image.status }
      );
    }

    if (typeof analysis !== "string" || !analysis.trim()) {
      return NextResponse.json(
        { error: "No design analysis provided." },
        { status: 400 }
      );
    }

    // Atomically reserve one use AFTER validation passes and BEFORE Gemini
    // runs. This closes the double-click race: two simultaneous requests
    // cannot both reserve the last slot. Refunded on any later failure so
    // failures are never counted.
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
You are a senior UI/UX designer, product designer, and expert frontend developer.

Your task is to create a structured redesign specification for the uploaded website screenshot.

You have TWO sources of information:

1. The uploaded screenshot.
2. The AI visual analysis provided below.

AI VISUAL ANALYSIS:
${analysis}

IMPORTANT SOURCE-ACCURACY RULES:

- Treat the uploaded screenshot as the primary source of truth.
- Treat the provided analysis as supporting information.
- Do NOT invent products, services, features, statistics, prices, technical specifications, awards, performance claims, company claims, or marketing claims that are not supported by the screenshot or analysis.
- Do NOT invent information about the brand or product.
- Do NOT introduce unrelated sections or features.
- Preserve the original website's purpose.
- Preserve important brand identity, visual language, and recognizable content.
- You may improve layout, spacing, hierarchy, typography, colors, accessibility, responsiveness, and interaction patterns.
- You may rewrite CTA labels when doing so improves clarity, but the new wording must remain consistent with the visible purpose of the original CTA.
- If the screenshot says "Know more", you may use something like "Explore 7 Series" only when the screenshot/analysis clearly establishes that the page is about the BMW 7 Series.
- Do not claim that a product is electric, petrol, hybrid, autonomous, etc. unless that information is explicitly supported by the screenshot or analysis.
- Do not invent descriptive marketing copy that introduces unsupported product claims.
- If content is uncertain, use concise neutral wording instead of guessing.
- Do not add functionality merely because it is technically possible.
- Keep the redesign practical for Next.js, React, TypeScript, and Tailwind CSS.

DESIGN GOALS:

- Premium
- Modern
- Accessible
- Responsive
- Clear visual hierarchy
- Strong CTA hierarchy
- Excellent typography
- Consistent spacing
- High-quality interaction design
- Production-friendly component structure

REDESIGN REQUIREMENTS:

1. Create a strong visual hierarchy.
2. Improve CTA clarity without inventing unsupported functionality.
3. Preserve important original content.
4. Improve accessibility and contrast.
5. Make the layout responsive across desktop, tablet, and mobile.
6. Create a cohesive color system based on the screenshot.
7. Create a practical typography system.
8. Provide a realistic navigation structure based on what is visible.
9. Provide realistic redesign recommendations.
10. Keep all generated copy concise and source-grounded.

CONTENT SAFETY AGAINST HALLUCINATION:

Before generating the specification, mentally compare every piece of generated content against the screenshot and analysis.

If a statement cannot reasonably be supported by either source, remove it or replace it with neutral wording.

For example:

BAD:
"Experience uncompromised electric and petrol performance."

GOOD:
"Experience the refined design and technology of the BMW 7 Series."

However, even the GOOD example should only be used if it is consistent with the supplied screenshot and analysis.

The generated specification will be rendered directly inside a live website preview, so return clean, realistic, implementation-ready content.

Return ONLY valid JSON matching the provided response schema.
Do not include Markdown.
Do not include code fences.
Do not include explanations outside the JSON.
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
      // Gemini failure — refund so failures are never counted.
      if (anonId && reserved) await refundFreeUse(anonId);
      const res = NextResponse.json(
        { error: "Gemini returned an empty redesign." },
        { status: 500 }
      );
      setAnonCookie(res);
      return res;
    }

    const redesign = parseRedesignSpecJson(rawText);

    // SUCCESS — the reservation becomes the counted use. usageAfter holds the
    // authoritative server-side count for the UI indicator.
    const res = NextResponse.json({
      success: true,
      redesign,
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
    console.error("AI redesign error:", error);
    // Any failure (Gemini 429/503/timeout/server error) refunds the slot.
    if (anonId && reserved) await refundFreeUse(anonId).catch(() => {});

    const res = NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to generate redesign."
        ),
      },
      { status: 500 }
    );
    setAnonCookie(res);
    return res;
  }
}
