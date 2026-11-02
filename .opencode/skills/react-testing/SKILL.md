---
name: react-testing
description: React component testing with React Testing Library, Vitest/Jest, MSW for network mocking, accessibility assertions with axe, and the decision boundary between component tests and Playwright/Cypress end-to-end runs. Use when writing or fixing tests for React components, hooks, or pages.
---

Component tests for IntroMesh use Vitest plus React Testing Library, one lane only.

- Test what the user sees and does, not internals: no state, props, or render-count assertions.
- Query priority: Role, Label, Placeholder, Text, then Alt/Title; `testid` is the last resort.
- Interact with `userEvent`; render with the production providers the screen really uses.
- Never mock React or hooks; mock the network boundary and assert callbacks and requests instead.
- Cover the same states the UI must implement: loading, empty, error, success, selection, no data.
- Mobile is a first-class experience; test the responsive behavior the screen promises.

Run with `npm test`. Targets: 70% presentational UI, 85% hooks, 90% utils.
