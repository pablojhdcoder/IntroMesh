"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { ThemeSwitch } from "@/components/theme-switch";
import { EventPicker, type EventCardEvent } from "@/components/events/event-picker";

type EventCard = EventCardEvent & { code: string };

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

type Step = "identity" | "review" | "event" | "intent";

const field =
  "flex flex-col gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const input =
  "h-11 rounded-[12px] border border-border bg-surface px-3.5 font-sans text-[1rem] normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const textarea =
  "min-h-36 rounded-[12px] border border-border bg-surface px-3.5 py-3 font-sans text-[1rem] leading-relaxed normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const badge = "font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase";
const stepMeta: Record<Step, { number: string; label: string; progress: string }> = {
  identity: { number: "02", label: "About you", progress: "40%" },
  review: { number: "03", label: "Review", progress: "60%" },
  event: { number: "04", label: "Event", progress: "80%" },
  intent: { number: "05", label: "Intent", progress: "100%" },
};

const STARTER_CHIPS = [
  "I work on…",
  "I'm building…",
  "I'm good at…",
  "I can help with…",
  "I want to meet…",
  "Talk to me about…",
];

const ABOUT_GUIDE = [
  "What do you do?",
  "What are you building right now?",
  "Your strongest skills and tools",
  "What you can help others with",
  "Who you want to meet",
  "Topics you love talking about · languages",
];

const ABOUT_PLACEHOLDER =
  "I work on a realtime collaboration tool for hackathon teams. I'm building offline-first sync and a matchmaking view. I'm good at TypeScript, prototyping, and running user tests. I can help with frontend architecture and demo prep. I want to meet backend engineers and designers who love events. Talk to me about travel, bouldering, and Spanish cinema — I speak English and Spanish.";

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
  accountUsername,
  onSaved,
}: {
  metaConfigured: boolean;
  identityConfirmed: boolean;
  canCreateEvent: boolean;
  draft: { displayName: string; description: string; identity: Identity | null } | null;
  accountUsername: string | null;
  onSaved: () => void;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-muted-foreground">Loading the event.</p>}>
      <OnboardingBody
        metaConfigured={metaConfigured}
        identityConfirmed={identityConfirmed}
        canCreateEvent={canCreateEvent}
        draft={draft}
        accountUsername={accountUsername}
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
  accountUsername,
  onSaved,
}: {
  metaConfigured: boolean;
  identityConfirmed: boolean;
  canCreateEvent: boolean;
  draft: { displayName: string; description: string; identity: Identity | null } | null;
  accountUsername: string | null;
  onSaved: () => void;
}) {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>(identityConfirmed ? "event" : draft?.identity ? "review" : "identity");
  const [events, setEvents] = useState<EventCard[]>([]);
  const [selected, setSelected] = useState<EventCard | null>(null);
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
        // Preselect only: identity always comes first, so a newcomer stays
        // in the identity step and lands on intent after confirming.
        setSelected(body.event as EventCard);
        if (identityConfirmed) setStep("intent");
      })
      .catch(() => setError("I cannot find that event."));
  }, [identityConfirmed, params]);

  function pickEvent(event: EventCardEvent) {
    setSelected(event as EventCard);
    setError(null);
    setStep("intent");
  }

  const displayName = accountUsername ?? draft?.displayName ?? "";

  async function normalize(regenerate = false) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "normalize", displayName, description, regenerate }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setManual(true);
      setIdentity(blankIdentity(displayName || "member"));
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
      body: JSON.stringify({ action: "confirm", identity: { ...identity, display_name: displayName || identity.display_name } }),
    });
    setPending(false);
    if (!response.ok) {
      setError("The identity was not saved.");
      return;
    }
    setStep(selected ? "intent" : "event");
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
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
            IntroMesh — {stepMeta[step].label}
          </p>
          <Crossfade id={step} className="flex flex-col gap-3">
            <h1 className="font-heading text-[2rem] leading-none tracking-[-0.03em] text-balance min-[720px]:text-[3.25rem]">
              {step === "identity" ? "Tell us about you." : null}
              {step === "review" ? "Your identity" : null}
              {step === "event" ? "Where are you going?" : null}
              {step === "intent" ? "What brings you here?" : null}
            </h1>
            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              {step === "identity" ? (accountUsername ? `Posting as @${accountUsername} · one identity for every event.` : "One identity for every event.") : null}
              {step === "review" ? (manual ? "No Meta response. Review before saving." : "Review, then save.") : null}
              {step === "event" ? "Choose an event." : null}
              {step === "intent" ? "What would make this event useful." : null}
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
            className="h-px bg-[var(--signal-vivid)] transition-[width] duration-300 dark:bg-signal"
            style={{ width: stepMeta[step].progress }}
          />
        </div>
      </div>

      <Crossfade id={step} className="flex flex-col gap-6">
      {step === "event" ? (
        <EventPicker
          events={events}
          onPick={pickEvent}
          canCreateEvent={canCreateEvent}
          selectedId={selected?.id ?? null}
        />
      ) : null}

      {step === "identity" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4">
            <p className={badge}>Tell Meta about you</p>
            <ul className="grid gap-1.5 text-sm leading-relaxed text-foreground min-[720px]:grid-cols-2">
              {ABOUT_GUIDE.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5" aria-label="Sentence starters">
              {STARTER_CHIPS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setDescription((current) => `${current.trimEnd()}${current.trim() ? " " : ""}${starter} `)}
                  className="inline-flex h-8 items-center rounded-full border border-border px-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
          <label className={field}>
            About you
            <textarea
              className={textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={ABOUT_PLACEHOLDER}
              required
              minLength={20}
              maxLength={2000}
              aria-describedby="about-hint about-count"
            />
          </label>
          <div className="flex items-center justify-between gap-4">
            <p id="about-hint" className="text-sm text-muted-foreground">More detail = better matches.</p>
            <p id="about-count" className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground tabular-nums">
              {description.trim().length}/2000
            </p>
          </div>
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
