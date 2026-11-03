import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitch } from "@/components/theme-switch";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

function truncate(value: string, max = 140): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export default async function ConnectionsPage() {
  const id = await viewerId();
  const connections = id ? await service().connections(id) : [];
  const accepted = connections.filter((item) => item.status === "accepted");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground min-[720px]:min-h-9"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              IntroMesh
            </Link>
          </p>
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
            People you met
          </h1>
          <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Private to you. Public card fields only.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      {accepted.length === 0 ? (
        <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="No accepted connections">
          <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Accepted connections
          </h2>
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            No accepted connections yet. Accept one in the Signal Field.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Accepted connections">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Accepted connections
            </h2>
            <p className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
              {accepted.length}
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {accepted.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-5 first:pt-1 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-heading text-xl leading-tight tracking-[-0.01em]">{item.other.displayName}</p>
                  {item.other.demo ? (
                    <span className="font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {item.other.role}
                </p>
                {typeof item.intro === "string" && item.intro.trim().length > 0 ? (
                  <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                    {truncate(item.intro)}
                  </p>
                ) : null}
                <p>
                  <Link
                    href={`/p/${item.other.slug}`}
                    className="inline-flex min-h-11 items-center font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase underline underline-offset-4 transition-colors hover:text-foreground min-[720px]:min-h-9"
                  >
                    View public card
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
