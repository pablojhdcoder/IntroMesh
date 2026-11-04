import type { ReactNode } from "react";
import Image from "next/image";
import { goalLabel } from "@/domain/catalog";
import type { ProfileLike } from "@/components/profile/profile-view";

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const chip = "inline-flex min-h-8 items-center rounded-full border border-border px-3 py-1 text-sm";

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export type ProfileHeroStats = {
  connections?: number;
  events?: number;
};

export function ProfileHero({
  profile,
  stats,
  actions,
}: {
  profile: ProfileLike;
  stats?: ProfileHeroStats;
  actions?: ReactNode;
}) {
  const handle = profile.username ?? profile.slug;
  const statsItems: { label: string; value: number }[] = [];
  if (stats?.connections !== undefined) {
    statsItems.push({ label: stats.connections === 1 ? "Connection" : "Connections", value: stats.connections });
  }
  if (stats?.events !== undefined) {
    statsItems.push({ label: stats.events === 1 ? "Event" : "Events", value: stats.events });
  }

  return (
    <section
      className="flex h-full flex-col gap-5 rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-raise)] min-[720px]:p-6"
      aria-label="Profile summary"
    >
      <div className="flex items-start gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`Profile photo of ${profile.displayName}`}
            width={112}
            height={112}
            unoptimized
            className="size-24 shrink-0 rounded-full border border-border object-cover min-[720px]:size-28"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-full bg-signal font-heading text-4xl text-[#14160c] min-[720px]:size-28"
          >
            {initialsOf(profile.displayName)}
          </div>
        )}
        {actions ? <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[2.5rem] leading-none tracking-[-0.02em] break-all text-balance min-[720px]:text-[3.25rem]">
            <span className="sr-only">{profile.displayName} </span>@{handle}
          </h1>
          {profile.role ? (
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{profile.role}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {profile.goal ? <span className={chip}>{goalLabel(profile.goal)}</span> : null}
          {profile.demo ? <span className={chip}>Demo</span> : null}
          {profile.profileVisibility === "private" ? <span className={chip}>Private</span> : null}
        </div>

        {statsItems.length > 0 ? (
          <dl className="flex flex-wrap gap-x-8 gap-y-2 pt-1">
            {statsItems.map((item) => (
              <div key={item.label} className="flex items-baseline gap-2">
                <dt className={`${meta} order-2`}>{item.label}</dt>
                <dd className="order-1 text-lg font-medium tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
