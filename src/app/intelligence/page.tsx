import Link from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { service } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const data = await service().intelligence();
  const report = data.report;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:underline">
              Volver al campo
            </Link>
          </p>
          <h1 className="font-heading text-5xl leading-none tracking-[-0.03em]">Inteligencia</h1>
          <p className="max-w-[48ch] text-sm text-muted-foreground">
            {data.event?.name ?? "Evento"}. Agregados del evento. No hay historiales individuales ni rankings de personas.
            {data.demo ? " Los datos semilla son de demostración." : ""}
          </p>
        </div>
        <ThemeSwitch />
      </header>
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Stat label="Visibles" value={String(report.visible)} />
        <Stat label="Recomendaciones" value={String(report.recommendations)} />
        <Stat label="Perfiles vistos" value={String(report.profileViews)} />
        <Stat label="Solicitudes" value={String(report.requests)} />
        <Stat label="Aceptadas" value={String(report.accepted)} />
        <Stat label="Conversión" value={report.conversion === null ? "—" : `${Math.round(report.conversion * 100)}%`} />
      </dl>
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-lg">Intercambio</h2>
        <p>Enlaces {report.shares.link}</p>
        <p>QR {report.shares.qr}</p>
        <p>NFC {report.shares.nfc}</p>
      </section>
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-lg">Temas</h2>
        {report.topics.length === 0 ? <p className="text-muted-foreground">Todavía no hay un tema con suficientes casos.</p> : null}
        {report.topics.map((topic) => (
          <p key={topic.topic}>
            {topic.topic} · {topic.count}
          </p>
        ))}
        {report.suppressedTopics > 0 ? (
          <p className="text-muted-foreground">{report.suppressedTopics} temas ocultos por ser grupos de menos de 5.</p>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-heading text-4xl leading-none">{value}</dd>
    </div>
  );
}
