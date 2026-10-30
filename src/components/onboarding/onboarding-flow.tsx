"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/theme-switch";

type EventCard = {
  id: string;
  name: string;
  description: string;
  category: string;
  startsAt: string | null;
  code: string;
  status: "upcoming" | "live" | "ended";
  demo: boolean;
  attendees: number;
};

type Identity = {
  display_name: string;
  professional_role: string | null;
  short_bio: string | null;
  interests: string[];
  skills: string[];
  projects: string[];
  can_offer: string[];
  looking_for: string[];
  professional_focus: string[];
  conversation_topics: string[];
  languages: string[];
  profile_summary: string | null;
};

export type OnboardingDraft = {
  displayName: string;
  description: string;
  identity: Identity | null;
};

type Step = "event" | "identity" | "intent" | "review";

const field = "flex flex-col gap-2 text-sm text-muted-foreground";
const input = "h-11 rounded-lg border border-border bg-transparent px-3 text-foreground";
const textarea = "min-h-36 rounded-lg border border-border bg-transparent px-3 py-2 text-foreground";

function blankIdentity(name: string): Identity {
  return {
    display_name: name,
    professional_role: null,
    short_bio: null,
    interests: [],
    skills: [],
    projects: [],
    can_offer: [],
    looking_for: [],
    professional_focus: [],
    conversation_topics: [],
    languages: [],
    profile_summary: null,
  };
}

export function OnboardingFlow({
  metaConfigured,
  identityConfirmed,
  canCreateEvent,
  draft,
  onSaved,
}: {
  metaConfigured: boolean;
  identityConfirmed: boolean;
  canCreateEvent: boolean;
  draft: { displayName: string; description: string; identity: Identity | null } | null;
  onSaved: () => void;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-muted-foreground">Loading the event.</p>}>
      <OnboardingBody
        metaConfigured={metaConfigured}
        identityConfirmed={identityConfirmed}
        canCreateEvent={canCreateEvent}
        draft={draft}
        onSaved={onSaved}
      />
    </Suspense>
  );
}

function OnboardingBody({
  metaConfigured,
  identityConfirmed,
  canCreateEvent,
  draft,
  onSaved,
}: {
  metaConfigured: boolean;
  identityConfirmed: boolean;
  canCreateEvent: boolean;
  draft: { displayName: string; description: string; identity: Identity | null } | null;
  onSaved: () => void;
}) {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>(identityConfirmed ? "event" : draft?.identity ? "review" : "event");
  const [events, setEvents] = useState<EventCard[]>([]);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState(params.get("code") ?? params.get("event") ?? "");
  const [selected, setSelected] = useState<EventCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [eventDraft, setEventDraft] = useState({ name: "", description: "", category: "", startsAt: "" });
  const [name, setName] = useState(draft?.displayName ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [intent, setIntent] = useState("");
  const [consent, setConsent] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(draft?.identity ?? null);
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/events")
      .then(async (response) => {
        const body = await response.json();
        setEvents(body.events ?? []);
      })
      .catch(() => setError("Could not load events."));
  }, []);

  useEffect(() => {
    const invite = params.get("code") ?? params.get("event");
    if (!invite) return;
    void fetch(`/api/events?code=${encodeURIComponent(invite)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setError(body.error === "ended" ? "This event is no longer available." : "I cannot find that event.");
          return;
        }
        setSelected(body.event as EventCard);
        setStep(identityConfirmed ? "intent" : "identity");
      })
      .catch(() => setError("I cannot find that event."));
  }, [identityConfirmed, params]);

  async function loadEvents(next = query) {
    const response = await fetch(`/api/events?q=${encodeURIComponent(next)}`);
    const body = await response.json();
    setEvents(body.events ?? []);
  }

  async function chooseCode() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/events?code=${encodeURIComponent(code)}`);
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(body.error === "ended" ? "This event is no longer available." : "I cannot find that code.");
      return;
    }
    setSelected(body.event as EventCard);
    setStep(identityConfirmed ? "intent" : "identity");
  }

  async function createEvent() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...eventDraft, startsAt: eventDraft.startsAt || null }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setError("Could not create the event.");
      return;
    }
    setSelected(body.event as EventCard);
    setStep(identityConfirmed ? "intent" : "identity");
  }

  async function normalize(regenerate = false) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "normalize", displayName: name, description, regenerate }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setManual(true);
      setIdentity(blankIdentity(name));
      setEditing(true);
      setError("Meta is unavailable. You can complete the identity by hand. No profile was invented.");
      setStep("review");
      return;
    }
    setIdentity(body.identity as Identity);
    setManual(body.source !== "model" && body.source !== "cache");
    setEditing(false);
    setStep("review");
  }

  async function confirm() {
    if (!identity) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", identity: { ...identity, display_name: name || identity.display_name } }),
    });
    setPending(false);
    if (!response.ok) {
      setError("The identity was not saved.");
      return;
    }
    setStep("intent");
  }

  async function join() {
    if (!selected || pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/participation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: selected.id, intent, consent }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      if (body.error === "ended") {
        setError("This event is no longer available.");
      } else if (body.error === "identity") {
        setError("Confirm your identity before joining the event.");
        setStep("identity");
      } else if (response.status === 401) {
        setError("Your session expired. Describe yourself again.");
        setStep("identity");
      } else {
        setError("Could not join the event.");
      }
      return;
    }
    onSaved();
  }

  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-6 sm:px-8 min-[720px]:py-12"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "identity") void normalize(false);
        if (step === "review") void confirm();
        if (step === "intent") void join();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.03em] text-balance min-[720px]:text-[2.75rem]">
            {step === "event" ? "Where are you going?" : null}
            {step === "identity" ? "Let's get to know you." : null}
            {step === "intent" ? "What brings you here?" : null}
            {step === "review" ? "Your AI-powered identity" : null}
          </h1>
          <p className="max-w-[42ch] text-sm text-muted-foreground">
            {step === "event" ? "Choose an event and discover the people worth meeting." : null}
            {step === "identity" ? "One description. Your entire professional identity." : null}
            {step === "intent" ? "Tell us what would make this event meaningful for you." : null}
            {step === "review" ? (manual ? "No Meta response. Review what you write before saving." : "Review what Meta understood. Nothing is saved until you confirm.") : null}
          </p>
        </div>
        <ThemeSwitch />
      </div>

      {step === "event" ? (
        <div className="flex flex-col gap-6">
          <label className={field}>
            Buscar
            <input className={input} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" onClick={() => void loadEvents()}>
            Search events
          </Button>
          <ul className="flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-lg border border-border px-3 py-3 text-left hover:bg-surface-raised"
                  onClick={() => {
                    setSelected(event);
                    setStep(identityConfirmed ? "intent" : "identity");
                  }}
                >
                  <span className="text-foreground">{event.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {[event.category, event.startsAt?.slice(0, 10), event.status].filter(Boolean).join(" · ")}
                    {event.demo ? " · Demo" : ` · ${event.attendees} registered`}
                  </span>
                  {event.description ? <span className="text-sm text-muted-foreground">{event.description}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <label className={field}>
            Code or link
            <input className={input} value={code} onChange={(event) => setCode(event.target.value)} placeholder="event code" />
          </label>
          <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending || code.trim().length === 0} onClick={() => void chooseCode()}>
            Join with code
          </Button>
          {canCreateEvent ? (
            <button type="button" className="text-left text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setCreating((value) => !value)}>
              Create an event
            </button>
          ) : null}
          {canCreateEvent && creating ? (
            <div className="flex flex-col gap-4">
              <label className={field}>
                Name
                <input className={input} value={eventDraft.name} onChange={(event) => setEventDraft({ ...eventDraft, name: event.target.value })} required />
              </label>
              <label className={field}>
                Description
                <textarea className={textarea} value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} />
              </label>
              <label className={field}>
                Category
                <input className={input} value={eventDraft.category} onChange={(event) => setEventDraft({ ...eventDraft, category: event.target.value })} />
              </label>
              <label className={field}>
                Date
                <input className={input} type="date" value={eventDraft.startsAt} onChange={(event) => setEventDraft({ ...eventDraft, startsAt: event.target.value })} />
              </label>
              <Button type="button" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending} onClick={() => void createEvent()}>
                Create event
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "identity" ? (
        <div className="flex flex-col gap-4">
          {selected ? <p className="text-sm text-muted-foreground">{selected.name}</p> : null}
          <label className={field}>
            Name
            <input className={input} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className={field}>
            Tell us about yourself
            <textarea
              className={textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="I'm a software developer passionate about AI and startups. I'm currently building an AI-powered product, I enjoy prototyping new ideas, and I'm looking to meet ambitious founders, designers and developers..."
              required
              minLength={20}
            />
          </label>
          <p className="max-w-[52ch] text-sm text-muted-foreground">
            Tell us what you do, what you&apos;re building, what interests you, what you can bring to a community and the people you&apos;d like to meet.
          </p>
          <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending}>
            {pending ? "Reading" : "Continue"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {metaConfigured ? "Meta Muse Spark will structure this description once." : "MODEL_API_KEY is missing. A Meta response will not be simulated."}
          </p>
        </div>
      ) : null}

      {step === "review" && identity ? (
        <div className="flex flex-col gap-6">
          <IdentityPreview identity={identity} editing={editing} onChange={setIdentity} />
          <div className="flex flex-col gap-2 min-[720px]:flex-row">
            <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending}>
              Looks good — Save my identity
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" onClick={() => setEditing(true)}>
              Edit my profile
            </Button>
          </div>
          <button type="button" className="text-left text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => void normalize(true)}>
            Regenerate from the description
          </button>
        </div>
      ) : null}

      {step === "intent" ? (
        <div className="flex flex-col gap-4">
          {selected ? <p className="text-sm text-muted-foreground">{selected.name}</p> : null}
          <label className={field}>
            This event
            <textarea
              className={textarea}
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="I'm looking to meet potential co-founders, discover interesting AI projects, find people to collaborate with and explore new opportunities."
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            I want to be discoverable at this event. If unchecked, you join invisible.
          </label>
          <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending || !selected}>
            {pending ? "Joining" : "Join the event"}
          </Button>
          <p className="text-sm text-muted-foreground">You can leave this empty. Your global identity will be used and Meta is not called for this text.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function IdentityPreview({
  identity,
  editing,
  onChange,
}: {
  identity: Identity;
  editing: boolean;
  onChange: (identity: Identity) => void;
}) {
  const rows: { label: string; key: keyof Identity }[] = [
    { label: "Professional summary", key: "profile_summary" },
    { label: "Role", key: "professional_role" },
    { label: "Interests", key: "interests" },
    { label: "Skills", key: "skills" },
    { label: "Projects", key: "projects" },
    { label: "What you can offer", key: "can_offer" },
    { label: "What you're looking for", key: "looking_for" },
    { label: "Conversation topics", key: "conversation_topics" },
  ];
  return (
    <dl className="flex flex-col gap-4">
      {rows.map((row) => {
        const value = identity[row.key];
        const text = Array.isArray(value) ? value.join(", ") : (value ?? "");
        if (!editing && text.trim().length === 0) return null;
        return (
          <div key={row.key} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            {editing ? (
              <input
                className={input}
                value={text}
                onChange={(event) => {
                  const next = event.target.value;
                  onChange({
                    ...identity,
                    [row.key]: Array.isArray(value) ? next.split(",").map((item) => item.trim()).filter(Boolean) : next || null,
                  });
                }}
              />
            ) : (
              <dd className="text-foreground">{text}</dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
