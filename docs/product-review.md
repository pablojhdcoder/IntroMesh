# IntroMesh — Product Review for the Meta AI Developer Hackathon

**Scope:** Read-only review of `AGENTS.md`, `README.md`, `.cursor/rules/*`, `docs/*`, `src/app`, `src/components`, `src/domain`, `src/server`, `src/lib/meta`, `src/lib/supabase`, `src/lib/store`, `supabase/migrations`. No code was edited. Live Meta behaviour is **not** claimed verified — that requires `MODEL_API_KEY` + `npm run verify:meta` on the demo machine.
**Protected parts (must stay unchanged):** graph library (`react-force-graph-3d`/`three` in `src/components/signal/signal-galaxy.tsx`), architecture layers, data model/migrations, layout, matching logic (`src/domain/matching/*`, hybrid weights in `docs/MATCHING.md`). Every idea below is flagged against these.
**Effort key:** S = 1–3 h, M = 4–8 h, L = 9–16 h (solo dev, including tests).

---

## 1. What IntroMesh does today (5 lines)

1. IntroMesh is a consent-first, in-person networking layer for event attendees: join an event, describe yourself in free text, become discoverable, and meet the right people in the room (`docs/PRODUCT.md:15-19`, `docs/FLOW.md:7`).
2. Muse Spark (`muse-spark-1.3`, server-only via OpenAI SDK → `https://api.meta.ai/v1`) turns that free-text description into a structured, editable identity — and later explains matches and drafts openers (`README.md:15-21`, `src/lib/meta/normalize.ts`, `src/lib/meta/explain.ts`).
3. Deterministic code — not the model — picks who you see: live-presence + consent filter, then `score = goals×3 + interests×2 + skills×1 + complements×2`, max 8 recommendations, projected into a 3D Signal Field with a list alternative (`src/domain/matching/select-candidates.ts:67-99`, `src/server/discover.ts:38-60`).
4. Explanations are grounded or rejected: Zod-structured output, cited terms checked against declared data, cached per pair, and labelled `Meta AI` vs `Demo` (`src/server/explain.ts:154-211`, `src/domain/ground.ts`).
5. The loop closes with a mutual request/accept, a public card shared by link/QR/NFC, and an organizer Intelligence view of aggregates only (topics with <5 cases suppressed) (`src/server/connect.ts`, `src/app/intelligence/page.tsx:69-81`).

**Who it's for:** attendees at in-person events (mobile-first) who don't know who to talk to or why; secondarily organizers, who get aggregates, never profiles (`docs/PRODUCT.md:13-27`).

---

## 2. Current-state evaluation

### Strengths to keep and say out loud on stage
- **Trust architecture is real, not copy:** consent-gated discovery, 90 s presence expiry with 20 s heartbeat (`src/components/signal/signal-app.tsx:157-167`), secrets server-only, no invented model text, `demo` marks everywhere (`docs/PRIVACY.md`, `README.md:21-23`).
- **AI is correctly scoped:** model never scans the room or ranks people; it explains pre-ranked pairs and is rejected if ungrounded (`src/server/explain.ts:209-211`). This is a defensible, judge-friendly story.
- **Accessibility baseline is above hackathon average:** sr-only list alternative to the 3D field (`signal-field.tsx:84-97`), `aria-pressed` presence group, `role=status/alert`, visible focus ring, reduced-motion handling, ≥44 px targets (`docs/DESIGN.md:127-139`).

### Findings (severity-ordered)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | **Critical (demo)** | **The canonical demo never shows Meta AI.** If either profile is `demo`, the affinity call is skipped and a `demoExplanation` is returned. The seeded room is 28 demo fixtures, so following `README.md:60-68` shows a "Demo" badge, not Muse Spark. The single most important judging moment is invisible in the default flow. | `src/lib/meta/explain.ts:34-40`, `src/server/explain.ts:109-153`, `README.md:35` |
| F2 | **Critical (demo)** | **No follow-up after "accepted".** Accepting only reveals ShareTools for *your own* card. No "here's how to find them / what to say / what happened next", no connections list, no recap. The loop's payoff (Connect → Learn) reads as an endpoint, not a beginning. | `signal-app.tsx:535-563`, `src/server/connect.ts:54-75` |
| F3 | High | **Opener is not editable in the UI**, despite the product promise ("You can edit, discard, or regenerate it"). `requestIntro()` sends `explanation.opener` verbatim; only Regenerate exists. Judges will ask "can I change it?" | `README.md:19`, `signal-app.tsx:253-261, 552-555` |
| F4 | High | **Onboarding undersells the best AI moment.** Free-text → structured identity is the clearest "AI is essential" beat, but copy is terse ("One description.", "Meta · once", button state "Reading") with no visible before/after. Without a key it hard-fails to manual entry (honest, but a demo dead-end if unprepared). | `onboarding-flow.tsx:289-292, 444-447, 206-212`; `docs/FLOW.md:100-102` |
| F5 | High | **Error states are honest but unactionable.** "Not enough evidence.", "Turn on presence.", "Meta returned no explanation." — no retry/next-step affordance in the error itself (Regenerate sits below, unexplained), and explain errors conflate very different causes into one line. | `signal-app.tsx:239-249, 509-513` |
| F6 | Medium | **Explain latency risk live.** Meta client: 25 s timeout, up to 2 SDK retries; explain path can also poll-wait up to 40×250 ms for a concurrent claim. A cold, uncached pair on stage Wi-Fi can stall the demo for tens of seconds with only a skeleton. | `src/lib/meta/client.ts:17-18`, `src/server/explain.ts:115-132` |
| F7 | Medium | **Intelligence will likely look empty in a fresh demo.** Real counts start at 0 and topics are suppressed under 5 cases; the page can read as "nothing happened" unless the demo first generates requests/accepts/shares. | `src/app/intelligence/page.tsx:34-82`, `docs/FLOW.md:190` |
| F8 | Medium | **Accessibility gaps in the flagship surface.** The keyboard alternative is `sr-only` — focusable but visually invisible on focus; node meaning is colour-only (hot/cold); SpriteText labels are canvas-only. Onboarding inputs are `0.9375rem` (15 px), below the 16 px iOS-zoom threshold `docs/DESIGN.md:139` itself sets. | `signal-field.tsx:84-97`, `signal-galaxy.tsx:258-267`, `onboarding-flow.tsx:47-50`, `docs/DESIGN.md:139` |
| F9 | Medium | **Perf/debug leftovers in the 3D field.** `console.count("[perf-A] …")` ships in production paths; 48×48-segment glass spheres with transmission + particles for up to 18 nodes will stress low-end phones (the primary device per `docs/PRODUCT.md:50`). Dynamic `ssr:false` loading is correct, but there is no low-power fallback beyond reduced-motion. | `signal-galaxy.tsx:95, 195, 317, 451-456` |
| F10 | Low | **Confusing/weak demo props:** "Simulate accept" exposes the fixture mechanism on the main CTA path; NFC only writes a tag and is unavailable in most browsers — demoing it invites failure; presence labels (Invisible/Active/Seeking) are never explained in one line. | `signal-app.tsx:547-551`, `share-tools.tsx:21-23, 119-121`, `README.md:57` |
| F11 | Low | **Privacy story has no user-facing off-ramp beyond Invisible.** No "delete my identity/data" or "what is stored about me" surface; public `/p/[slug]` is link-guessable by design (acceptable, but say so). Consent copy is one checkbox line. | `onboarding-flow.tsx:482-490`, `src/app/p/[slug]/page.tsx`, `docs/PRIVACY.md` |

---

## 3. Ideas

Protected-parts flag: ✅ = touches none of the protected parts. ⚠️ = would require changing one (flagged, not recommended by default).

| # | Idea | Why it matters (user value + judging) | Effort | Risk | Files / areas | Protected? |
|---|------|----------------------------------------|--------|------|---------------|------------|
| I1 | **Live Meta Pair for the demo**: two real (non-`demo`) profiles created through onboarding on two devices/browsers, affinity pre-warmed so the on-stage explanation is cached (`cached: true`), with a rehearsed cold-call fallback | Fixes F1. Makes Muse Spark *visible*: grounded explanation + opener, labelled "Meta AI". This is the difference between "AI-powered" as a claim and as evidence | S (1–2 h, mostly rehearsal) | Key/quota failure on the day → mitigate with pre-warm + recorded fallback (§5) | No code: `.env`, onboarding UI, demo script. Optional helper: `scripts/verify-meta-api.ts` pattern | ✅ |
| I2 | **"Watch Muse Spark think" onboarding beat**: after Continue, show description → structured identity as an explicit before/after (extracted interests/skills/looking-for highlighted), with a one-line "Muse Spark read your text — edit anything" | Fixes F4. The strongest "AI is essential, not decorative" proof: unstructured human language in, matchable structure out, human stays in control. Memorable in the first 30 s | S–M (3–5 h) | Over-animating slows onboarding; keep it a static diff view | `src/components/onboarding/onboarding-flow.tsx` (review step), copy only. No prompt/schema change | ✅ |
| I3 | **Editable opener + send-as-mine**: opener becomes an editable field before "Request connection"; edited text sends with `introSource: "user"` (already supported server-side) | Fixes F3. Delivers the README promise; shows human agency over model text — a trust beat judges reward | S (2–3 h) | Users sending empty/abusive text → keep max-length + disable-empty | `src/components/signal/signal-app.tsx:514-555`; `src/server/connect.ts:20` already accepts `"user"` | ✅ |
| I4 | **Evidence trace in the match panel**: render the explanation's already-returned `citedGoals/citedInterests/citedSkills/complement` as labelled chips tied to the evidence list ("Muse Spark cited: …"), plus `confidenceNotes` when present | Explainability becomes inspectable, not a paragraph you must trust. Directly answers "why these two?" with receipts — core-value strengthening | S (2–4 h) | Chip clutter; cap at existing ≤3 evidence + cited lists | `signal-app.tsx:472-524` (data already in `Explanation` type, `signal-app.tsx:23-32`) | ✅ |
| I5 | **Post-accept "Meet now" card**: on accepted, show (a) the opener as an icebreaker you can copy, (b) the 2–3 cited shared signals as talking points, (c) ShareTools, (d) one-line "Find them: share your card, they have your public link" | Fixes F2. Converts a status into an in-person action — the product's actual purpose ("make the introduction happen"). Gives the demo a satisfying final frame | M (4–6 h) | Scope creep into chat/scheduling — explicitly do **not** add messaging | `signal-app.tsx:535-563`, reuse `ShareTools`; no server change (data already client-side) | ✅ |
| I6 | **Actionable explain errors + retry**: map `presence/match/meta` errors to a sentence + one action ("Turn on Active" button, "Pick a highlighted person", "Try again") | Fixes F5. Removes the only dead-ends in the Understand step; cheap polish that reads as product maturity | S (1–2 h) | None material | `signal-app.tsx:239-251, 509-513` | ✅ |
| I7 | **Demo-mode checklist (presenter overlay)**: a `?present=1` gated panel listing the 6 demo steps with live status (key configured ✓, pair cached ✓, presence on ✓) — hidden in normal use | De-risks the 3-minute demo for a solo presenter; invisible to judges as product UI if dismissed before start | S (2–3 h) | Shipping presenter chrome users can find → gate behind query param + never link it | `signal-app.tsx` (new small component), `src/app/api/session/route.ts` already exposes `metaConfigured` | ✅ |
| I8 | **"Second look" follow-up (post-event recap)**: after the event, a private "People you met" list from your accepted connections with the reason you connected | Real Learn-step value; retention story for "what's next" judging questions | M (5–8 h) | Needs care not to expose the other side's private data — public card fields only | `src/app` new page + `connectActions.connections` (`src/server/connect.ts:8-18`) reuse | ✅ (new page; no model/layout change) |
| I9 | **Group intro / triad suggestion**: Muse Spark proposes a 3-person intro when A–B and A–C share a signal | Genuinely novel networking value; strong "only AI can phrase this" moment | L (10–16 h) | Requires new candidate logic → touches matching; grounding three profiles is untested. **Post-hackathon** | `src/domain/matching/*`, `src/server/explain.ts` | ⚠️ matching logic |
| I10 | **Voice/free-form intent refinement in the room**: "Actually, I want to meet a designer" re-ranks the field via model-parsed intent | Impressive but re-opens ranking-by-model, violating the product's trust contract ("Meta does not choose who appears") | L | Undermines the core positioning; latency | `src/server/discover.ts`, matching | ⚠️ matching + architecture contract |
| I11 | Replace graph library / redesign layout for "wow" | — | L | Explicitly protected; the field is not the weak point | — | ⚠️ graph library + layout — **do not** |

---

## 4. Prioritisation

### Must do before demo (quick wins)
1. **I1 — Live Meta Pair + pre-warm** (fixes the critical F1; without it the Meta story is a badge).
2. **I6 — Actionable explain errors** (1–2 h; removes demo dead-ends).
3. **I3 — Editable opener** (delivers an explicitly promised feature judges may test).
4. Rehearse the exact 3-minute path (§5) on the demo network, with `npm run verify:meta`, build, and a screen-recorded fallback of the full flow.
5. Remove the two `console.count("[perf-A] …")` calls (`signal-galaxy.tsx:195, 317`) — one-line hygiene so the demo console is clean. (Flagged here as a recommendation only; this review edits no code.)

### Should do (if Must is done)
- **I2 — Onboarding before/after beat** (best AI-essential storytelling per hour).
- **I4 — Evidence trace chips** (explainability receipts).
- **I5 — "Meet now" post-accept card** (completes the loop's payoff).
- **I7 — Presenter checklist** (solo-demo insurance).

### Nice to have
- **I8 — Post-event "People you met" recap** (retention narrative; not needed to win the room demo).
- Fix the 15 px input font (`onboarding-flow.tsx:47-50`) to 16 px and make the sr-only field list visibly focusable (F8) — correct, cheap, but invisible in a 3-minute demo.
- One-line explainer under the presence control (what Active/Seeking mean).

### Avoid (and why)
- **I9/I10** — anything that lets the model rank, re-rank, or group people: violates the stated trust contract, touches protected matching logic, and adds ungrounded-output risk days before the deadline.
- **I11 / any graph-library or layout change** — protected, and the field is a strength, not the problem.
- **Demoing NFC** — browser/hardware-gated, writes-a-tag only; high failure probability, low payoff (F10). Mention it as progressive enhancement in one sentence instead.
- **Leading with Intelligence** — correct-but-empty aggregates (F7) open weak; use it only as the 15-second closer after the demo has generated real requests/accepts.
- **Adding chat, scheduling, or location** — contradicts `docs/PRODUCT.md` positioning and privacy commitments; scope risk for a solo dev.

---

## 5. Top 3 to build next (build-agent ready)

### #1 — Live Meta Pair + pre-warm rehearsal kit (Effort: S, 1–2 h · no code changes to protected parts)
**Problem:** Demo fixtures never trigger Muse Spark (F1: `src/lib/meta/explain.ts:34-40`).
**Plan:**
1. On the demo machine, confirm `.env` has `MODEL_API_KEY`; run `npm run verify:meta` and `npm run build`. If verify fails, stop — fix the key, do not rehearse around it.
2. Create **two real profiles** via the normal onboarding UI (two browsers/profiles), with overlapping declared interests/skills/goals using the existing catalog so `selectCandidates` ranks them (e.g. shared interest + one complement skill in `seeking`).
3. Join both to the demo event, set both to Active/Seeking, open the match once from each side so `src/server/explain.ts` caches the grounded explanation (second open should return `cached: true`).
4. Write the 3-minute script around it: (0:00) problem line → (0:20) free-text description → Muse Spark identity (I2 if built) → (1:00) Signal Field, select the real match → (1:30) **Meta AI explanation + evidence** → (2:10) edit/regenerate opener → request → accept on device 2 → (2:40) QR to public card → (2:55) Intelligence closer.
5. Record a full screen capture of steps 2–4 as the offline fallback; label it as a recording if used.
**Acceptance:** On-stage explanation badge reads "Meta AI" (not "Demo"); cached open renders <1 s; fallback video exists.
**Do not:** seed fake "real" rows, relabel demo output, or weaken `shouldCallMetaForAffinity`.

### #2 — Editable opener + evidence trace (Effort: S–M, 4–6 h combined I3+I4)
**Problem:** Promised editability is missing (F3); citations returned by the API are discarded by the UI (F-adjacent).
**Plan:**
1. In `src/components/signal/signal-app.tsx`, extend the explanation block (`:514-524`): render cited chips from the existing `Explanation` fields (`citedGoals/citedInterests/citedSkills/complement`, type at `:23-32`) under the summary, labelled "Cited from your profiles".
2. Replace the static opener paragraph with a labelled textarea (default = `explanation.opener`, max length matching server expectations); "Request connection" sends the edited value with `introSource: "user"` when changed, `"model"/"demo"` when untouched (`requestIntro`, `:253-261`; server already accepts it, `src/server/connect.ts:20`).
3. Keep Regenerate; regenerating resets the textarea. Disable Request while the opener is empty or an explanation is pending/errored.
4. Tests: component test that editing changes the POST body `introSource` to `"user"`; untouched sends the original source. Run `npm test`, `npm run lint`.
**Acceptance:** Judge can edit the opener on stage and the accepted connection shows *their* text; citations visible without extra API calls.
**Protected check:** ✅ UI-only; no matching, schema, or layout change.

### #3 — Post-accept "Meet now" card (Effort: M, 4–6 h, I5)
**Problem:** Accepted connections dead-end (F2); the demo has no final payoff frame.
**Plan:**
1. In `signal-app.tsx:535-563`, when `relation.status === "accepted"`, render a dedicated card: heading "You're connected with {name}", the intro/opener with a Copy button, up to 3 talking-point chips from the current explanation's cited signals (or `evidenceOf(detail.recommendation)` if no explanation in state), then the existing `ShareTools`.
2. Add one honest line of guidance: "Share your card so they can find you in the room." No chat, no location, no new tracking.
3. Keep the pending state unchanged; "Simulate accept" stays for fixtures but is visually secondary to the real request action.
4. Tests: accepted state renders talking points + copy action; pending state does not. Run `npm test`, `npm run lint`, and re-run the §5-#1 rehearsal end-to-end (accept on device 2 must land on this card).
**Acceptance:** The demo's last product frame answers "so what do I do now?" in one glance.
**Protected check:** ✅ Presentation of existing data only; no data-model, matching, graph, or layout change.

---

*Prepared as a read-only review. The only file created is this report, per instructions.*
