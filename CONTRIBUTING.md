# Contributing to IntroMesh

Thanks for helping improve the Discover → Understand → Connect → Learn loop. Small, reviewable changes land faster than broad redesigns.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app opens at http://localhost:3000. Without Supabase, data lives in `.data/store.json`, which is not versioned.

Before opening a pull request:

```bash
npm test
npm run lint
```

Run `npm run build` when the change touches routes, config, or the graph. Run `npm run verify:meta` only if `MODEL_API_KEY` is in `.env.local`. An unverified call is not declared successful.

## Branches

`main` stays deployable. New work starts from an up-to-date `main`.

| Prefix | When |
| --- | --- |
| `feat/` | New behavior in the loop |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `chore/` | Dependencies, tooling, or work the attendee never sees |

Names are kebab-case and describe the change, not the issue number: `fix/camera-returns-to-room`. One branch, one topic. If the topic grows, split into separate pull requests.

Do not push directly to `main`.

## Commits

One commit, one idea. The message is English, imperative, and explains why. The subject fits on one line. The body, if needed, says what is resolved.

```
feat: keep the camera on the selected person so a second look stays put
```

Do not use empty messages (`update`, `fix`, `wip`) or mix formatting, refactor, and product in the same commit when they can be separated.

Do not commit:

- `.env`, `.env.local`, or any key (`MODEL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `.data/`
- `node_modules/` or `.next/`

## Issues

Open an issue before a large branch. Use the bug or proposal template.

A bug includes what you expected, what happened, and steps to reproduce. A proposal says which moment of the loop changes and who it helps. Product questions can be a short proposal.

Do not paste keys, cookies, real profiles, or screenshots with other people’s data. Demo profiles are marked `demo`.

## Pull requests

The branch targets `main`. The title follows the commit tone. The description says:

1. What changes for someone at the event.
2. How it was tested (`npm test`, `npm run lint`, and the browser path if UI changed).
3. What is out of scope.

Ask for review when checks pass. If a hook rejects a commit, fix it and create a new commit. Do not rewrite published history.

## Code

- Strict TypeScript. External inputs and outputs are validated with Zod.
- UI in `src/app` and `src/components`. Use cases in `src/server`. Domain in `src/domain`. Meta in `src/lib/meta`. Supabase in `src/lib/supabase`.
- The interface reuses tokens and components from `docs/DESIGN.md`.
- Discovery requires consent. Do not invent rows, matches, or model text.
- Do not compare every profile to every other. Candidates come from the deterministic formula. The model only explains recommendations already chosen.
- Secrets live only on the server. No `NEXT_PUBLIC_` for keys.
- Product UI copy is English for the Meta hackathon.

Detail lives in `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, and `docs/PRODUCT.md`.

## Conduct and security

How we collaborate is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Do not report a vulnerability in a public issue: the path is in [SECURITY.md](SECURITY.md).

The code license is [MIT](LICENSE).
