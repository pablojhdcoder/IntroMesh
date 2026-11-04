import Image from "next/image";
import { goalLabel } from "@/domain/catalog";

export type ProfileLike = {
  id?: string;
  displayName: string;
  slug: string;
  username?: string | null;
  role: string;
  interests: string[];
  skills: string[];
  projects: string[];
  links?: { label: string; url: string }[];
  offers?: string;
  seeking?: string;
  goal?: string;
  demo?: boolean;
  presentation?: { headline: string; summary: string; opener: string } | null;
  avatarUrl?: string | null;
  profileVisibility?: "public" | "private";
};

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const chip =
  "inline-flex items-center rounded-full border border-border px-3 py-1 text-sm";

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

function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <h3 className={meta}>{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li key={value} className={chip}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProfileSections({ profile }: { profile: ProfileLike }) {
  const presentation = profile.presentation;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-start gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`Profile photo of ${profile.displayName}`}
            width={80}
            height={80}
            unoptimized
            className="size-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-20 items-center justify-center rounded-full bg-signal font-heading text-3xl text-[#14160c]"
          >
            {initialsOf(profile.displayName)}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
            {profile.username ? `@${profile.username}` : profile.displayName}
          </h1>
          {profile.role ? (
            <p className={meta}>{profile.role}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {profile.goal ? <span className={chip}>{goalLabel(profile.goal)}</span> : null}
            {profile.demo ? <span className={chip}>Demo</span> : null}
            {profile.profileVisibility === "private" ? <span className={chip}>Private</span> : null}
          </div>
        </div>
      </section>

      {presentation ? (
        <section className="flex flex-col gap-2" aria-label="About">
          <h2 className="font-heading text-xl leading-tight tracking-[-0.01em]">{presentation.headline}</h2>
          <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed">{presentation.summary}</p>
        </section>
      ) : null}

      <Chips label="Interests" values={profile.interests} />
      <Chips label="Skills" values={profile.skills} />
      <Chips label="Projects" values={profile.projects} />

      {profile.offers ? (
        <section className="flex flex-col gap-2" aria-label="Offers">
          <h3 className={meta}>Offers</h3>
          <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed">{profile.offers}</p>
        </section>
      ) : null}

      {profile.seeking ? (
        <section className="flex flex-col gap-2" aria-label="Seeking">
          <h3 className={meta}>Seeking</h3>
          <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed">{profile.seeking}</p>
        </section>
      ) : null}

      {profile.links && profile.links.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Links">
          <h3 className={meta}>Links</h3>
          <ul className="flex flex-col gap-1">
            {profile.links.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 transition-colors hover:text-foreground min-[720px]:min-h-9"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
