# IntroMesh — The Signal Loop

Visual direction for an AI-assisted in-person networking product. The interface shows how someone moves from discovering to understanding why they connect, then creating a relationship.

Quality references: Linear’s precision, Vercel’s clarity, Apple’s care. Their interfaces are not copied.

## Principles

1. Information leads. Motion explains state; it does not decorate.
2. Two themes designed separately. Light is cold white; dark stays cinematic. Contrast is intentional in both.
3. One luminous accent: the signal.
4. Every recommendation shows a concrete reason. Never an orphan percentage.
5. Synthetic data is labeled as demo. Model-generated text is distinguished from domain data.
6. Mobile is its own experience, not a narrow desktop column.

## Avoid

- Gratuitous gradients, blobs, and mesh backgrounds.
- Stacked glassmorphism. The signal field is the only 3D surface: glass spheres, particle threads, and orbit. The rest of the UI stays flat.
- Several animations competing with text at once.
- Generic SaaS cards with icon, title, and three identical bullets.
- Mixing radii, shadows, or type families outside these tokens.

## Visual thread

**Discover → Understand → Connect → Learn.**

The central visualization is a spatial field: volumetric nodes, threads toward recommendations, and a path toward a possible connection. On mobile, the field shows the active person and two or three signals; the rest stays in a list. The field is functional and fed by real data or labeled synthetic data.

## Color

The default theme is light. The first visit opens in light even if the system is dark. Manual preference is stored in the `intromesh-theme` cookie and reapplied on the server, so the opposite theme does not flash. `prefers-color-scheme` is not followed.

A capsule control at the top right of the header switches themes. The visible capsule is 28px; the touch target stays 44px. It uses `Sun` and `Moon` icons. The thumb marks the active theme and moves in 300ms with `cubic-bezier(0.32, 0.72, 0, 1)`. With `prefers-reduced-motion: reduce`, theme change and thumb are instant.

Semantic names (`--background`, `--foreground`, `--surface`, `--border`, `--signal`) are the source of truth. Light mode is not the negative of dark.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#ffffff` | Canvas, true white |
| `--surface` | `#ffffff` | Panels and form fields |
| `--surface-raised` | `#f4f4f5` | Hover and selected block |
| `--foreground` | `#111111` | Primary text |
| `--muted` | `#525252` | Secondary text. Lives in CSS as `--muted-foreground` |
| `--line` | `rgb(10 10 10 / 0.12)` | Borders. Lives in CSS as `--border` |
| `--signal` | `#d6ff4a` | Primary action, with text `#14160c` |
| `--signal-strong` | `#4c6610` | Brand, focus, active node and active edge on white |
| `--signal-dim` | `rgb(76 102 16 / 0.12)` | Soft path hint |
| `--danger` | `#b42318` | Error. Lives in CSS as `--destructive` |
| `--success` | `#1f7a4a` | Success |
| `--shadow-raise` | `0 10px 28px rgb(10 10 10 / 0.06)` | Reserved. The field sits on white, no frame or shadow |

### Dark

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#07080c` | Canvas |
| `--surface` | `#101218` | Panels and cards |
| `--surface-raised` | `#171a22` | Selected or raised element |
| `--foreground` | `#f4f1ea` | Primary text, warm on black |
| `--muted` | `#9a958c` | Secondary text. Lives in CSS as `--muted-foreground` |
| `--line` | `rgb(244 241 234 / 0.12)` | Borders. Lives in CSS as `--border` |
| `--signal` | `#d6ff4a` | Connection accent. One dominant use per view |
| `--signal-strong` | `#d6ff4a` | Same signal: on black the lime already contrasts |
| `--signal-dim` | `rgb(214 255 74 / 0.16)` | Halo or path hint |
| `--danger` | `#ff6b5a` | Error. Lives in CSS as `--destructive` |
| `--success` | `#8ee0b0` | Success and accepted connection |
| `--shadow-raise` | `0 16px 40px rgb(0 0 0 / 0.35)` | Reserved. The dark field sits on the canvas, no frame |

The accent does not tint large backgrounds. It marks the active signal, focus, and primary action. In light, lime `#d6ff4a` is reserved for the primary button: on white it lacks contrast, and field marks use `--signal-strong`.

On theme change, color, background, border, stroke, and shadow transition in `220ms` with `--ease-out`. The `theme-ready` class is added after first paint so that transition does not run during load.

## Typography

| Role | Family | Use |
| --- | --- | --- |
| Display | Instrument Serif | Section titles and names in the network. Italic only for one emphasis word |
| UI | Geist Sans | Interface, buttons, body |
| Meta | Geist Mono | Short labels, states, identifiers |

Scale: display `clamp(2.5rem, 6vw, 4.5rem)` with tracking `-0.03em`; card title `1.125rem`; body `0.9375rem` / line-height `1.5`; meta `0.75rem` with tracking `0.08em` in uppercase.

## Spacing, radius, and shadow

Scale of 4: `4, 8, 12, 16, 24, 32, 48, 64`.

| Token | Value |
| --- | --- |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `20px` |

`--shadow-raise` depends on the theme. See Color.

Borders are 1px with `--line`. The field has no frame, surface, or shadow: it sits on `--background`.

## Motion

| Token | Value |
| --- | --- |
| `--duration-fast` | `160ms` |
| `--duration-base` | `280ms` |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |

Entries and state changes use ease-out. Do not use ease-in to appear. Animatable properties: `transform` and `opacity`.

`prefers-reduced-motion: reduce` removes translations and leaves instant opacity or state changes.

Onboarding steps and the signal detail column crossfade with an 8–12px Y translation over `--duration-base`. Exit uses `--duration-fast`. The 3D field camera is the only longer motion (~700ms).

Loop transitions: Discover moves focus to the node; Understand opens the reason; Connect confirms with the accent; Learn leaves the connection at rest.

## Components

shadcn/ui is the base. Restyle it with these tokens. Do not mix other component libraries.

- Primary button: `--signal` background, text `#14160c`, radius `--radius-sm`.
- Secondary button: surface, `--line` border, `--foreground` text.
- Affinity card: surface, one visible reason, at most three evidence items, clear action.
- Signal field: only 3D surface. “You” stays fixed at the center. Everyone else orbits with a force simulation, glass spheres (transmission, clearcoat), and particles along threads. Recommendations glow with the signal; the rest is dimmer. The name floats under the sphere. The camera can orbit. With `prefers-reduced-motion` there are no particles or autorotation. In light, lime does not mark the field: use `--signal-strong`.
- Required states: loading, empty, error, success, selection, and disabled.

## Accessibility

- Primary text contrast on canvas above 7:1. Accent `#d6ff4a` on `#14160c` exceeds 4.5:1 for controls. In light, focus and secondary text use inks readable on `#ffffff` (legacy canvas `#f6f4ef` no longer ships). `#525252` is used instead of `#737373` so secondary text stays above 4.5:1 on white.
- Visible focus with a 2px `--ring` (`--signal-strong`) and 2px offset.
- Every action works with the keyboard. The network has a list alternative.
- Lucide icons accompany text, except when `aria-label` names the action.

## Responsive

- `< 720px`: one column. The field shows the active person and two or three signals; the rest is a list. Primary actions are full width.
- `≥ 720px`: field on the left and explanation on the right, on one screen. Detail, if it grows, scrolls inside its column.

Touch targets at least 44px. Inputs at 16px to avoid iOS zoom.
