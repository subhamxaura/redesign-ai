import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { getUserByEmail } from "@/app/lib/users";
import { getRecentRedesignsForUser } from "@/app/lib/redesigns";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — ReDesignAI",
  description: "Your ReDesignAI workspace.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin?callbackUrl=/dashboard");

  const email = session.user.email;
  const user = await getUserByEmail(email);
  const redesigns = await getRecentRedesignsForUser(user?.id ?? (session.user as unknown as { id: string }).id ?? "");

  return (
    <DashboardClient
      user={{
        name: session.user.name ?? user?.name ?? "Designer",
        email,
        createdAt: user?.createdAt ?? null,
      }}
      redesigns={redesigns}
    />
  );
}
