import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { ProfileManager } from "@/components/profile/profile-manager";
import type { ProfileLike } from "@/components/profile/profile-view";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const id = await viewerId();
  if (!id) redirect("/");
  const session = await service().session(id);
  if (!session.profile) redirect("/");

  const raw = session.profile as typeof session.profile &
    ProfileLike & { goal: string; avatarUrl?: string | null; profileVisibility?: "public" | "private" };
  // Explicit DTO for the client component: only the fields the UI renders.
  const profile: ProfileLike & { goal: string } = {
    id: raw.id,
    displayName: raw.displayName,
    slug: raw.slug,
    username: raw.username ?? null,
    role: raw.role,
    interests: raw.interests,
    skills: raw.skills,
    projects: raw.projects,
    links: raw.links ?? [],
    offers: raw.offers,
    seeking: raw.seeking,
    goal: raw.goal,
    demo: raw.demo,
    presentation: raw.presentation ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    profileVisibility: raw.profileVisibility,
  };

  const connections = id ? await service().connections(id) : [];
  const acceptedCount = connections.filter((item) => item.status === "accepted").length;

  return (
    <main className="flex min-h-full flex-col">
      <AppNav active="profile" handle={profile.username ?? profile.slug} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
        <ProfileManager profile={profile} connectionsCount={acceptedCount} />
      </div>
    </main>
  );
}
