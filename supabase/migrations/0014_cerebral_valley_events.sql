-- Cerebral Valley hackathons (Nov 2026). Idempotent: safe to re-apply.
-- Sources (verified 2026-11-05):
--   https://cerebralvalley.ai/e/built-with-claude-japan2026
--   https://lablab.ai/ai-hackathons/vultr-hackathon
--   https://cerebralvalley.ai/e/aie-code-2026-hackathon
--   https://cerebralvalley.ai/e/mongodb-toronto-hackathon
--   https://cerebralvalley.ai/e/gemini-4-nyc
-- New rooms are demo=false with complete fields and local covers in
-- public/events/*.svg. No participations are invented here.

insert into events (id, name, demo, description, category, starts_at, code, status, created_by, cover_url)
values
  ('built-with-claude-japan-2026', 'Built with Claude: Japan 2026', false, 'Anthropic''s first nationwide online hackathon in Japan: 250 builders ship tools with Claude Code. Up to $50,000 in API credits.', 'hackathon', '2026-11-02T03:00:00.000Z', 'CLAUDE-JP-2026', 'live', null, '/events/built-with-claude-japan-2026.svg'),
  ('vultr-agent-rush-2026', 'Vultr: Agent Rush Hackathon', false, 'Hybrid hackathon across three continents: online build with in-person finals on November 8.', 'hackathon', '2026-11-03T16:00:00.000Z', 'VULTR-RUSH-2026', 'live', null, '/events/vultr-agent-rush-2026.svg'),
  ('aie-code-2026', 'AIE Code Summit 2026 Hackathon', false, 'One-day hackathon in San Francisco: build coding agents that improve autonomously. $11,000 in prizes, judges from Meta and Google DeepMind.', 'hackathon', '2026-11-07T17:00:00.000Z', 'AIE-CODE-2026', 'upcoming', null, '/events/aie-code-2026.svg'),
  ('mongodb-toronto-2026', 'Agents in Context Toronto: MongoDB Hackathon', false, 'One-day MongoDB hackathon in Toronto: durable agentic AI on Atlas and Vector Search. Up to $21,000 CAD plus LangSmith credits.', 'hackathon', '2026-11-14T14:00:00.000Z', 'MONGO-TORONTO-2026', 'upcoming', null, '/events/mongodb-toronto-2026.svg'),
  ('gemini-4-nyc-2026', 'Gemini 4 NYC Hackathon', false, 'Push Gemini 4 in reasoning, visual coding and robotics in New York with Google DeepMind. $20,000 in prizes.', 'hackathon', '2026-11-21T14:00:00.000Z', 'GEMINI4-NYC-2026', 'upcoming', null, '/events/gemini-4-nyc-2026.svg')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  starts_at = excluded.starts_at,
  code = excluded.code,
  status = excluded.status,
  cover_url = excluded.cover_url;
