import { NextResponse } from "next/server";
import { errorResponse, enforceOrRateLimit, noStoreJson } from "@/app/lib/api";
import { InvalidRequestError } from "@/app/lib/errors";
import { assertSameOrigin, getRateLimitIdentity, readJsonBody } from "@/app/lib/http";
import { createUser, DuplicateAccountError } from "@/app/lib/users";
import {
  firstValidationMessage,
  signupSchema,
} from "@/app/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rateLimitKey = getRateLimitIdentity(request);
    const ipLimited = await enforceOrRateLimit([
      { key: `signup-ip:${rateLimitKey}`, limit: 5, windowSeconds: 60 * 60 },
    ]);
    if (ipLimited) return ipLimited;

    const parsed = signupSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new InvalidRequestError(
        firstValidationMessage(parsed.error, "Please check your signup details.")
      );
    }

    const { name, email, password } = parsed.data;

    const accountLimited = await enforceOrRateLimit([
      { key: `signup-email:${email}`, limit: 3, windowSeconds: 24 * 60 * 60 },
    ]);
    if (accountLimited) return accountLimited;

    try {
      const user = await createUser({ name, email, password });
      return noStoreJson(
        {
          success: true,
          user: { id: user.id, name: user.name, email: user.email },
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof DuplicateAccountError) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409, headers: { "Cache-Control": "no-store" } }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    return errorResponse(error, "Something went wrong. Please try again.");
  }
}
