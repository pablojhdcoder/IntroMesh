-- 0009: membership is visibility. Presence is deleted.
-- Backfill joined participations to the discoverable defaults (consent and
-- visibility columns are legacy and ignored by the read path), then drop the
-- presence table if it exists. Idempotent: safe to re-run.
update event_participations set consent = true where status = 'joined';

update event_participations set visibility = 'discoverable' where status = 'joined';

drop table if exists presence;
