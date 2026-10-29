"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PublicProfile, SharedCard } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile-form";
import { SignalField, type FieldPerson } from "@/components/signal-field";
import { ShareTools } from "@/components/share-tools";

type Explanation = {
  source: "model" | "demo";
  summary: string;
  opener: string;
  citedGoals: string[];
  citedInterests: string[];
  citedSkills: string[];
  complement: string[];
  confidence: "low" | "medium" | "high";
};

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
  needsSetup: boolean;
  metaConfigured: boolean;
  event: { id: string; name: string; demo: boolean } | null;
};

export function SignalApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [presence, setPresence] = useState<"invisible" | "active" | "seeking">("invisible");
  const [people, setPeople] = useState<FieldPerson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainPending, setExplainPending] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sessionResponse = await fetch("/api/session");
    const nextSession = (await sessionResponse.json()) as Session;
    setSession(nextSession);
    if (!nextSession.profile || nextSession.needsSetup || !nextSession.event) return;
    const [discoveryResponse, connectionsResponse] = await Promise.all([
      fetch(`/api/discovery?eventId=${nextSession.event.id}`),
      fetch(`/api/connections?eventId=${nextSession.event.id}`),
    ]);
    if (!discoveryResponse.ok) {
      setLoadError("No se pudo cargar el evento.");
      return;
    }
    const discovery = await discoveryResponse.json();
    setPresence(discovery.presence);
    setPeople(discovery.people);
    setConnections((await connectionsResponse.json()).connections ?? []);
    setLoadError(null);
  }, []);

  useEffect(() => {
    // La sesión vive en el servidor; el primer pintado tiene que leerla.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, el setState ocurre tras el fetch
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.event || presence === "invisible") return;
    const timer = window.setInterval(() => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: session.event?.id, enabled: true, seeking: presence === "seeking" }),
      });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [presence, session?.event]);

  async function changePresence(enabled: boolean, seeking: boolean) {
    if (!session?.event) return;
    await fetch("/api/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: session.event.id, enabled, seeking }),
    });
    await load();
  }

  async function openPerson(id: string, regenerate = false) {
    setSelectedId(id);
    setExplainPending(true);
    setExplainError(null);
    const response = await fetch("/api/affinity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: id, regenerate }),
    });
    const body = await response.json();
    setExplainPending(false);
    if (!response.ok) {
      setExplanation(null);
      setExplainError(
        body.error === "match"
          ? "No hay evidencia suficiente para explicar esta conexión."
          : body.error === "presence"
            ? "Activa tu presencia para ver esta explicación."
            : "Meta no devolvió una explicación válida. No se ha sustituido por un texto inventado.",
      );
      return;
    }
    setExplanation(body.explanation as Explanation);
  }

  async function requestIntro() {
    if (!selectedId || !explanation) return;
    await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: selectedId, intro: explanation.opener, introSource: explanation.source }),
    });
    await load();
  }

  async function resolve(connection: Connection, action: "accept" | "decline") {
    await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: connection.id,
        action,
        simulateDemo: connection.other.demo,
      }),
    });
    await load();
  }

  if (!session) return <p className="text-sm text-muted-foreground">Cargando la sesión.</p>;
  if (session.needsSetup || !session.profile) {
    return <ProfileForm metaConfigured={session.metaConfigured} onSaved={() => void load()} />;
  }

  const selected = people.find((person) => person.id === selectedId) ?? null;
  const relation = connections.find((item) => item.other.id === selectedId && item.status !== "declined");
  const recommendations = people.filter((person) => person.recommendation);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-5xl leading-none tracking-[-0.03em]">IntroMesh</h1>
          <p className="max-w-[36ch] text-sm text-muted-foreground">
            {session.event?.name}. Los nodos de demostración no son teléfonos en la sala.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={presence === "invisible" ? "outline" : "ghost"} onClick={() => void changePresence(false, false)}>
            Invisible
          </Button>
          <Button type="button" variant={presence === "active" ? "default" : "ghost"} onClick={() => void changePresence(true, false)}>
            Activo
          </Button>
          <Button type="button" variant={presence === "seeking" ? "default" : "ghost"} onClick={() => void changePresence(true, true)}>
            Buscando
          </Button>
          <Button variant="outline" asChild>
            <Link href="/intelligence">Inteligencia</Link>
          </Button>
        </div>
      </header>
      {!session.metaConfigured ? (
        <p className="max-w-[62ch] text-sm text-muted-foreground">
          Demostración. Falta MODEL_API_KEY: las explicaciones salen de los datos declarados y no son respuestas de Meta AI.
        </p>
      ) : null}
      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <SignalField people={presence === "invisible" ? [] : people} selectedId={selectedId} onSelect={(id) => void openPerson(id)} />
        <section className="flex flex-col gap-4">
          {presence === "invisible" ? (
            <p className="text-sm text-muted-foreground">Estás invisible. Activa la presencia para ver a quien también está en el evento.</p>
          ) : null}
          {presence !== "invisible" && selected && selected.recommendation ? (
            <article className="flex flex-col gap-4">
              <h2 className="font-heading text-4xl leading-none tracking-[-0.03em]">{selected.displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {selected.role}
                {selected.demo ? " · Demostración" : ""}
                {selected.recommendation.shared.goals[0] ? ` · ${selected.recommendation.shared.goals[0]}` : ""}
              </p>
              <p className="text-sm">
                Confianza {selected.recommendation.confidence === "low" ? "baja: no lo trates como un hecho" : selected.recommendation.confidence === "medium" ? "media" : "alta"}.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {selected.recommendation.shared.interests.map((item) => (
                  <li key={item}>Interés declarado: {item}</li>
                ))}
                {selected.recommendation.shared.skills.map((item) => (
                  <li key={item}>Habilidad compartida: {item}</li>
                ))}
                {selected.recommendation.complement.map((item) => (
                  <li key={item}>Complementa lo que buscas: {item}</li>
                ))}
              </ul>
              {explainPending ? <p className="text-sm text-muted-foreground">Preparando la explicación.</p> : null}
              {explainError ? <p className="text-sm text-destructive">{explainError}</p> : null}
              {explanation ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">{explanation.summary}</p>
                  <p className="text-sm text-muted-foreground">{explanation.opener}</p>
                  <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                    {explanation.source === "model" ? "Meta AI" : "Demostración, no es Meta AI"}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void openPerson(selected.id, true)}>
                  Regenerar
                </Button>
                {!relation ? (
                  <Button type="button" disabled={!explanation} onClick={() => void requestIntro()}>
                    Solicitar conexión
                  </Button>
                ) : null}
                {relation?.status === "pending" && relation.other.demo ? (
                  <Button type="button" onClick={() => void resolve(relation, "accept")}>
                    Simular aceptación
                  </Button>
                ) : null}
                {relation?.status === "accepted" ? <p className="text-sm">Conexión aceptada. La introducción queda guardada: {relation.intro}</p> : null}
              </div>
              {relation?.status === "accepted" && session.profile ? <ShareTools slug={session.profile.slug} name={session.profile.displayName} /> : null}
            </article>
          ) : (
            <div className="flex flex-col gap-3">
              {presence === "invisible" ? null : <h2 className="text-lg">Recomendaciones</h2>}
              {presence === "invisible" ? null : recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nadie visible comparte un objetivo, un interés o una habilidad contigo.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recommendations.map((person) => (
                    <li key={person.id}>
                      <button type="button" className="text-left text-sm underline-offset-4 hover:underline" onClick={() => void openPerson(person.id)}>
                        {person.displayName}
                        {person.demo ? " · demo" : ""} — {person.recommendation?.shared.interests[0] ?? person.recommendation?.shared.skills[0] ?? "objetivo común"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
