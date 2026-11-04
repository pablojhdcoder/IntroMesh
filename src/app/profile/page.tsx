import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileSections, type ProfileLike } from "@/components/profile/profile-view";
import { ShowCard } from "@/components/profile/show-card";
import { EventCard } from "@/components/events/event-card";
import type { HubEvent } from "@/components/hub/event-hub";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";

type RawMyEvent = {
  eventId?: string;
  status?: string;
  memberCount?: number;
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
    memberCount: item.memberCount ?? item.event.attendees,
    event: item.event,
  }));

  return (
    <main className="flex min-h-full flex-col">
      <AppNav active="profile" handle={profile.username ?? profile.slug} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
        <ProfileHero
          profile={profile}
          stats={{ connections: acceptedCount, events: myEvents.length }}
          actions={
            <Link
              href="#edit"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-[720px]:min-h-9"
            >
              Edit profile
            </Link>
          }
        />

        <ShowCard profile={profile} />

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
            <ul className="flex flex-col gap-3">
              {myEvents.map((item) => (
                <li key={item.eventId}>
                  <EventCard
                    event={{
                      id: item.event.id,
                      name: item.event.name,
                      description: item.event.description,
                      category: item.event.category,
                      startsAt: item.event.startsAt,
                      status: item.event.status,
                      demo: item.event.demo,
                      attendees: item.memberCount,
                    }}
                    joined
                    action={
                      <Link
                        href={`/events/${item.eventId}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background min-[720px]:h-9"
                      >
                        Open
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            {acceptedCount} accepted {acceptedCount === 1 ? "connection" : "connections"} ·{" "}
            <Link href="/connections" className="underline underline-offset-4">View connections</Link>
          </p>
        </section>

        <div id="edit" className="border-t border-border pt-8">
          <ProfileEditor profile={profile} />
        </div>
      </div>
    </main>
  );
}
