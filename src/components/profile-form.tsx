"use client";

import { useState } from "react";
import { GOALS, INTERESTS, SKILLS } from "@/domain/catalog";
import type { Presentation, ProfileInput } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/theme-switch";

const empty: ProfileInput = {
  displayName: "",
  role: "",
  bio: "",
  interests: ["modelos"],
  skills: ["prototipado"],
  projects: [],
  links: [],
  offers: "",
  seeking: "",
  goal: "hackathon",
};

export function ProfileForm({
  metaConfigured,
  onSaved,
}: {
  metaConfigured: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProfileInput>(empty);
  const [project, setProject] = useState("");
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "save" | null>(null);

  function toggle(list: "interests" | "skills", value: string) {
    setDraft((current) => {
      const has = current[list].includes(value);
      const next = has ? current[list].filter((item) => item !== value) : [...current[list], value];
      return { ...current, [list]: next.slice(0, 6) };
    });
  }

  async function draftPresentation() {
    setPending("draft");
    setError(null);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: draft }),
    });
    const body = await response.json();
    setPending(null);
    if (!response.ok) {
      setError("No se pudo redactar la presentación. Revisa los campos o el estado de Meta.");
      return;
    }
    setPresentation(body.presentation as Presentation);
  }

  async function save() {
    setPending("save");
    setError(null);
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { ...draft, projects: project ? [project] : draft.projects }, presentation }),
    });
    setPending(null);
    if (!response.ok) {
      setError("El perfil no se ha guardado. Nombre, rol, un interés, una habilidad y lo que buscas son obligatorios.");
      return;
    }
    onSaved();
  }

  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8 sm:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-none tracking-[-0.03em]">Tu identidad</h1>
          <p className="max-w-[42ch] text-[0.9375rem] leading-normal text-muted-foreground">
            Este perfil se reutiliza en cada evento. La presentación se puede editar antes de compartirla.
          </p>
        </div>
        <ThemeSwitch />
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Nombre
        <input className="h-11 rounded-lg border border-border bg-surface px-3" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} required />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Rol
        <input className="h-11 rounded-lg border border-border bg-surface px-3" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} required />
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm">Objetivo en este evento</legend>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((goal) => (
            <Button key={goal.id} type="button" variant={draft.goal === goal.id ? "default" : "ghost"} onClick={() => setDraft({ ...draft, goal: goal.id })}>
              {goal.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <ChipSet legend="Intereses" options={INTERESTS} selected={draft.interests} onToggle={(value) => toggle("interests", value)} />
      <ChipSet legend="Habilidades" options={SKILLS} selected={draft.skills} onToggle={(value) => toggle("skills", value)} />
      <label className="flex flex-col gap-2 text-sm">
        Proyecto
        <input className="h-11 rounded-lg border border-border bg-surface px-3" value={project} onChange={(event) => setProject(event.target.value)} />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Qué puedes aportar
        <textarea className="min-h-20 rounded-lg border border-border bg-surface px-3 py-2" value={draft.offers} onChange={(event) => setDraft({ ...draft, offers: event.target.value })} />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Qué estás buscando
        <textarea className="min-h-20 rounded-lg border border-border bg-surface px-3 py-2" value={draft.seeking} onChange={(event) => setDraft({ ...draft, seeking: event.target.value })} required />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void draftPresentation()}>
          {pending === "draft" ? "Redactando" : "Redactar presentación"}
        </Button>
        <Button type="submit" disabled={pending !== null}>
          {pending === "save" ? "Guardando" : "Entrar al evento"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {metaConfigured
          ? "La redacción usa Meta AI. Puedes corregirla antes de guardarla."
          : "Demostración. No hay MODEL_API_KEY: la redacción se arma solo con tus campos y no es una respuesta del modelo."}
      </p>
      {presentation ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <label className="flex flex-col gap-2 text-sm">
            Titular
            <input className="h-11 rounded-lg border border-border bg-background px-3" value={presentation.headline} onChange={(event) => setPresentation({ ...presentation, headline: event.target.value, source: "user" })} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Resumen
            <textarea className="min-h-24 rounded-lg border border-border bg-background px-3 py-2" value={presentation.summary} onChange={(event) => setPresentation({ ...presentation, summary: event.target.value, source: "user" })} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Cómo empezar
            <textarea className="min-h-20 rounded-lg border border-border bg-background px-3 py-2" value={presentation.opener} onChange={(event) => setPresentation({ ...presentation, opener: event.target.value, source: "user" })} />
          </label>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function ChipSet({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option} type="button" variant={selected.includes(option) ? "default" : "ghost"} aria-pressed={selected.includes(option)} onClick={() => onToggle(option)}>
            {option}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
