-- Extra real events + Meta cover. Idempotent: safe to re-apply.
-- Meta keeps demo=true (holds the 40 demo participations). New rooms are
-- demo=false, status upcoming/live, with complete fields and local covers
-- in public/events/*.svg (no Supabase Storage needed; public/ ships to Vercel).

insert into events (id, name, demo, description, category, starts_at, code, status, created_by, cover_url)
values
  ('meta-hackathon-2026', 'Meta Hackathon', true, 'Meta Global AI Developer Hackathon — build with Muse Spark, Muse Image and SAM 3.1.', 'hackathon', '2026-10-26T13:00:00.000Z', 'META-HACK', 'live', null, '/events/meta-hackathon-2026.svg'),
  ('junction-2026', 'Junction 2026', false, 'Europe''s largest hackathon: 48 hours in Espoo to build the next paradigm of technology.', 'hackathon', '2026-11-13T16:00:00.000Z', 'JUNCTION-2026', 'upcoming', null, '/events/junction-2026.svg'),
  ('nasa-space-apps-2026', 'NASA Space Apps Challenge 2026', false, 'The largest annual global hackathon using NASA open data for Earth and space challenges.', 'hackathon', '2026-11-14T09:00:00.000Z', 'SPACE-APPS-2026', 'upcoming', null, '/events/nasa-space-apps-2026.svg'),
  ('earthcode-2026', 'EarthCODE Hackathon 2026', false, 'Build open, reusable Earth observation workflows with ESA at ESRIN, Frascati.', 'hackathon', '2026-11-30T09:00:00.000Z', 'EARTHCODE-2026', 'upcoming', null, '/events/earthcode-2026.svg'),
  ('ethconf-2027', 'ETHConf 2027', false, 'ETHGlobal flagship: builders shipping the decentralized future in New York City.', 'hackathon', '2027-06-14T09:00:00.000Z', 'ETHCONF-2027', 'upcoming', null, '/events/ethconf-2027.svg'),
  ('wfeo-hackathon-2027', 'WFEO Hackathon 2027', false, 'Engineering students hack sustainable transport and cleaner mobility, online worldwide.', 'hackathon', '2027-11-20T09:00:00.000Z', 'WFEO-2027', 'upcoming', null, '/events/wfeo-hackathon-2027.svg')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  starts_at = excluded.starts_at,
  code = excluded.code,
  status = excluded.status,
  cover_url = excluded.cover_url;
