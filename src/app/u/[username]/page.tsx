import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileSections, type ProfileLike } from "@/components/profile/profile-view";
import { ScanConnect } from "@/components/share/scan-connect";
import { ShareTools } from "@/components/share/share-tools";
import { ThemeSwitch } from "@/components/theme-switch";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const id = await viewerId();
  const raw = await service().publicProfile(username, id);
  if (!raw) notFound();

  const profile = raw as typeof raw & ProfileLike & { isOwner?: boolean };
  const isOwner = profile.isOwner ?? (id !== null && profile.id === id);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-6 sm:px-8 min-[720px]:py-12">
      <header className="flex items-start justify-between gap-4">
        <p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground min-[720px]:min-h-9"
          >
            IntroMesh
          </Link>
        </p>
        <ThemeSwitch />
      </header>

      {isOwner ? (
        <p role="status" className="rounded-md bg-surface px-3 py-2 text-sm text-muted-foreground">
          This is your public card — this is what others see when they scan you.{" "}
          <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
            Edit it in My Profile
          </Link>
          .
        </p>
      ) : null}

      <ProfileHero profile={profile} />

      <ProfileSections profile={profile} />

      {!isOwner ? (
        <div className="w-full border-t border-border pt-8">
          <ScanConnect slug={profile.slug} profileId={profile.id} />
        </div>
      ) : null}

      {isOwner && profile.profileVisibility === "private" ? (
        <p role="status" className="w-full rounded-md bg-surface px-3 py-2 text-sm text-muted-foreground">
          Your profile is private, so your card and QR code are hidden. Make it public in{" "}
          <Link href="/profile#edit" className="font-medium text-foreground underline underline-offset-4">
            My Profile
          </Link>{" "}
          to share it again.
        </p>
      ) : null}

      {isOwner && profile.profileVisibility !== "private" ? (
        <div className="w-full border-t border-border pt-8">
          <ShareTools slug={profile.slug} name={profile.displayName} />
        </div>
      ) : null}
    </main>
  );
}
