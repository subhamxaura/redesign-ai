import type { Metadata } from "next";
import { Suspense } from "react";
import SignUpClient from "./SignUpClient";

export const metadata: Metadata = {
  title: "Sign Up — ReDesignAI",
  description: "Create your ReDesignAI account and start redesigning in seconds.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070a]" />}>
      <SignUpClient />
    </Suspense>
  );
}
