# IntroMesh Wallet Card — Feasibility Report

Origin: the idea came from an event where someone shared their LinkedIn as a card stored in Apple Wallet. Goal: frictionless in-person networking backed by IntroMesh matching.

## 1. Options compared

| Option | Requirements | Cost (verified) | Setup | No native app? |
|---|---|---|---|---|
| Apple Wallet (.pkpass, generic) | Paid Apple Developer Program; Pass Type ID; Pass certificate + WWDR chain; server ZIP + manifest + CMS signing (e.g. `passkit-generator`); optional `webServiceURL` for updates | US$99/year | M–L (hours if certs exist; days if enrollment pending) | Yes |
| Google Wallet (Generic pass) | Google Wallet API Issuer account; Google Cloud service account; Generic class + object; JWT "Add to Google Wallet" link | No per-pass fee | S–M (~1–3 h once issuer exists) | Yes — link works from web/email/SMS |
| QR → web profile | Already built (`src/app/api/profiles/[slug]/qr/route.ts`, `src/components/share/share-tools.tsx`, `src/app/p/[slug]/page.tsx`) | $0 | Done | Yes |
| vCard (.vcf) | One route returning `text/vcard` | $0 | S (<1 h) | Yes |
| NFC tags | Already built (`NDEFReader` write/read) | Tag hardware only | Done | Partial — Chrome Android only, no Safari |
| PWA install | No `manifest` in `src/app` today | $0 | S | Yes, but weaker than Wallet |
| App Clips / Instant Apps | Native app + store accounts | $99/yr Apple path | L (weeks) | No — rejected |

Wallet is a distribution shell around the existing `/p/{slug}` URL. Google is the same-day path; Apple is gated on certificates.

## 2. Product design

- Card face: IntroMesh logo, name, role, event, QR = `https://{origin}/p/{slug}`. Back: top-3 interests/skills, profile URL, manage/revoke link. Nothing else.
- Scan flow (corrected vs naive "scan → auto-match"): `/p/[slug]` is anonymous. If the scanner is signed in, joined to the same event, and presence is on, show "Why you two should talk" (`POST /api/affinity`) + "Request intro" (`POST /api/connections`). Otherwise show the card + join CTA. No auto-created connections — seeing a profile is not a relationship (`docs/PRIVACY.md`, `docs/FLOW.md`).
- Pass updates: out of MVP. Apple live updates need a PassKit web service (device registrations, serials, auth tokens, APNs); Google updates need stored object state. IntroMesh `Database` (`src/lib/store/types.ts`) has no such records. MVP passes are static snapshots; the QR target stays live.
- Privacy: the pass is a bearer link — anyone with the QR sees the `SharedCard` (name, role, interests, skills, projects, goal, presentation; no `seeking`, `offers`, `links`, bio). `profileBySlug` (`src/server/session.ts`) does not check consent today, so label the card "Public link". Revocation v1 = rotate `slug` (kills QR + wallets + NFC at once). Demo profiles keep the Demo mark.

## 3. Fit with IntroMesh

No changes to the graph library, Signal Field layout, data model, or matching logic:

- Reuses `profiles.slug`, QR route, `/p/[slug]`, `explainActions.affinity`, `connectActions.requestConnection`, `learnActions.share`.
- Analytics adds `share_wallet` / `share_vcard` (additive enum in `src/domain/analytics.ts`).

Requires changes (out of MVP): instant AI match for strangers (breaks presence + candidate gates in `src/server/explain.ts`), auto-connect on scan (breaks consent model), live pass updates / per-device revocation (needs new persisted state + migrations).

## 4. Hackathon demo (3 min)

0:00–0:40 problem + field; 0:40–1:30 wow (scan card → public profile → grounded Meta explanation + opener, cache pre-warmed); 1:30–2:20 request → accept; 2:20–3:00 intelligence + privacy line. Meta appears exactly where the architecture wants it: one structured, grounded `muse-spark-1.3` explanation at the moment of meeting.

## 5. MVP plan (shipped)

- Google Wallet link (`src/lib/wallet/google.ts` RS256 JWT via `node:crypto`, `src/app/api/wallet/google/route.ts`), Apple gate (`src/lib/wallet/apple.ts`, `src/app/api/wallet/apple/route.ts` 503 without certs), vCard (`src/lib/wallet/vcard.ts`, `src/app/api/profiles/[slug]/vcard/route.ts`), scan landing (`src/components/share/scan-connect.tsx` in `src/app/p/[slug]/page.tsx`), wallet buttons in `src/components/share/share-tools.tsx`, analytics `share_wallet`/`share_vcard`.
- Secrets (env only): `GOOGLE_WALLET_*`, `APPLE_*`. Unset → 503 + hidden buttons, same pattern as `MODEL_API_KEY`.
- Risks: Apple cert latency (gated), Google issuer approval (gated), live Meta latency (pre-warm cache), bearer-link exposure (disclosed + slug rotation), two-sided presence requirement (rehearse with demo fixtures).
- Fallback: Google + QR + vCard carry the demo; Apple described as "pending certificate", never faked.

## 6. Verdict

Reduced version now: ship QR + scan landing + Google Wallet + vCard + Apple gate. Skip live updates, per-card revocation, matching changes, App Clips.
