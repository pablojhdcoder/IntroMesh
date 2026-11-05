"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import type { PublicProfile, SharedCard } from "@/domain/profile";
import type { GroundedExplanation } from "@/domain/ground";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { AuthFlow } from "@/components/onboarding/auth-flow";
import { OnboardingFlow, type OnboardingDraft } from "@/components/onboarding/onboarding-flow";
import { FIELD_SELF_ID, SignalField, type FieldPerson } from "@/components/signal/signal-field";
import { ShareTools } from "@/components/share/share-tools";
import { ConnectionActions } from "@/components/connections/connection-actions";
import { ThemeSwitch } from "@/components/theme-switch";
import { SignalIntro } from "@/components/signal/signal-intro";
import { SignalRail, type RailStatus } from "@/components/signal/signal-rail";
import { ArrowLeft, ArrowUpRight, Check, Copy, Info } from "lucide-react";
import {
  explainErrorCopy,
  fetchJsonDeduped,
  getCachedRoom,
  normalizeDiscovery,
  setCachedRoom,
  type DirectoryPerson,
  type ExplainErrorKind,
  type ViewerEmbeddingStatus,
} from "@/components/signal/use-room";

// Grounded model explanation only: source "model" comes from the domain type.
type Explanation = GroundedExplanation & { cached?: boolean };

type Connection = {
  id: string;
  status: "pending" | "accepted" | "declined";
  toId: string;
  fromId: string;
  intro: string | null;
  other: SharedCard;
};

type Session = {
  profile: PublicProfile | null;
  account: { username: string } | null;
  needsSetup: boolean;
  identityConfirmed?: boolean;
  canCreateEvent?: boolean;
  draft?: OnboardingDraft | null;
  metaConfigured: boolean;
  event: { id: string; name: string; demo: boolean } | null;
  memberships?: Array<{
    eventId: string;
    status: string;
    joinedAt?: string | null;
    event: { id: string; name: string; demo: boolean };
    memberCount?: number;
  }>;
};

const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";
const actionSize = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const backControl =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:h-9";

/** The @ is the visible identity: username wins, legacy names stay as-is. */
function nameOf(person: { username?: string | null; displayName: string }): string {
  return person.username ? `@${person.username}` : person.displayName;
}

function evidenceOf(recommendation: NonNullable<FieldPerson["recommendation"]>) {
  return [
    ...recommendation.shared.interests.map((value) => ({ kind: "Shared interest", value })),
    ...recommendation.shared.skills.map((value) => ({ kind: "Shared skill", value })),
    ...recommendation.complement.map((value) => ({ kind: "Complements", value })),
  ].slice(0, 3);
}

function reasonOf(person: FieldPerson) {
  return person.recommendation?.shared.interests[0] ?? person.recommendation?.shared.skills[0] ?? person.recommendation?.complement[0] ?? "shared goal";
}

function tagsOfRecommendation(person: FieldPerson): string[] {
  const rec = person.recommendation;
  if (!rec) return [...person.interests, ...person.skills].slice(0, 2);
  return [...rec.shared.interests, ...rec.shared.skills, ...rec.complement].slice(0, 2);
}

function tagsOfDirectory(person: DirectoryPerson): string[] {
  return [...person.interests, ...person.skills].slice(0, 2);
}

function PresenterChecklist({
  metaConfigured,
  pairCached,
  memberCount,
  acceptedCount,
  onDismiss,
}: {
  metaConfigured: boolean;
  pairCached: boolean;
  memberCount: number;
  acceptedCount: number;
  onDismiss: () => void;
}) {
  const params = useSearchParams();
  if (params.get("present") !== "1") return null;
  const rows: { label: string; ok: boolean; hint: string }[] = [
    { label: "Meta", ok: metaConfigured, hint: metaConfigured ? "configured" : "not configured" },
    { label: "Pair cache", ok: pairCached, hint: pairCached ? "cached" : "open a real match to warm cache" },
    { label: "Members", ok: memberCount > 0, hint: memberCount > 0 ? `${memberCount} registered` : "none yet" },
    { label: "Accepted", ok: acceptedCount > 0, hint: acceptedCount > 0 ? `${acceptedCount} accepted` : "none yet" },
  ];
  return (
    <section aria-label="Presenter checklist" className="flex shrink-0 flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-lg leading-none tracking-[-0.02em]">Presenter checklist</h2>
        <Button type="button" variant="ghost" className="h-9 w-auto px-3" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">{row.label}</span>
            <span aria-hidden="true" className={row.ok ? "text-[var(--signal-vivid)] dark:text-signal" : "text-muted-foreground"}>
              {row.ok ? "âœ“" : "Â·"}
            </span>
            <span className="sr-only">{row.ok ? "ready" : "pending"}</span>
            <span className="text-xs text-muted-foreground">{row.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SignalApp({ eventId: eventIdProp, entry }: { eventId?: string; entry?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [people, setPeople] = useState<FieldPerson[]>([]);
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [viewerEmbeddingStatus, setViewerEmbeddingStatus] = useState<ViewerEmbeddingStatus>("ready");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [directoryId, setDirectoryId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainErrorKind, setExplainErrorKind] = useState<ExplainErrorKind | null>(null);
  const [explainPending, setExplainPending] = useState(false);
  const [openerDraft, setOpenerDraft] = useState("");
  const [copiedIntro, setCopiedIntro] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [openerKey, setOpenerKey] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [directoryDraft, setDirectoryDraft] = useState("");
  const [directoryPending, setDirectoryPending] = useState(false);
  const [directoryRequestError, setDirectoryRequestError] = useState<string | null>(null);
  const nextOpenerKey = explanation ? `${selectedId ?? ""}:${explanation.summary}:${explanation.opener}` : null;
  useEffect(() => {
    if (nextOpenerKey !== openerKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft when selection/explanation changes
      setOpenerKey(nextOpenerKey);
      setOpenerDraft(explanation?.opener ?? "");
      setCopiedIntro(false);
      setCopyError(null);
    }
  }, [nextOpenerKey, openerKey, explanation]);
  useEffect(() => {
    if (!copiedIntro) return;
    const timer = window.setTimeout(() => setCopiedIntro(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedIntro]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const roomRequest = useRef(0);
  const explainSeq = useRef(0);
  const explanationCache = useRef(new Map<string, Explanation>());
  const [showIntro, setShowIntro] = useState(false);
  const activeEventId = eventIdProp ?? session?.event?.id;
  const activeMembership = activeEventId
    ? session?.memberships?.find((item) => item.eventId === activeEventId && item.status === "joined")
    : undefined;
  const activeEvent = activeMembership?.event ?? session?.event ?? null;

  const loadRoom = useCallback(async (eventId: string, opts?: { background?: boolean }) => {
    // Reuse the cached roster instantly; a background refresh must never
    // clear the current people (no people=[] flash on mode switch).
    const cached = getCachedRoom<Connection>(eventId);
    if (cached) {
      setPeople(cached.people);
      setDirectory(cached.directory ?? []);
      setViewerEmbeddingStatus(cached.viewerEmbeddingStatus ?? "ready");
      setConnections(cached.connections);
    }
    const foreground = !opts?.background && !cached;
    if (foreground) {
      setRoomLoading(true);
      setLoadError(null);
    }
    const requestId = ++roomRequest.current;
    // Parallel pair (kept); per-key dedupe collapses concurrent callers
    // into one fetch each.
    const [discoveryResult, connectionsResult] = await Promise.all([
      fetchJsonDeduped(`discovery:${eventId}`, `/api/discovery?eventId=${eventId}`),
      fetchJsonDeduped(`connections:${eventId}`, `/api/connections?eventId=${eventId}`),
    ]);
    // Ignore stale responses: a newer load wins.
    if (roomRequest.current !== requestId) return;
    if (!discoveryResult.ok) {
      if (foreground) setRoomLoading(false);
      setLoadError("Could not load the event.");
      return;
    }
    const discovery = discoveryResult.body as {
      people?: unknown;
      directory?: unknown;
      viewerEmbeddingStatus?: unknown;
    } | null;
    const snapshot = normalizeDiscovery(discovery ?? {});
    const fetchedPeople = discoveryResult.ok ? snapshot.people : (cached?.people ?? []);
    const fetchedDirectory = discoveryResult.ok ? snapshot.directory : (cached?.directory ?? []);
    const fetchedEmbeddingStatus = discoveryResult.ok
      ? snapshot.viewerEmbeddingStatus
      : (cached?.viewerEmbeddingStatus ?? "ready");
    const connectionsBody = connectionsResult.body as { connections?: Connection[] } | null;
    const fetchedConnections = Array.isArray(connectionsBody?.connections)
      ? connectionsBody.connections
      : (cached?.connections ?? []);
    setCachedRoom<Connection>(eventId, {
      people: fetchedPeople,
      directory: fetchedDirectory,
      connections: fetchedConnections,
      viewerEmbeddingStatus: fetchedEmbeddingStatus,
      at: Date.now(),
    });
    setPeople(fetchedPeople);
    setDirectory(fetchedDirectory);
    setViewerEmbeddingStatus(fetchedEmbeddingStatus);
    setConnections(fetchedConnections);
    setLoadError(null);
    setRoomLoading(false);
  }, []);

  const load = useCallback(async () => {
    const sessionResponse = await fetch("/api/session");
    const nextSession = (await sessionResponse.json()) as Session;
    if (entry && nextSession.profile && nextSession.identityConfirmed) {
      // Redirect before painting: setting session first would flash the room
      // for a frame (profile + event already present) before /events lands.
      router.replace("/events");
      return;
    }
    setSession(nextSession);
    if (!nextSession.profile) return;
    if (eventIdProp) {
      await loadRoom(eventIdProp);
      return;
    }
    if (nextSession.needsSetup || !nextSession.event) return;
    await loadRoom(nextSession.event.id);
  }, [loadRoom, entry, eventIdProp, router]);

  useEffect(() => {
    // Session lives on the server; the first paint must read it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; setState runs after fetch
    void load();
  }, [load]);

  const profileId = session?.profile?.id ?? null;
  useEffect(() => {
    if (!activeEventId || !profileId) return;
    try {
      const key = `intro-seen:${activeEventId}:${profileId}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit intro; reads localStorage once per event+profile
      if (!window.localStorage.getItem(key)) setShowIntro(true);
    } catch {
      setShowIntro(false);
    }
  }, [activeEventId, profileId]);

  function dismissIntro() {
    if (activeEventId && profileId) {
      try {
        window.localStorage.setItem(`intro-seen:${activeEventId}:${profileId}`, "1");
      } catch {
        // Storage unavailable: still dismiss for this visit.
      }
    }
    setShowIntro(false);
  }

  async function retryRoom() {
    if (!activeEventId) return;
    await loadRoom(activeEventId);
  }

  async function openPerson(id: string | null, regenerate = false) {
    const seq = ++explainSeq.current;
    // A selection reveals the rail/sheet: the detail lives inside it.
    if (id) {
      setRailCollapsed(false);
      setSheetExpanded(true);
    }
    setDirectoryId(null);
    if (!id || id === FIELD_SELF_ID) {
      setSelectedId(id);
      setExplanation(null);
      setExplainError(null);
      setExplainErrorKind(null);
      setExplainPending(false);
      return;
    }
    setSelectedId(id);
    const cacheKey = `${activeEventId ?? ""}:${id}`;
    if (!regenerate) {
      const cached = explanationCache.current.get(cacheKey);
      if (cached) {
        setExplanation(cached);
        setExplainError(null);
        setExplainErrorKind(null);
        setExplainPending(false);
        return;
      }
    } else {
      explanationCache.current.delete(cacheKey);
    }
    setExplainPending(true);
    setExplainError(null);
    setExplainErrorKind(null);
    try {
      const response = await fetch("/api/affinity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: id, regenerate, eventId: activeEventId }),
      });
      const body = (await response.json()) as { error?: unknown; explanation?: Explanation };
      if (explainSeq.current !== seq) return;
      setExplainPending(false);
      if (!response.ok) {
        setExplanation(null);
        const kind: ExplainErrorKind =
          body.error === "match" ||
          body.error === "presence" ||
          body.error === "config" ||
          body.error === "unavailable"
            ? body.error
            : "meta";
        setExplainErrorKind(kind);
        setExplainError(explainErrorCopy(kind));
        return;
      }
      setExplainErrorKind(null);
      setExplanation(body.explanation as Explanation);
      if (body.explanation) explanationCache.current.set(cacheKey, body.explanation as Explanation);
    } catch {
      if (explainSeq.current !== seq) return;
      setExplanation(null);
      setExplainErrorKind("meta");
      setExplainError(explainErrorCopy("meta"));
    } finally {
      if (explainSeq.current === seq) setExplainPending(false);
    }
  }

  function openDirectoryPerson(id: string | null) {
    // Directory rows open the public card: no score, no reason, no
    // explanation fetch. Connect uses your own words (see
    // requestDirectoryIntro), never a model opener.
    if (id) {
      setRailCollapsed(false);
      setSheetExpanded(true);
    }
    explainSeq.current += 1;
    setSelectedId(null);
    setExplanation(null);
    setExplainError(null);
    setExplainErrorKind(null);
    setExplainPending(false);
    setDirectoryId(id);
    setDirectoryDraft("");
    setDirectoryRequestError(null);
  }

  async function requestIntro() {
    if (!selectedId || !explanation || requestPending) return;
    const trimmed = openerDraft.trim();
    if (!trimmed) return;
    const edited = trimmed !== explanation.opener.trim();
    setRequestPending(true);
    setRequestError(null);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: selectedId, intro: trimmed, introSource: edited ? "user" : "model", eventId: activeEventId }),
      });
      if (!response.ok) throw new Error("request");
      setRequestError(null);
      await load();
    } catch {
      setRequestError("Could not send request. Try again.");
    } finally {
      setRequestPending(false);
    }
  }

  async function requestDirectoryIntro() {
    // Everyone going can receive a request too: the server only requires
    // both sides to be joined, not a recommendation. No score, no evidence,
    // no model opener — the intro is always the user's own words.
    if (!directoryId || directoryPending) return;
    const trimmed = directoryDraft.trim();
    if (!trimmed) return;
    setDirectoryPending(true);
    setDirectoryRequestError(null);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: directoryId, intro: trimmed, introSource: "user", eventId: activeEventId }),
      });
      if (!response.ok) throw new Error("request");
      setDirectoryRequestError(null);
      setDirectoryDraft("");
      await load();
    } catch {
      setDirectoryRequestError("Could not send request. Try again.");
    } finally {
      setDirectoryPending(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2.5 font-heading text-[2rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-[var(--signal-vivid)] dark:bg-signal" />
            IntroMesh
          </p>
          <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5">
            <div className="h-2.5 w-48 rounded-full bg-surface-raised" />
            <div className="h-2.5 w-32 rounded-full bg-surface-raised" />
            <div className="h-2.5 w-40 rounded-full bg-surface-raised" />
          </div>
          <p role="status" className="sr-only">
            Loading session.
          </p>
        </div>
        <ThemeSwitch />
      </div>
    );
  }
  if (!session.profile && !session.account) {
    return <AuthFlow onAuthed={() => void load()} />;
  }
  if (!session.profile || (session.needsSetup && !eventIdProp)) {
    return (
      <OnboardingFlow
        metaConfigured={session.metaConfigured}
        identityConfirmed={session.identityConfirmed ?? false}
        canCreateEvent={session.canCreateEvent ?? false}
        draft={session.draft ?? null}
        accountUsername={session.account?.username ?? null}
        onSaved={() => void load()}
      />
    );
  }

  const selfSelected = selectedId === FIELD_SELF_ID;
  const selected = people.find((person) => person.id === selectedId) ?? null;
  const detail = selected && selected.recommendation ? { person: selected, recommendation: selected.recommendation } : null;
  const directoryPerson = !detail ? (directory.find((person) => person.id === directoryId) ?? null) : null;
  const relation = connections.find((item) => item.other.id === selectedId && item.status !== "declined");
  const directoryRelation = connections.find((item) => item.other.id === directoryId && item.status !== "declined");
  const directoryRequestDisabled = directoryDraft.trim().length === 0 || directoryPending;
  const recommendations = people.filter((person) => person.recommendation);
  const embeddingPending = viewerEmbeddingStatus === "pending";
  const emptyRoom = !roomLoading && !loadError && !embeddingPending && recommendations.length === 0 && directory.length === 0;
  const noMatchesYet = !roomLoading && !loadError && !embeddingPending && recommendations.length === 0 && directory.length > 0;
  const memberCount = recommendations.length + directory.length;
  const traceChips = explanation
    ? [
        ...explanation.citedGoals.slice(0, 2).map((value) => ({ label: `Cited Â· goal: ${value}`, key: `goal-${value}` })),
        ...explanation.citedInterests.slice(0, 2).map((value) => ({ label: `Cited Â· interest: ${value}`, key: `interest-${value}` })),
        ...explanation.citedSkills.slice(0, 2).map((value) => ({ label: `Cited Â· skill: ${value}`, key: `skill-${value}` })),
        ...explanation.complement.slice(0, 2).map((value) => ({ label: `Complements: ${value}`, key: `complement-${value}` })),
      ].slice(0, 6)
    : [];
  const talkPoints = explanation
    ? [...explanation.citedGoals, ...explanation.citedInterests, ...explanation.citedSkills, ...explanation.complement].slice(0, 3)
    : detail
      ? evidenceOf(detail.recommendation).map((item) => item.value).slice(0, 3)
      : [];
  const meetIntro = relation?.intro ?? explanation?.opener ?? openerDraft.trim();
  const requestDisabled = !explanation || explainPending || !!explainError || openerDraft.trim().length === 0 || requestPending;
  const pairCached = !!explanation && !explainPending;
  const acceptedCount = connections.filter((item) => item.status === "accepted").length;

  const railStatus: RailStatus = embeddingPending
    ? "pending"
    : roomLoading
      ? "loading"
      : loadError && recommendations.length === 0
        ? "error"
        : emptyRoom
          ? "empty-room"
          : noMatchesYet
            ? "no-matches"
            : "ready";
  const railNotice =
    loadError && recommendations.length > 0 ? "Could not refresh â€” showing the last known room." : null;
  const showingDetail = Boolean(selfSelected || detail || directoryPerson);

  async function copyIntro(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopiedIntro(true);
    } catch {
      setCopiedIntro(false);
      setCopyError("Copy failed â€” select the text manually.");
    }
  }

  return (
    <div className="relative h-svh w-full overflow-hidden bg-background text-foreground">
      <div className="absolute top-3 left-3 z-20 flex w-[min(25rem,calc(100%-1.5rem))] flex-col gap-3 min-[720px]:top-4 min-[720px]:left-4">
      <header className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/events"
            aria-label="Back to events"
            title="Back to events"
            className={cn(backControl, focusRing, "-ml-3")}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to events
          </Link>
          <ThemeSwitch />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2.5 font-heading text-[2rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-[var(--signal-vivid)] dark:bg-signal" />
            IntroMesh
          </h1>
          <p className="flex max-w-[36ch] flex-wrap items-center gap-2">
            <span className={meta}>{activeEvent?.name}</span>
            {activeEvent?.demo ? (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                Demo
              </span>
            ) : null}
          </p>
          {session.memberships && session.memberships.filter((item) => item.status === "joined").length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="event-switcher" className="sr-only">
                  Switch event
                </label>
                <select
                  id="event-switcher"
                  aria-label="Switch event"
                  value={activeEventId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value || value === activeEventId) return;
                    router.push(`/events/${value}`);
                  }}
                  className={cn(
                    "min-h-11 rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground min-[720px]:min-h-9 min-[720px]:text-sm",
                    focusRing,
                  )}
                >
                  {session.memberships
                    .filter((item) => item.status === "joined")
                    .map((item) => (
                      <option key={item.eventId} value={item.eventId}>
                        {item.event.name}
                      </option>
                    ))}
                </select>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              aria-label="Replay intro"
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:h-9",
                focusRing,
              )}
            >
              <Info aria-hidden="true" className="size-4" />
              Replay intro
            </button>
          </div>
        </div>
      </header>

      {!checklistDismissed ? (
        <Suspense fallback={null}>
          <PresenterChecklist
            metaConfigured={session.metaConfigured}
            pairCached={pairCached}
            memberCount={memberCount}
            acceptedCount={acceptedCount}
            onDismiss={() => setChecklistDismissed(true)}
          />
        </Suspense>
      ) : null}
      {loadError ? (
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{loadError}</p>
          {activeEvent ? (
            <button type="button" onClick={() => void retryRoom()} className={cn("rounded-md px-2 py-1 font-medium underline underline-offset-4", focusRing)}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      </div>

      {/* The field always fills the whole page, so "You" sits exactly at
          page center. The rail is a pure overlay on top: opening or
          closing it never resizes the canvas, never touches the camera,
          and can never shift the center. */}
      <div className="absolute inset-0">
        <SignalField
          people={people}
          selectedId={selectedId}
          hoveredId={hoveredId}
          loading={roomLoading}
          embeddingPending={embeddingPending}
          onSelect={(id) => void openPerson(id === selectedId ? null : id)}
          onHover={setHoveredId}
        />
      </div>

      {showIntro && session.profile ? (
        <div className="absolute inset-0 z-30 overflow-y-auto p-3 min-[720px]:p-6">
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
            <SignalIntro
              displayName={nameOf(session.profile)}
              role={session.profile.role}
              onDone={dismissIntro}
              onSkip={dismissIntro}
            />
          </div>
        </div>
      ) : (
        <SignalRail
          recommendations={recommendations}
          directory={directory}
          selectedId={selectedId}
          directoryId={directoryId}
          hoveredId={hoveredId}
          onSelectPerson={(id) => void openPerson(id === selectedId ? null : id)}
          onSelectDirectory={(id) => openDirectoryPerson(id === directoryId ? null : id)}
          onHover={setHoveredId}
          displayName={nameOf}
          reasonOf={reasonOf}
          recommendationTags={tagsOfRecommendation}
          directoryTags={tagsOfDirectory}
          detailLabel={
            selfSelected && session.profile
              ? nameOf(session.profile)
              : detail
                ? nameOf(detail.person)
                : directoryPerson
                  ? nameOf(directoryPerson)
                  : null
          }
          onBack={() => void openPerson(null)}
          collapsed={railCollapsed}
          onToggleCollapsed={() => setRailCollapsed((value) => !value)}
          sheetExpanded={sheetExpanded}
          onToggleSheet={() => setSheetExpanded((value) => !value)}
          status={railStatus}
          notice={railNotice}
          onBrowseEvents={() => router.push("/events")}
          detail={
            showingDetail ? (
              <div className="flex flex-col gap-6">
          {selfSelected && session.profile ? (
            <article className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] min-[720px]:text-[2.5rem]">{nameOf(session.profile)}</h2>
                <p className={meta}>{session.profile.role} Â· You</p>
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Interests</dt>
                <dd>{session.profile.interests.join(", ")}</dd>
                <dt className="text-muted-foreground">Skills</dt>
                <dd>{session.profile.skills.join(", ")}</dd>
                <dt className="text-muted-foreground">Looking for</dt>
                <dd>{session.profile.seeking}</dd>
              </dl>
            </article>
          ) : null}

          {detail ? (
            <article className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">{nameOf(detail.person)}</h2>
                <p className={cn(meta, "flex flex-wrap items-center gap-2")}>
                  <span>
                    {detail.person.role}
                    {detail.recommendation.shared.goals[0] ? ` Â· ${detail.recommendation.shared.goals[0]}` : ""}
                  </span>
                  {detail.person.demo ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem]">Demo</span>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <dl className="flex flex-col divide-y divide-border text-sm">
                  {evidenceOf(detail.recommendation).map((item, index) => (
                    <div key={`${item.kind}-${item.value}-${index}`} className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">{item.kind}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                    {detail.recommendation.confidence === "low"
                      ? "Low confidence Â· not a fact"
                      : detail.recommendation.confidence === "medium"
                        ? "Medium confidence"
                        : "High confidence"}
                  </span>
                </p>
              </div>

              <Crossfade
                id={explainPending ? "pending" : explainError ? "error" : explanation ? "ready" : "idle"}
                initial
                className="flex flex-col gap-3"
              >
                {explainPending ? (
                  <div className="flex flex-col gap-2">
                    <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5">
                      <div className="h-2.5 w-3/4 rounded-full bg-surface-raised" />
                      <div className="h-2.5 w-full rounded-full bg-surface-raised" />
                      <div className="h-2.5 w-1/2 rounded-full bg-surface-raised" />
                    </div>
                    <p role="status" className="sr-only">
                      Preparing explanation.
                    </p>
                  </div>
                ) : null}
                {explainError ? (
                  <div role="alert" className="flex flex-col gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <p>{explainError}</p>
                    {explainErrorKind === "match" ? <p className="text-destructive/80">Pick a highlighted person.</p> : null}
                    {explainErrorKind === "meta" || explainErrorKind === "unavailable" ? (
                      <p>
                        <button
                          type="button"
                          onClick={() => void openPerson(selectedId, true)}
                          className={cn("rounded-md px-2 py-1 font-medium underline underline-offset-4", focusRing)}
                        >
                          Try again
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {explanation ? (
                  <div className="flex flex-col gap-3 border-l-2 border-[var(--signal-vivid)] pl-4 dark:border-signal">
                    <p className="max-w-[52ch] text-[0.9375rem] leading-normal">{explanation.summary}</p>
                    {traceChips.length > 0 ? (
                      <ul aria-label="Evidence trace" className="flex flex-wrap gap-1.5">
                        {traceChips.map((chip, index) => (
                          <li
                            key={`${chip.key}-${index}`}
                            className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase"
                          >
                            {chip.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="opener-edit" className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                        Opener
                      </label>
                      <textarea
                        id="opener-edit"
                        value={openerDraft}
                        onChange={(event) => setOpenerDraft(event.target.value)}
                        maxLength={220}
                        rows={3}
                        className={cn(
                          "w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[0.9375rem] leading-normal text-foreground",
                          focusRing,
                        )}
                      />
                      <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                        {openerDraft.length}/220
                      </p>
                    </div>
                    <p>
                      <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                        Meta AI
                      </span>
                    </p>
                  </div>
                ) : null}
              </Crossfade>

              <div className="flex flex-col gap-3">
                {relation?.status === "pending" ? (
                  <p>
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                      Request pending
                    </span>
                  </p>
                ) : null}
                {relation?.status === "pending" && session.profile && relation.toId === session.profile.id ? (
                  <ConnectionActions
                    connectionId={relation.id}
                    otherName={detail.person.displayName}
                    onResolved={() => void load()}
                  />
                ) : null}
                <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                  {!relation ? (
                    <Button type="button" className={actionSize} disabled={requestDisabled} onClick={() => void requestIntro()}>
                      Request connection
                    </Button>
                  ) : null}
                </div>
                {requestError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {requestError}
                  </p>
                ) : null}
              </div>

              {relation?.status === "accepted" && session.profile ? (
                <Crossfade id="share" initial className="flex flex-col">
                  <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
                    <h3 className="font-heading text-xl leading-none tracking-[-0.02em]">Meet now</h3>
                    <p className="flex max-w-[52ch] items-start gap-2 text-sm">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--signal-vivid)] dark:text-signal" />
                      <span>Connection accepted{relation.intro ? `. ${relation.intro}.` : "."}</span>
                    </p>
                    {meetIntro ? (
                      <div className="flex flex-col gap-2">
                        <p className="max-w-[52ch] font-heading text-lg leading-snug italic">{meetIntro}</p>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(actionSize, "w-auto")}
                            onClick={() => void copyIntro(meetIntro)}
                            aria-label={copiedIntro ? "Copied" : "Copy"}
                          >
                            {copiedIntro ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                            {copiedIntro ? "Copied" : "Copy"}
                          </Button>
                        </div>
                        {copyError ? (
                          <p role="status" className="text-sm text-muted-foreground">
                            {copyError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {talkPoints.length > 0 ? (
                      <ul aria-label="Talking points" className="flex flex-wrap gap-1.5">
                        {talkPoints.map((point, index) => (
                          <li
                            key={`${point}-${index}`}
                            className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase"
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="max-w-[52ch] text-sm text-muted-foreground">Share your card so they can find you in the room.</p>
                    <ShareTools slug={session.profile.slug} name={nameOf(session.profile)} />
                  </div>
                </Crossfade>
              ) : null}
            </article>
          ) : null}

          {directoryPerson ? (
            <article className="flex flex-col gap-4" aria-label="Public card">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">
                  {nameOf(directoryPerson)}
                </h2>
                <p className={cn(meta, "flex flex-wrap items-center gap-2")}>
                  <span>{directoryPerson.role}</span>
                  {directoryPerson.demo ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem]">Demo</span>
                  ) : null}
                </p>
              </div>
              {directoryPerson.interests.length > 0 || directoryPerson.skills.length > 0 ? (
                <dl className="flex flex-col divide-y divide-border text-sm">
                  {directoryPerson.interests.length > 0 ? (
                    <div className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">Interests</dt>
                      <dd>{directoryPerson.interests.join(", ")}</dd>
                    </div>
                  ) : null}
                  {directoryPerson.skills.length > 0 ? (
                    <div className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">Skills</dt>
                      <dd>{directoryPerson.skills.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {directoryRelation?.status === "pending" ? (
                <p>
                  <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                    Request pending
                  </span>
                </p>
              ) : null}
              {directoryRelation?.status === "pending" && session.profile && directoryRelation.toId === session.profile.id ? (
                <ConnectionActions
                  connectionId={directoryRelation.id}
                  otherName={directoryPerson.displayName}
                  onResolved={() => void load()}
                />
              ) : null}
              {directoryRelation?.status === "accepted" && session.profile ? (
                <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
                  <h3 className="font-heading text-xl leading-none tracking-[-0.02em]">Meet now</h3>
                  <p className="max-w-[52ch] text-sm text-muted-foreground">
                    Connection accepted. Share your card so they can find you in the room.
                  </p>
                  <ShareTools slug={session.profile.slug} name={nameOf(session.profile)} />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="directory-intro" className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                      Your first hello
                    </label>
                    <textarea
                      id="directory-intro"
                      value={directoryDraft}
                      onChange={(event) => setDirectoryDraft(event.target.value)}
                      maxLength={280}
                      rows={3}
                      placeholder={`Hi ${directoryPerson.displayName.split(" ")[0] ?? "there"}, I saw you're going and would love to say hello…`}
                      className={cn(
                        "w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[0.9375rem] leading-normal text-foreground",
                        focusRing,
                      )}
                    />
                    <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                      {directoryDraft.length}/280 · No AI opener here — not a close match, so write it yourself
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                    {!directoryRelation ? (
                      <Button type="button" className={actionSize} disabled={directoryRequestDisabled} onClick={() => void requestDirectoryIntro()}>
                        Request connection
                      </Button>
                    ) : null}
                    <Link
                      href={`/u/${directoryPerson.slug}`}
                      className={cn(
                        "inline-flex h-11 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 min-[720px]:h-9",
                        focusRing,
                      )}
                    >
                      View public card
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                  {directoryRequestError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {directoryRequestError}
                    </p>
                  ) : null}
                </div>
              )}
            </article>
          ) : null}
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}
