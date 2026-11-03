"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
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

const field =
  "flex flex-col gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const input =
  "h-11 rounded-[12px] border border-border bg-surface px-3.5 font-sans text-[1rem] normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const textarea =
  "min-h-36 rounded-[12px] border border-border bg-surface px-3.5 py-3 font-sans text-[1rem] leading-relaxed normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const badge = "font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase";
const stepMeta: Record<Step, { number: string; label: string; progress: string }> = {
  event: { number: "01", label: "Event", progress: "25%" },
  identity: { number: "02", label: "Identity", progress: "50%" },
  review: { number: "03", label: "Review", progress: "75%" },
  intent: { number: "04", label: "Intent", progress: "100%" },
};

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
      body: JSON.stringify({ eventId: selected.id, intent }),
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

  const rawPreview =
    description.trim().length > 240 ? `${description.trim().slice(0, 240).trimEnd()}…` : description.trim();
  const extractedChips: string[] = identity
    ? [...identity.interests.slice(0, 4), ...identity.skills.slice(0, 4), ...identity.looking_for.slice(0, 3)]
    : [];

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
        <div className="min-w-0 flex-1">
          <p className="mb-4 flex items-center gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--signal-strong)] dark:bg-signal" />
            IntroMesh — {stepMeta[step].label}
          </p>
          <Crossfade id={step} className="flex flex-col gap-3">
            <h1 className="font-heading text-[2rem] leading-none tracking-[-0.03em] text-balance min-[720px]:text-[3.25rem]">
              {step === "event" ? "Where are you going?" : null}
              {step === "identity" ? "Let's get to know you." : null}
              {step === "intent" ? "What brings you here?" : null}
              {step === "review" ? "Your identity" : null}
            </h1>
            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              {step === "event" ? "Choose an event." : null}
              {step === "identity" ? "One description." : null}
              {step === "intent" ? "What would make this event useful." : null}
              {step === "review" ? (manual ? "No Meta response. Review before saving." : "Review, then save.") : null}
            </p>
          </Crossfade>
        </div>
        <ThemeSwitch />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {stepMeta[step].number} — {stepMeta[step].label}
        </p>
        <div
          className="h-px bg-border"
          role="progressbar"
          aria-label={`Step ${stepMeta[step].number}: ${stepMeta[step].label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number.parseInt(stepMeta[step].progress, 10)}
        >
          <div
            className="h-px bg-[var(--signal-strong)] transition-[width] duration-300 dark:bg-signal"
            style={{ width: stepMeta[step].progress }}
          />
        </div>
      </div>

      <Crossfade id={step} className="flex flex-col gap-6">
      {step === "event" ? (
        <div className="flex flex-col gap-6">
          <label className={field}>
            Search
            <input className={input} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" onClick={() => void loadEvents()}>
            Search events
          </Button>
          <ul className="flex flex-col gap-3">
            {events.map((event) => {
              const isSelected = selected?.id === event.id;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={`flex w-full flex-col gap-2 rounded-[20px] border border-border bg-surface px-4 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-foreground/30 hover:shadow-[var(--shadow-raise)] ${
                      isSelected ? "border-foreground/40 bg-surface-raised ring-1 ring-foreground/20" : ""
                    }`}
                    onClick={() => {
                      setSelected(event);
                      setStep(identityConfirmed ? "intent" : "identity");
                    }}
                  >
                    <span className="flex w-full items-start justify-between gap-3">
                      <span className="font-heading text-xl leading-tight text-foreground">{event.name}</span>
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
                        {event.status === "live" ? (
                          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] text-foreground uppercase">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--signal-strong)] dark:bg-signal" />
                            Live
                          </span>
                        ) : (
                          <span className="font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                            {event.status}
                          </span>
                        )}
                        {event.demo ? (
                          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                            Demo
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                      {[event.category, event.startsAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                      {event.demo ? "" : ` · ${event.attendees} registered`}
                    </span>
                    {event.description ? (
                      <span className="text-sm leading-relaxed text-muted-foreground">{event.description}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <label className={field}>
              Code or link
              <input className={input} value={code} onChange={(event) => setCode(event.target.value)} placeholder="event code" />
            </label>
            <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending || code.trim().length === 0} onClick={() => void chooseCode()}>
              Join with code
            </Button>
          </div>
          {canCreateEvent ? (
            <div className="flex flex-col gap-4 border-t border-border pt-6">
              <button
                type="button"
                aria-expanded={creating}
                className="flex min-h-11 items-center gap-2 self-start text-sm text-foreground underline-offset-4 transition-colors hover:text-muted-foreground min-[720px]:min-h-9"
                onClick={() => setCreating((value) => !value)}
              >
                <Plus aria-hidden="true" className="size-4" />
                Create an event
              </button>
              {creating ? (
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
        </div>
      ) : null}

      {step === "identity" ? (
        <div className="flex flex-col gap-4">
          {selected ? (
            <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{selected.name}</p>
          ) : null}
          <label className={field}>
            Name
            <input className={input} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className={field}>
            About you
            <textarea
              className={textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Role, what you’re building, who you want to meet."
              required
              minLength={20}
            />
          </label>
          <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending}>
            {pending ? "Reading" : "Continue"}
          </Button>
          <p className={badge}>{metaConfigured ? "Meta · once" : "No key · nothing simulated"}</p>
        </div>
      ) : null}

      {step === "review" && identity ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 rounded-[20px] border border-border bg-surface p-4 min-[720px]:grid-cols-2 min-[720px]:p-5">
            <div className="flex flex-col gap-3">
              <p className={badge}>You wrote</p>
              <p className="text-[0.9375rem] leading-relaxed text-foreground">
                {rawPreview.length > 0 ? `\u201C${rawPreview}\u201D` : "\u201CNo description provided.\u201D"}
              </p>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 min-[720px]:border-t-0 min-[720px]:border-l min-[720px]:pt-0 min-[720px]:pl-6">
              <p className={badge}>Muse Spark extracted</p>
              {extractedChips.length > 0 ? (
                <ul aria-label="Extracted interests, skills and goals" className="flex flex-wrap gap-2">
                  {extractedChips.map((chip, index) => (
                    <li
                      key={`${chip}-${index}`}
                      className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[0.8125rem] leading-relaxed text-foreground"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  No tags found — add them below.
                </p>
              )}
            </div>
          </div>
          <p className={badge}>
            {manual ? "Manual · No Meta response. Nothing was invented." : "Muse Spark · editable before saving"}
          </p>
          <IdentityPreview identity={identity} editing={editing} onChange={setIdentity} />
          <div className="flex flex-col gap-2 min-[720px]:flex-row">
            <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending}>
              Save identity
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
          {selected ? (
            <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{selected.name}</p>
          ) : null}
          <label className={field}>
            This event
            <textarea
              className={textarea}
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="I'm looking to meet potential co-founders, discover interesting AI projects, find people to collaborate with and explore new opportunities."
            />
          </label>
          <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending || !selected}>
            {pending ? "Joining" : "Join the event"}
          </Button>
          <p className={badge}>Joining makes you visible to others at this event.</p>
        </div>
      ) : null}
      </Crossfade>

      {error ? (
        <p role="alert" className="rounded-[8px] bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
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
    <dl className="flex flex-col divide-y divide-border">
      {rows.map((row) => {
        const value = identity[row.key];
        const text = Array.isArray(value) ? value.join(", ") : (value ?? "");
        if (!editing && text.trim().length === 0) return null;
        return (
          <div key={row.key} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
            <dt className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{row.label}</dt>
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
              <dd className="text-[0.9375rem] leading-relaxed text-foreground">{text}</dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
