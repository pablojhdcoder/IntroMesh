import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { EventHub, type HubEvent, type MyEventItem } from "@/components/hub/event-hub";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

type RawMyEvent = {
  eventId?: string;
  status?: string;
  joinedAt?: string | null;
  presence?: "active" | null;
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
    // UI no longer distinguishes seeking: any live backend presence maps to active.
    presence: item.presence ? "active" : null,
    event: item.event,
  }));

  const rawDiscover = (await service().listEvents("")) as unknown as HubEvent[];
  const initialEvents: HubEvent[] = Array.isArray(rawDiscover) ? rawDiscover : [];

  return (
    <main className="flex min-h-full flex-col">
      <AppNav active="events" slug={session.profile.slug} />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 min-[720px]:py-12">
        <EventHub
          myEvents={myEvents}
          initialEvents={initialEvents}
          canCreateEvent={session.canCreateEvent ?? false}
          identityName={session.profile.displayName}
        />
      </div>
    </main>
  );
}
