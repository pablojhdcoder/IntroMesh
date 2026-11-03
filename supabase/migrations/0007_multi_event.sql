-- Multi-event hub: profile settings, participation metadata, pair dedupe.
-- Idempotent: safe to re-apply.
-- RLS stays enabled (deny-anon) on all touched tables; the server accesses
-- them only with the service-role key. No policies are added here.

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists profile_visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_profile_visibility_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_profile_visibility_check
      check (profile_visibility in ('public', 'private'));
  end if;
end
$$;

alter table event_participations add column if not exists joined_at timestamptz;
alter table event_participations add column if not exists role text not null default 'attendee';
alter table event_participations add column if not exists last_active_at timestamptz;

update event_participations set joined_at = updated_at where joined_at is null;

alter table event_participations alter column joined_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_participations_role_check'
      and conrelid = 'event_participations'::regclass
  ) then
    alter table event_participations
      add constraint event_participations_role_check
      check (role in ('attendee', 'organizer', 'staff'));
  end if;
end
$$;

create unique index if not exists connections_pair_active_uidx
  on connections (least(from_id, to_id), greatest(from_id, to_id))
  where status in ('pending', 'accepted');

create index if not exists event_participations_user_status_idx
  on event_participations (user_id, status);

create index if not exists event_participations_event_status_idx
  on event_participations (event_id, status);
