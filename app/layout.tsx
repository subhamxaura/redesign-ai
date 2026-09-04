import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "ReDesignAI — AI Website Redesign Studio",
  description:
    "Upload a website screenshot. Get an expert UI/UX critique and a live interactive redesign prototype powered by AI.",
  keywords: ["AI", "redesign", "UI/UX", "website audit", "Gemini", "Next.js"],
  openGraph: {
    title: "ReDesignAI",
    description: "Turn any screenshot into a premium redesign direction.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-full flex-col bg-[#05070a] font-sans antialiased selection:bg-cyan-400/30 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
