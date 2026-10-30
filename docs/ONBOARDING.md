# Onboarding — event first

Professional identity is created once. Each event adds a distinct intent.

```mermaid
flowchart TD
  invite[Link or code] --> resolve{Open event}
  resolve -->|no| error[Clear error]
  resolve -->|yes| known{Identity confirmed}
  start[Where are you going?] --> known
  known -->|no| identity[Name and description]
  identity --> meta[Muse Spark once per hash]
  meta --> review[Editable review]
  review --> save[Explicit confirmation]
  known -->|yes| intent[What brings you here?]
  save --> intent
  intent --> join[Participation]
  join --> field[Existing Signal Field]
```

1. The user picks a real event, joins with a code, or creates one. No invented events. Counts come from `presence`.
2. Without a confirmed identity, only name and free-form description are asked.
3. Meta normalizes. The person corrects and presses “Save identity”.
4. An optional text stores that event’s context. It does not call Meta.
5. Someone who already confirmed identity does not rewrite it when changing events.

This screen replaces the previous long form. Signal Field presentation does not change.
