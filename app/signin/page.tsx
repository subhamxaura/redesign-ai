import type { Metadata } from "next";
import { Suspense } from "react";
import SignInClient from "./SignInClient";

export const metadata: Metadata = {
  title: "Sign In — ReDesignAI",
  description: "Sign in to your ReDesignAI workspace.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070a]" />}>
      <SignInClient />
    </Suspense>
  );
}
