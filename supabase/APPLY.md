# Apply IntroMesh schema on Supabase

In the Supabase dashboard open **SQL → New query**. Run these files **in order**, one after another (paste all contents of each file and click Run):

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_demo_seed.sql` — Meta Hackathon event + 28 demo profiles with presence
3. `supabase/migrations/0003_intelligence.sql` — identities, participations, pgvector, recommendations
4. `supabase/migrations/0004_store_parity.sql` — columns the app store needs + advisory locks

Or from a shell with the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the project:

```bash
supabase db push
```

Then set in `.env.local` (never commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Restart `npm run dev`. Persistence is Supabase only; `.data/store.json` is no longer used for app data.
