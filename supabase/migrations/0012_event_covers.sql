-- Event covers. Local files in public/events/*.svg, deployed with Vercel.
-- Idempotent: safe to re-apply.
alter table events add column if not exists cover_url text;
