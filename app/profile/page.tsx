import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { getUserByEmail } from "@/app/lib/users";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile — ReDesignAI",
  description: "Manage your ReDesignAI account.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin?callbackUrl=/profile");

  const email = session.user.email;
  const user = await getUserByEmail(email);

  return (
    <ProfileClient
      user={{
        name: session.user.name ?? user?.name ?? "Designer",
        email,
        createdAt: user?.createdAt ?? null,
        id: user?.id ?? (session.user as unknown as { id: string }).id ?? "",
      }}
    />
  );
}
