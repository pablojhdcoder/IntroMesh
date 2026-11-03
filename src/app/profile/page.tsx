import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSections, type ProfileLike } from "@/components/profile/profile-view";
import { ShareTools } from "@/components/share/share-tools";
import type { HubEvent } from "@/components/hub/event-hub";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";

type RawMyEvent = {
  eventId?: string;
  status?: string;
  presence?: "active" | null;
  event: HubEvent;
};

export default async function ProfilePage() {
  const id = await viewerId();
  if (!id) redirect("/");
  const session = await service().session(id);
  if (!session.profile) redirect("/");

  const profile = session.profile as typeof session.profile &
    ProfileLike & { goal: string; avatarUrl?: string | null; profileVisibility?: "public" | "private" };

  const connections = id ? await service().connections(id) : [];
  const acceptedCount = connections.filter((item) => item.status === "accepted").length;

  const rawMine = (await service().listMyEvents(id)) as unknown as RawMyEvent[];
  const myEvents = (Array.isArray(rawMine) ? rawMine : []).map((item) => ({
    eventId: item.eventId ?? item.event.id,
    status: item.status ?? "joined",
    presence: item.presence ?? null,
    event: item.event,
  }));

  return (
    <main className="flex min-h-full flex-col">
      <AppNav active="profile" slug={profile.slug} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
        <ProfileSections profile={profile} />

        <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Your events">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={meta}>Your events</h2>
            <p className={`${meta} tabular-nums`}>{myEvents.length}</p>
          </div>
          {myEvents.length === 0 ? (
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
              No events yet. <Link href="/events" className="underline underline-offset-4">Find an event</Link>.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {myEvents.map((item) => (
                <li key={item.eventId} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-1 last:pb-0">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-heading text-xl leading-tight tracking-[-0.01em]">{item.event.name}</p>
                    <p className={meta}>
                      {item.event.category || item.event.status}
                      {item.presence ? ` · ${item.presence}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/events/${item.eventId}`}
                    className="inline-flex min-h-11 items-center font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase underline underline-offset-4 transition-colors hover:text-foreground min-[720px]:min-h-9"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            {acceptedCount} accepted {acceptedCount === 1 ? "connection" : "connections"} ·{" "}
            <Link href="/connections" className="underline underline-offset-4">View connections</Link>
          </p>
        </section>

        <div className="border-t border-border pt-8">
          <ShareTools slug={profile.slug} name={profile.displayName} />
        </div>

        <div className="border-t border-border pt-8">
          <ProfileEditor profile={profile} />
        </div>
      </div>
    </main>
  );
}
