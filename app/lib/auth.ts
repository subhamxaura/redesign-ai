import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, verifyPassword } from "@/app/lib/users";
import { getAuthSecret } from "@/app/lib/authSecret";
import { safeCallbackPath } from "@/app/lib/redirects";
import { MAX_PASSWORD_BYTES } from "@/app/lib/validation";
import { rateLimit } from "@/app/lib/rateLimit";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// Used only to keep response timing similar when an account does not exist.
const DUMMY_PASSWORD_HASH =
  "$2b$12$r0n8.YdIqjqFn8A3jhncBuWOMagfKdDUa7i6DafyI9FPY3.7N81bm";

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  useSecureCookies: process.env.NODE_ENV === "production",
  debug: false,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/signin",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const emailLooksValid =
          rawEmail.length >= 3 &&
          rawEmail.length <= 254 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
        const passwordLooksValid =
          password.length > 0 && Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;

        const attempt = await rateLimit({
          key: `login-account:${rawEmail || "missing"}`,
          limit: 5,
          windowSeconds: 15 * 60,
        });

        if (!attempt.allowed) {
          await verifyPassword(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const user = emailLooksValid ? await getUserByEmail(rawEmail) : null;

        // Always run one bcrypt comparison to reduce user-enumeration timing
        // differences for missing accounts and malformed input.
        const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const valid = await verifyPassword(password, passwordHash);

        if (!user || !valid || !passwordLooksValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const base = new URL(baseUrl);
      let candidate: URL;

      try {
        candidate = new URL(url, baseUrl);
      } catch {
        return new URL(safeCallbackPath(null), base).toString();
      }

      if (candidate.origin !== base.origin) {
        return new URL(safeCallbackPath(null), base).toString();
      }

      return new URL(
        safeCallbackPath(`${candidate.pathname}${candidate.search}`),
        base
      ).toString();
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as unknown as { id: string }).id ?? token.sub;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id: string }).id =
          (token.id as string) ?? token.sub ?? "";
        session.user.name = token.name as string | undefined;
        session.user.email = token.email as string | undefined;
      }
      (session as unknown as { userId: string }).userId =
        (token.id as string) ?? token.sub ?? "";
      return session;
    },
  },
};
