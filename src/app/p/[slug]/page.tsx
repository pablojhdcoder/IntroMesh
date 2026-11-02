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
  const initials =
    profile.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const chipClass =
    "inline-flex items-center rounded-full border border-border px-3 py-1 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";

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

      <section className="flex flex-col items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full bg-signal font-heading text-3xl text-[#14160c]"
        >
          {initials}
        </div>
        <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
          {profile.displayName}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {profile.role ? <span className={chipClass}>{profile.role}</span> : null}
          <span className={chipClass}>{goalLabel(profile.goal)}</span>
          {profile.demo ? <span className={chipClass}>Demo</span> : null}
        </div>
      </section>

      {profile.presentation ? (
        <p className="mx-auto max-w-[52ch] text-center font-heading text-xl leading-snug text-balance min-[720px]:text-2xl">
          {profile.presentation.summary}
        </p>
      ) : null}

      {facts.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {facts.map((fact) => (
            <li
              key={`${fact.kind}-${fact.value}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
            >
              <span className="font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{fact.kind}</span>
              <span>{fact.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="w-full border-t border-border pt-8">
        <ShareTools slug={profile.slug} name={profile.displayName} />
      </div>

      <p className="mx-auto max-w-[48ch] text-center text-sm leading-relaxed text-muted-foreground">
        Authorized identity only. Connection still needs acceptance.
      </p>
    </main>
  );
}
