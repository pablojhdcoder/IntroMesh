import Link from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { service } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const data = await service().intelligence();
  const report = data.report;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-6 sm:px-8 min-[720px]:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
              IntroMesh
            </Link>
          </p>
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] min-[720px]:text-[2.5rem]">Intelligence</h1>
          <p className="max-w-[44ch] text-sm text-muted-foreground">
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

      <div className="grid gap-12 sm:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sharing</h2>
          <dl className="grid grid-cols-[1fr_max-content] gap-x-6 gap-y-1 text-sm">
            <Row label="Links" value={String(report.shares.link)} />
            <Row label="QR" value={String(report.shares.qr)} />
            <Row label="NFC" value={String(report.shares.nfc)} />
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Topics</h2>
          {report.topics.length === 0 ? <p className="text-sm text-muted-foreground">No topic has enough cases yet.</p> : null}
          {report.topics.length > 0 ? (
            <dl className="grid grid-cols-[1fr_max-content] gap-x-6 gap-y-1 text-sm">
              {report.topics.map((topic) => (
                <Row key={topic.topic} label={topic.topic} value={String(topic.count)} />
              ))}
            </dl>
          ) : null}
          {report.suppressedTopics > 0 ? (
            <p className="text-sm text-muted-foreground">{report.suppressedTopics} topics hidden because the group is under 5.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-heading text-3xl leading-none tracking-[-0.02em] tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
