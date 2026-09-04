import { NextResponse } from "next/server";
import { createUser, validateSignupInput, checkRateLimit } from "@/app/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";

    const rate = checkRateLimit(`signup:${ip}`, 5, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const input = body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      confirmPassword?: unknown;
    };

    const validation = validateSignupInput(input);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const name = (input.name as string).trim();
    const email = (input.email as string).trim().toLowerCase();
    const password = input.password as string;

    try {
      const user = await createUser({ name, email, password });
      return NextResponse.json(
        {
          success: true,
          user: { id: user.id, name: user.name, email: user.email },
        },
        { status: 201 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      if (msg.toLowerCase().includes("already exists")) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
