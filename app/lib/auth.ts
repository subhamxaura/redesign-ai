import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, verifyPassword } from "@/app/lib/users";
import { getAuthSecret } from "@/app/lib/authSecret";

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        const user = await getUserByEmail(email);
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
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
        (session.user as unknown as { id: string }).id = (token.id as string) ?? token.sub ?? "";
        session.user.name = token.name as string | undefined;
        session.user.email = token.email as string | undefined;
      }
      // expose id for convenience
      (session as unknown as { userId: string }).userId = (token.id as string) ?? token.sub ?? "";
      return session;
    },
  },
};
