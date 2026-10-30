# Contributing to IntroMesh

Thanks for helping improve the Discover → Understand → Connect → Learn loop. Small, reviewable changes land faster than broad redesigns.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app opens at http://localhost:3000. Persistence requires Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Apply migrations in `supabase/APPLY.md` before the first join.

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

## How to commit

The message has a type, is written in English, and does not mention AI tools.

### Format

```
type(module): what changed and why

Optional body, one or two sentences.
```

The module is the product area: `onboarding`, `discovery`, `affinity`, `connect`, `learn`, `backend`. If the change spans several areas, omit the parentheses.

### Types

| Type | When |
| --- | --- |
| `feat` | New behavior |
| `fix` | Bug fix |
| `refactor` | Internal change, behavior stays the same |
| `docs` | Documentation only |
| `test` | Tests |
| `chore` | Maintenance that does not change the product |
| `perf` | Performance |
| `ci` | Continuous integration |

```
feat(discovery): keep the camera on the selected person so a second look stays put
fix(connect): open the public card when the QR is scanned
docs: commit message rules with feat and fix types
```

Bad:

```
Improvement implemented to optimize the user visual experience
update
wip
```

### Before you commit

1. One logical change per commit. Do not mix an API fix with a style change.
2. Review `git diff`. Do not add secrets, `.env`, or keys.
3. Exercise the flow you touched. On a page, walk it with Tab and check the console.

### Git

```bash
git status
git add path/to/file
git commit -m "type(module): what changed and why"
git push
```

If `main` moved on GitHub, `git pull` before you push. Resolve conflicts in the file and commit again. Do not `push --force` to `main`.

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
- UI in `src/app` and `src/components` (`onboarding/`, `signal/`, `share/`). Use cases in `src/server`. Domain in `src/domain`. Persistence in `src/lib/store` and `src/lib/supabase`. Meta in `src/lib/meta`. Session in `src/lib/session`.
- The interface reuses tokens and components from `docs/DESIGN.md`.
- Discovery requires consent. Do not invent rows, matches, or model text.
- Do not compare every profile to every other. Candidates come from the deterministic formula. The model only explains recommendations already chosen.
- Secrets live only on the server. No `NEXT_PUBLIC_` for keys.
- Product UI copy is English for the Meta hackathon.

Detail lives in `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, and `docs/PRODUCT.md`.

## Conduct and security

How we collaborate is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Do not report a vulnerability in a public issue: the path is in [SECURITY.md](SECURITY.md).

The code license is [MIT](LICENSE).
