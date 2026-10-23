import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { errorResponse, enforceOrRateLimit, noStoreJson } from "@/app/lib/api";
import { authOptions } from "@/app/lib/auth";
import {
  applyAnonCookie,
  FREE_LIMIT,
  getAnonIdFromCookieHeader,
  isValidAnonId,
  limitReachedResponse,
  networkKeyForIp,
  newAnonId,
  refundFreeUse,
  reserveFreeUse,
} from "@/app/lib/freeUsage";
import {
  generateGeminiContent,
  GEMINI_STRUCTURED_MODEL,
  getGeminiClient,
  readGeminiResponseText,
} from "@/app/lib/gemini";
import { assertSameOrigin, getClientIp, getRateLimitIdentity, readFormDataWithLimit } from "@/app/lib/http";
import {
  fileToInlineData,
  validateImageUpload,
} from "@/app/lib/imageValidation";
import {
  parseRedesignSpecJson,
  redesignResponseSchema,
} from "@/app/lib/redesign";

export const runtime = "nodejs";

const MAX_REDESIGN_RESPONSE_CHARS = 50_000;

export async function POST(request: Request) {
  let anonId: string | null = null;
  let networkHash: string | null = null;
  let reserved = false;

  const setAnonCookie = (res: NextResponse) => {
    if (anonId) applyAnonCookie(res, anonId);
    return res;
  };

  try {
    assertSameOrigin(request);
    const rateLimitKey = getRateLimitIdentity(request);
    const limited = await enforceOrRateLimit([
      { key: `redesign:${rateLimitKey}`, limit: 15, windowSeconds: 60 * 60 },
    ]);
    if (limited) return limited;

    const session = await getServerSession(authOptions);
    const isAuthed = Boolean(session?.user?.email);

    if (!isAuthed) {
      const fromCookie = getAnonIdFromCookieHeader(request.headers.get("cookie"));
      anonId = isValidAnonId(fromCookie) ? fromCookie : newAnonId();
      networkHash = networkKeyForIp(getClientIp(request));
    }

    const formData = await readFormDataWithLimit(request);
    const image = await validateImageUpload(formData.get("image"));

    if (!image.ok) {
      return setAnonCookie(
        NextResponse.json({ error: image.error }, { status: image.status })
      );
    }

    let usageAfter: number | null = null;
    if (!isAuthed && anonId) {
      const reservation = await reserveFreeUse(anonId, networkHash);
      if (!reservation.allowed) {
        return setAnonCookie(
          NextResponse.json(limitReachedResponse(reservation.usage), {
            status: 403,
          })
        );
      }
      reserved = true;
      usageAfter = reservation.usage;
    }

    const ai = getGeminiClient();
    const response = await generateGeminiContent(ai, {
      model: GEMINI_STRUCTURED_MODEL,
      contents: [
        fileToInlineData(image.buffer, image.mimeType),
        {
          text: `
You are an expert UI/UX designer and frontend developer.

Analyze the uploaded website or app screenshot and create a modern redesign specification.

Rules:
- Preserve the original website's main purpose.
- Use realistic content based only on what is visible.
- Do not invent unrelated sections, products, features, or claims.
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
    });
    const rawText = readGeminiResponseText(response, MAX_REDESIGN_RESPONSE_CHARS);
    const redesign = parseRedesignSpecJson(rawText);

    return setAnonCookie(
      noStoreJson({
        success: true,
        redesign,
        ...(usageAfter != null
          ? {
              usage: usageAfter,
              remaining: Math.max(0, FREE_LIMIT - usageAfter),
              limit: FREE_LIMIT,
            }
          : { authenticated: true }),
      })
    );
  } catch (error: unknown) {
    if (anonId && reserved) {
      await refundFreeUse(anonId, networkHash).catch(() => {});
    }

    return setAnonCookie(errorResponse(error, "Failed to generate redesign."));
  }
}
