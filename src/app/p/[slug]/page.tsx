import Link from "next/link";
import { notFound } from "next/navigation";
import { goalLabel } from "@/domain/catalog";
import { service } from "@/lib/http";
import { ShareTools } from "@/components/share/share-tools";
import { ThemeSwitch } from "@/components/theme-switch";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await service().profileBySlug(slug);
  if (!profile) notFound();

  const facts = [
    ...profile.interests.map((value) => ({ kind: "Interest", value })),
    ...profile.skills.map((value) => ({ kind: "Skill", value })),
    ...profile.projects.map((value) => ({ kind: "Project", value })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-6 sm:px-8 min-[720px]:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
              IntroMesh
            </Link>
          </p>
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[2.5rem]">{profile.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.role}
            {profile.demo ? " · Demo" : ""} · {goalLabel(profile.goal)}
          </p>
        </div>
        <ThemeSwitch />
      </header>

      {profile.presentation ? <p className="max-w-[52ch] text-[0.9375rem] leading-normal">{profile.presentation.summary}</p> : null}

      {facts.length > 0 ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map((fact) => (
            <div key={`${fact.kind}-${fact.value}`} className="contents">
              <dt className="text-muted-foreground">{fact.kind}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ShareTools slug={profile.slug} name={profile.displayName} />

      <p className="max-w-[48ch] text-sm text-muted-foreground">Only the identity this person authorized is shown. A private connection still needs acceptance.</p>
    </main>
  );
}
