import Link from "next/link";
import { AppNav } from "@/components/nav/app-nav";
import { ConnectionActions } from "@/components/connections/connection-actions";
import { PersonCard } from "@/components/events/person-card";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const metaLabel = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";

function truncate(value: string, max = 140): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type ConnectionItem = Awaited<ReturnType<ReturnType<typeof service>["connections"]>>[number] & {
  eventName?: string | null;
  acceptedAt?: string | null;
  direction?: "incoming" | "outgoing";
  canResolve?: boolean;
};

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className={metaLabel}>{label}</h2>
      <p className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase tabular-nums">{count}</p>
    </div>
  );
}

export default async function ConnectionsPage() {
  const id = await viewerId();
  const session = id ? await service().session(id) : null;
  const connections = (id ? await service().connections(id) : []) as ConnectionItem[];
  const accepted = connections.filter((item) => item.status === "accepted");
  const incoming = connections.filter((item) => item.status === "pending" && item.direction === "incoming");
  const outgoing = connections.filter((item) => item.status === "pending" && item.direction !== "incoming");

  return (
    <main className="flex min-h-full flex-col">
      <AppNav
        active="connections"
        handle={session?.profile?.username ?? session?.profile?.slug ?? null}
        pendingCount={incoming.length}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
            People you met
          </h1>
          <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Private to you. Public card fields only.
          </p>
          {incoming.length > 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              {incoming.length} {incoming.length === 1 ? "request" : "requests"} waiting for you.
            </p>
          ) : null}
        </div>

        {incoming.length > 0 ? (
          <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Requests for you">
            <SectionHeading label="Requests for you" count={incoming.length} />
            <ul className="flex flex-col gap-5">
              {incoming.map((item) => (
                <li key={item.id} className="flex flex-col gap-2">
                  <PersonCard
                    name={item.other.displayName}
                    role={item.other.role}
                    slug={item.other.slug}
                    demo={item.other.demo}
                    tags={[...(item.other.interests ?? []), ...(item.other.skills ?? [])].slice(0, 2)}
                  />
                  {item.eventName ? (
                    <p className="text-sm text-muted-foreground">
                      {item.other.displayName} wants to meet you at {item.eventName}
                    </p>
                  ) : null}
                  {typeof item.intro === "string" && item.intro.trim().length > 0 ? (
                    <figure className="flex flex-col gap-1">
                      <blockquote className="max-w-[62ch] font-heading text-lg leading-snug text-balance">
                        “{truncate(item.intro)}”
                      </blockquote>
                      <figcaption className={metaLabel}>
                        {item.introSource === "model" ? "Intro written with Meta AI" : `Intro from ${item.other.displayName}`}
                      </figcaption>
                    </figure>
                  ) : null}
                  <ConnectionActions connectionId={item.id} otherName={item.other.displayName} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {accepted.length === 0 ? (
          <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="No accepted connections">
            <h2 className={metaLabel}>Accepted connections</h2>
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
              Requests you accept will show up here.
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Accepted connections">
            <SectionHeading label="Accepted connections" count={accepted.length} />
            <ul className="flex flex-col gap-5">
              {accepted.map((item) => {
                const acceptedDate = formatDate(item.acceptedAt);
                return (
                  <li key={item.id} className="flex flex-col gap-2">
                    <PersonCard
                      name={item.other.displayName}
                      role={item.other.role}
                      slug={item.other.slug}
                      demo={item.other.demo}
                      tags={[...(item.other.interests ?? []), ...(item.other.skills ?? [])].slice(0, 2)}
                    />
                    {item.eventName ? (
                      <p className="font-heading text-xl leading-tight tracking-[-0.01em]">
                        Meet {item.other.displayName} at {item.eventName}
                      </p>
                    ) : null}
                    {acceptedDate ? <p className="text-sm text-muted-foreground">Connected {acceptedDate}</p> : null}
                    {typeof item.intro === "string" && item.intro.trim().length > 0 ? (
                      <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                        {truncate(item.intro)}
                      </p>
                    ) : null}
                    <p>
                      <Link
                        href={`/u/${item.other.slug}`}
                        className="inline-flex min-h-11 items-center font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase underline underline-offset-4 transition-colors hover:text-foreground min-[720px]:min-h-9"
                      >
                        View public card
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {outgoing.length > 0 ? (
          <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Waiting on them">
            <SectionHeading label="Waiting on them" count={outgoing.length} />
            <ul className="flex flex-col gap-5">
              {outgoing.map((item) => (
                <li key={item.id} className="flex flex-col gap-2">
                  <PersonCard
                    name={item.other.displayName}
                    role={item.other.role}
                    slug={item.other.slug}
                    demo={item.other.demo}
                  />
                  <p className="text-sm text-muted-foreground">
                    Waiting for {item.other.displayName} to accept
                    {item.eventName ? ` · ${item.eventName}` : ""}
                  </p>
                  {typeof item.intro === "string" && item.intro.trim().length > 0 ? (
                    <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                      {truncate(item.intro)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
