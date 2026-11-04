import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { EventHub, type HubEvent, type MyEventItem } from "@/components/hub/event-hub";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

type RawMyEvent = {
  eventId?: string;
  status?: string;
  joinedAt?: string | null;
  memberCount?: number;
  event: HubEvent;
};

export default async function EventsPage() {
  const id = await viewerId();
  if (!id) redirect("/");
  const session = await service().session(id);
  if (!session.profile) redirect("/");

  const rawMine = (await service().listMyEvents(id)) as unknown as RawMyEvent[];
  const myEvents: MyEventItem[] = (Array.isArray(rawMine) ? rawMine : []).map((item) => ({
    eventId: item.eventId ?? item.event.id,
    status: item.status ?? "joined",
    joinedAt: item.joinedAt ?? null,
    memberCount: item.memberCount ?? item.event.attendees,
    event: item.event,
  }));

  const rawDiscover = (await service().discoverEvents(id, "")) as unknown as (HubEvent & { joined?: boolean })[];
  // Pass the full list; EventHub filters out joinedIds client-side so
  // joining hides the event instantly and leaving shows it again
  // without waiting for a reload.
  const initialEvents: HubEvent[] = Array.isArray(rawDiscover) ? rawDiscover : [];

  return (
    <main className="flex min-h-full flex-col">
      <AppNav active="events" handle={session.profile.username ?? session.profile.slug} />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 min-[720px]:py-12">
        <EventHub
          myEvents={myEvents}
          initialEvents={initialEvents}
          canCreateEvent={session.canCreateEvent ?? false}
        />
      </div>
    </main>
  );
}
