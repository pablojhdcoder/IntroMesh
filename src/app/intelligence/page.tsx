import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitch } from "@/components/theme-switch";
import { service } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const data = await service().intelligence();
  const report = data.report;
  const acceptedPercent = report.requests > 0 ? Math.round((report.accepted / report.requests) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground min-[720px]:min-h-9"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              IntroMesh
            </Link>
          </p>
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">Intelligence</h1>
          <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            {data.event?.name ?? "Event"}. Aggregates only{data.demo ? " · Demo" : ""}.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
        <Stat label="Visible" value={String(report.visible)} />
        <Stat label="Recommendations" value={String(report.recommendations)} />
        <Stat label="Profiles viewed" value={String(report.profileViews)} />
        <Stat label="Requests" value={String(report.requests)} />
        <Stat label="Accepted" value={String(report.accepted)} />
        <Stat label="Conversion" value={report.conversion === null ? "—" : `${Math.round(report.conversion * 100)}%`} />
      </dl>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Accepted of requests">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Accepted / Requests</h2>
          <p className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
            {report.accepted} / {report.requests}
            {report.conversion === null ? "" : ` · ${Math.round(report.conversion * 100)}%`}
          </p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--signal-strong)] transition-[width] duration-300 dark:bg-signal"
            style={{ width: `${acceptedPercent}%` }}
          />
        </div>
      </section>

      <div className="grid gap-12 sm:grid-cols-2">
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Sharing</h2>
          <dl className="flex flex-col divide-y divide-border text-sm">
            <Row label="Links" value={String(report.shares.link)} />
            <Row label="QR" value={String(report.shares.qr)} />
            <Row label="NFC" value={String(report.shares.nfc)} />
          </dl>
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Topics</h2>
          {report.topics.length === 0 ? <p className="text-sm text-muted-foreground">No topic has enough cases yet.</p> : null}
          {report.topics.length > 0 ? (
            <dl className="flex flex-col divide-y divide-border text-sm">
              {report.topics.map((topic) => (
                <Row key={topic.topic} label={topic.topic} value={String(topic.count)} />
              ))}
            </dl>
          ) : null}
          {report.suppressedTopics > 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{report.suppressedTopics} topics hidden because the group is under 5.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <dt className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
      <dd className="font-heading text-4xl leading-none tracking-[-0.02em] tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
