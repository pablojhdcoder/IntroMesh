-- 0008: social model — single live presence status.
-- Join = visible, Leave = hidden. No invisible/active/seeking modes.
-- Backfill any legacy non-active rows, then restrict to active only.
update presence set status = 'active' where status <> 'active';

alter table presence drop constraint if exists presence_status_check;
alter table presence add constraint presence_status_check check (status = 'active');
